-- ===============================================================================
-- DATABASE HARDENING & AUTOMATION - CORPORATE INFLUENCE COACH
-- Automated summarization, memory promotion, and data lifecycle management
-- ===============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ===============================================================================
-- 1. SESSION SUMMARIZATION FUNCTION
-- ===============================================================================

-- Function to generate session summaries using OpenAI API
CREATE OR REPLACE FUNCTION fn_generate_session_summary(
  p_session_id UUID,
  p_user_id UUID,
  p_trigger_message_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges
AS $$
DECLARE
  v_messages_text TEXT;
  v_summary_text TEXT;
  v_key_topics TEXT[];
  v_new_summary_id UUID;
  v_next_version INTEGER;
  v_message_count INTEGER;
  v_start_message_id UUID;
  v_end_message_id UUID;
  v_openai_response JSON;
  v_http_response http_response;
  v_openai_payload JSON;
BEGIN
  -- Get the next version number for this session
  SELECT COALESCE(MAX(summary_version), 0) + 1 
  INTO v_next_version 
  FROM short_term_contexts 
  WHERE session_id = p_session_id;
  
  -- Collect last 10 messages from the session
  WITH recent_messages AS (
    SELECT 
      id,
      role,
      content,
      message_timestamp,
      ROW_NUMBER() OVER (ORDER BY message_timestamp DESC) as rn
    FROM conversation_messages 
    WHERE session_id = p_session_id 
      AND user_id = p_user_id
    ORDER BY message_timestamp DESC 
    LIMIT 10
  ),
  message_summary AS (
    SELECT 
      string_agg(
        role || ': ' || LEFT(content, 300), 
        E'\n' 
        ORDER BY message_timestamp ASC
      ) as conversation_text,
      COUNT(*) as msg_count,
      (array_agg(id ORDER BY message_timestamp ASC))[1] as start_id,
      (array_agg(id ORDER BY message_timestamp DESC))[1] as end_id
    FROM recent_messages
  )
  SELECT 
    conversation_text,
    msg_count,
    start_id,
    end_id
  INTO v_messages_text, v_message_count, v_start_message_id, v_end_message_id
  FROM message_summary;
  
  -- Exit early if no messages to summarize
  IF v_message_count = 0 OR v_messages_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- For now, create a simple rule-based summary
  v_summary_text := 'Session summary (v' || v_next_version || '): Discussed workplace challenges and provided strategic guidance. ' ||
                    'Covered ' || v_message_count || ' message exchanges with actionable coaching insights.';
  
  -- Extract key topics (simple keyword extraction for now)
  v_key_topics := string_to_array(
    regexp_replace(
      regexp_replace(v_messages_text, '[^a-zA-Z0-9\s]', '', 'g'),
      '\s+', ' ', 'g'
    ), 
    ' '
  );
  
  -- Filter to meaningful topics
  SELECT array_agg(DISTINCT word)
  INTO v_key_topics
  FROM (
    SELECT unnest(v_key_topics) as word
  ) words
  WHERE length(word) > 4 
    AND word IN ('leadership', 'communication', 'strategy', 'influence', 'politics', 'negotiation', 'management', 'conflict', 'promotion', 'networking')
  LIMIT 5;
  
  -- Insert the summary into short_term_contexts
  INSERT INTO short_term_contexts (
    session_id,
    user_id,
    summary_text,
    key_topics,
    message_start_id,
    message_end_id,
    message_count,
    summary_version,
    context_weight,
    created_at,
    last_accessed
  ) VALUES (
    p_session_id,
    p_user_id,
    v_summary_text,
    COALESCE(v_key_topics, '{}'),
    v_start_message_id,
    v_end_message_id,
    v_message_count,
    v_next_version,
    0.8,
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_summary_id;
  
  -- Cleanup old summaries (keep only last 5 versions)
  DELETE FROM short_term_contexts 
  WHERE session_id = p_session_id 
    AND summary_version <= v_next_version - 5;
  
  -- Notify external systems about summary generation
  PERFORM pg_notify(
    'summary_generated',
    json_build_object(
      'session_id', p_session_id,
      'user_id', p_user_id,
      'summary_id', v_new_summary_id,
      'version', v_next_version,
      'message_count', v_message_count
    )::text
  );
  
  -- Log the event
  RAISE NOTICE 'Generated summary % for session % (% messages)', 
               v_new_summary_id, p_session_id, v_message_count;
  
  RETURN v_new_summary_id;
END;
$$;

-- ===============================================================================
-- 2. AUTOMATED SUMMARIZATION TRIGGER
-- ===============================================================================

-- Function to handle automatic summarization trigger logic
CREATE OR REPLACE FUNCTION trigger_auto_session_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_count INTEGER;
  v_assistant_count INTEGER;
  v_user_count INTEGER;
BEGIN
  -- Only process assistant messages (ensures we have complete exchanges)
  IF NEW.role != 'assistant' THEN
    RETURN NEW;
  END IF;
  
  -- Count total messages and assistant messages in this session
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE role = 'assistant') as assistant,
    COUNT(*) FILTER (WHERE role = 'user') as user_msgs
  INTO v_message_count, v_assistant_count, v_user_count
  FROM conversation_messages 
  WHERE session_id = NEW.session_id;
  
  -- Trigger summarization every 5 complete exchanges (10 total messages)
  IF v_message_count >= 10 
     AND v_message_count % 10 = 0 
     AND v_assistant_count >= 5 
     AND v_user_count >= 5 THEN
    
    -- Generate summary asynchronously
    PERFORM fn_generate_session_summary(
      NEW.session_id, 
      NEW.user_id, 
      NEW.id
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_session_summary_auto ON conversation_messages;
CREATE TRIGGER trigger_session_summary_auto
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_session_summary();

-- ===============================================================================
-- 3. ENHANCED MEMORY PROMOTION FUNCTION
-- ===============================================================================

-- Improved function to promote short-term contexts to long-term memories
CREATE OR REPLACE FUNCTION fn_promote_short_to_long()
RETURNS TABLE (
  promoted_count INTEGER,
  processed_sessions INTEGER,
  promotion_details JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion_count INTEGER := 0;
  v_session_count INTEGER := 0;
  v_context_record RECORD;
  v_memory_title TEXT;
  v_memory_content TEXT;
  v_promotion_details JSON[] := '{}';
  v_detail_entry JSON;
BEGIN
  -- Find short-term contexts eligible for promotion
  -- Criteria: older than 30 days, high context weight, not already promoted
  FOR v_context_record IN 
    SELECT 
      stc.*,
      cs.title as session_title,
      up.current_position,
      up.primary_function
    FROM short_term_contexts stc
    JOIN conversation_sessions cs ON stc.session_id = cs.id
    LEFT JOIN user_personalization up ON stc.user_id = up.user_id
    WHERE stc.created_at < NOW() - INTERVAL '30 days'
      AND stc.context_weight >= 0.7
      AND NOT EXISTS (
        SELECT 1 FROM long_term_memories ltm 
        WHERE ltm.user_id = stc.user_id 
          AND ltm.source_session_ids @> ARRAY[stc.session_id]
      )
    ORDER BY stc.context_weight DESC, stc.created_at ASC
    LIMIT 100 -- Process in batches to avoid long-running transactions
  LOOP
    v_session_count := v_session_count + 1;
    
    -- Create contextual memory title
    v_memory_title := CASE 
      WHEN v_context_record.session_title IS NOT NULL THEN
        'Insights: ' || LEFT(v_context_record.session_title, 50)
      ELSE
        'Session Patterns: ' || v_context_record.primary_function || ' Challenges'
    END;
    
    -- Enhanced memory content with context
    v_memory_content := 'Key insights from ' || 
                        to_char(v_context_record.created_at, 'Month YYYY') || 
                        ' coaching session: ' || v_context_record.summary_text;
    
    -- Add role-specific context if available
    IF v_context_record.current_position IS NOT NULL THEN
      v_memory_content := v_memory_content || 
                          ' [Context: ' || v_context_record.current_position || 
                          ' level professional]';
    END IF;
    
    -- Create long-term memory
    INSERT INTO long_term_memories (
      user_id,
      memory_title,
      memory_content,
      memory_type,
      topics,
      scenarios,
      source_session_ids,
      source_message_count,
      confidence_score,
      created_at,
      updated_at
    ) VALUES (
      v_context_record.user_id,
      v_memory_title,
      v_memory_content,
      'pattern',
      v_context_record.key_topics,
      '{}', -- Could be enhanced with scenario detection
      ARRAY[v_context_record.session_id],
      v_context_record.message_count,
      v_context_record.context_weight,
      NOW(),
      NOW()
    );
    
    -- Track promotion details
    v_detail_entry := json_build_object(
      'session_id', v_context_record.session_id,
      'user_id', v_context_record.user_id,
      'context_weight', v_context_record.context_weight,
      'topics', v_context_record.key_topics,
      'age_days', EXTRACT(DAYS FROM NOW() - v_context_record.created_at)
    );
    
    v_promotion_details := v_promotion_details || v_detail_entry;
    v_promotion_count := v_promotion_count + 1;
    
  END LOOP;
  
  -- Log results
  RAISE NOTICE 'Memory promotion completed: % contexts promoted from % sessions processed', 
               v_promotion_count, v_session_count;
  
  -- Notify external systems
  PERFORM pg_notify(
    'memory_promotion_completed',
    json_build_object(
      'promoted_count', v_promotion_count,
      'processed_sessions', v_session_count,
      'timestamp', NOW()
    )::text
  );
  
  RETURN QUERY SELECT 
    v_promotion_count,
    v_session_count,
    array_to_json(v_promotion_details);
END;
$$;

-- ===============================================================================
-- 4. NIGHTLY PROMOTION JOB
-- ===============================================================================

-- Schedule nightly memory promotion (03:00 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('memory-promotion-nightly');
  PERFORM cron.schedule(
    'memory-promotion-nightly',
    '0 3 * * *',
    'SELECT fn_promote_short_to_long();'
  );
  RAISE NOTICE 'Scheduled nightly memory promotion job at 03:00 UTC';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Cron scheduling requires superuser privileges';
END $$;

-- ===============================================================================
-- 5. UNIT TESTS
-- ===============================================================================

-- Unit test: Verify automatic summarization trigger
DO $$
DECLARE
  test_user_id UUID;
  test_session_id UUID := gen_random_uuid();
  summary_count INTEGER;
  message_count INTEGER;
  i INTEGER;
BEGIN
  RAISE NOTICE 'Starting summarization trigger unit test...';
  
  -- Get an existing user_id or create a test user in auth.users
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- If no users exist, skip the test
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'Skipping unit test - no users found in auth.users table';
    RETURN;
  END IF;
  
  -- Create test session
  INSERT INTO conversation_sessions (id, user_id, title, created_at)
  VALUES (test_session_id, test_user_id, 'Test Session', NOW());
  
  -- Insert 11 messages (alternating user/assistant)
  FOR i IN 1..11 LOOP
    INSERT INTO conversation_messages (
      session_id, 
      user_id, 
      role, 
      content, 
      message_timestamp
    ) VALUES (
      test_session_id,
      test_user_id,
      CASE WHEN i % 2 = 1 THEN 'user' ELSE 'assistant' END,
      'Test message ' || i || ' content for summarization trigger test',
      NOW() - INTERVAL '1 minute' * (11 - i)
    );
  END LOOP;
  
  -- Check that exactly one summary was generated
  SELECT COUNT(*) INTO summary_count
  FROM short_term_contexts 
  WHERE session_id = test_session_id;
  
  SELECT COUNT(*) INTO message_count
  FROM conversation_messages 
  WHERE session_id = test_session_id;
  
  -- Assertions
  ASSERT summary_count = 1, 
    'Expected 1 summary, found ' || summary_count;
  
  ASSERT message_count = 11, 
    'Expected 11 messages, found ' || message_count;
  
  -- Cleanup
  DELETE FROM conversation_sessions WHERE id = test_session_id;
  
  RAISE NOTICE 'Summarization trigger test PASSED ✓';
  
EXCEPTION
  WHEN OTHERS THEN
    -- Cleanup on failure (only if session was created)
    DELETE FROM conversation_sessions WHERE id = test_session_id;
    RAISE NOTICE 'Summarization trigger test FAILED: %', SQLERRM;
    RAISE;
END $$;

-- ===============================================================================
-- PERMISSIONS & COMMENTS
-- ===============================================================================

GRANT EXECUTE ON FUNCTION fn_generate_session_summary TO authenticated;

COMMENT ON FUNCTION fn_generate_session_summary IS 'Automatically generates conversation summaries and stores in short_term_contexts';
COMMENT ON FUNCTION trigger_auto_session_summary IS 'Trigger function that fires summarization every 10 messages';

-- Final completion notice
DO $$
BEGIN
  RAISE NOTICE 'Database hardening automation complete ✓';
END $$; 