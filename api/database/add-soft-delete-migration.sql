-- ===============================================================================
-- SOFT DELETE MIGRATION - Corporate Influence Coach
-- Adds 30-day scheduled deletion for conversation sessions
-- ===============================================================================

-- Step 1: Add deleted_at column to conversation_sessions
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Step 2: Create index for deleted_at column for efficient querying
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_deleted_at 
ON conversation_sessions(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Step 3: Update the existing is_active index to be more efficient
DROP INDEX IF EXISTS idx_conversation_sessions_active;
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_active_not_deleted 
ON conversation_sessions(user_id, is_active, last_message_at DESC) 
WHERE is_active = true AND deleted_at IS NULL;

-- Step 4: Enhanced cleanup function with 30-day scheduled deletion
CREATE OR REPLACE FUNCTION cleanup_old_conversations(
  days_old INTEGER DEFAULT 30,
  batch_size INTEGER DEFAULT 100
)
RETURNS TABLE (
  sessions_deleted INTEGER,
  messages_deleted INTEGER,
  contexts_deleted INTEGER,
  cleanup_details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sessions_deleted INTEGER := 0;
  v_messages_deleted INTEGER := 0;
  v_contexts_deleted INTEGER := 0;
  v_session_ids UUID[];
  v_cleanup_details JSONB;
BEGIN
  -- Log cleanup start
  RAISE NOTICE 'Starting cleanup of conversations older than % days', days_old;
  
  -- Get sessions to delete (deleted_at is older than specified days)
  SELECT array_agg(id) INTO v_session_ids
  FROM conversation_sessions
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '1 day' * days_old
  LIMIT batch_size;
  
  -- Exit early if no sessions to delete
  IF v_session_ids IS NULL OR array_length(v_session_ids, 1) = 0 THEN
    RAISE NOTICE 'No sessions found for cleanup';
    RETURN QUERY SELECT 0, 0, 0, '{"message": "No sessions found for cleanup"}'::JSONB;
    RETURN;
  END IF;
  
  -- Delete short_term_contexts (will be deleted by CASCADE, but we count them)
  SELECT COUNT(*) INTO v_contexts_deleted
  FROM short_term_contexts
  WHERE session_id = ANY(v_session_ids);
  
  -- Delete conversation_messages (will be deleted by CASCADE, but we count them)
  SELECT COUNT(*) INTO v_messages_deleted
  FROM conversation_messages
  WHERE session_id = ANY(v_session_ids);
  
  -- Delete the sessions (CASCADE will handle related records)
  DELETE FROM conversation_sessions 
  WHERE id = ANY(v_session_ids);
  
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;
  
  -- Build cleanup details
  v_cleanup_details := jsonb_build_object(
    'cleanup_timestamp', NOW(),
    'sessions_processed', v_sessions_deleted,
    'messages_processed', v_messages_deleted,
    'contexts_processed', v_contexts_deleted,
    'batch_size', batch_size,
    'retention_days', days_old
  );
  
  RAISE NOTICE 'Cleanup completed: % sessions, % messages, % contexts deleted', 
    v_sessions_deleted, v_messages_deleted, v_contexts_deleted;
  
  RETURN QUERY SELECT v_sessions_deleted, v_messages_deleted, v_contexts_deleted, v_cleanup_details;
END;
$$;

-- Step 5: Function to soft delete a conversation session
CREATE OR REPLACE FUNCTION soft_delete_session(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update the session to mark it as deleted
  UPDATE conversation_sessions 
  SET 
    deleted_at = NOW(),
    is_active = false,
    updated_at = NOW()
  WHERE id = p_session_id 
    AND user_id = p_user_id 
    AND deleted_at IS NULL; -- Prevent double deletion
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Return true if session was found and updated
  RETURN v_updated_count > 0;
END;
$$;

-- Step 6: Function to restore a soft-deleted session (useful for undelete feature)
CREATE OR REPLACE FUNCTION restore_deleted_session(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Restore the session if it was soft-deleted within 30 days
  UPDATE conversation_sessions 
  SET 
    deleted_at = NULL,
    is_active = true,
    updated_at = NOW()
  WHERE id = p_session_id 
    AND user_id = p_user_id 
    AND deleted_at IS NOT NULL
    AND deleted_at > NOW() - INTERVAL '30 days'; -- Only restore if within 30 days
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count > 0;
END;
$$;

-- Step 7: Function to get sessions scheduled for deletion (for admin purposes)
CREATE OR REPLACE FUNCTION get_sessions_scheduled_for_deletion(
  p_user_id UUID DEFAULT NULL,
  p_days_remaining INTEGER DEFAULT 30
)
RETURNS TABLE (
  session_id UUID,
  user_id UUID,
  title TEXT,
  deleted_at TIMESTAMPTZ,
  scheduled_deletion_date TIMESTAMPTZ,
  days_until_deletion INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.user_id,
    cs.title,
    cs.deleted_at,
    cs.deleted_at + INTERVAL '30 days' AS scheduled_deletion_date,
    EXTRACT(DAYS FROM (cs.deleted_at + INTERVAL '30 days' - NOW()))::INTEGER AS days_until_deletion
  FROM conversation_sessions cs
  WHERE cs.deleted_at IS NOT NULL
    AND cs.deleted_at > NOW() - INTERVAL '30 days' -- Still within 30-day window
    AND (p_user_id IS NULL OR cs.user_id = p_user_id)
    AND (p_days_remaining IS NULL OR 
         EXTRACT(DAYS FROM (cs.deleted_at + INTERVAL '30 days' - NOW())) <= p_days_remaining)
  ORDER BY cs.deleted_at ASC;
END;
$$;

-- Step 8: Create a cleanup log table to track cleanup operations
CREATE TABLE IF NOT EXISTS conversation_cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sessions_deleted INTEGER NOT NULL DEFAULT 0,
  messages_deleted INTEGER NOT NULL DEFAULT 0,
  contexts_deleted INTEGER NOT NULL DEFAULT 0,
  retention_days INTEGER NOT NULL,
  batch_size INTEGER NOT NULL,
  execution_time_ms INTEGER,
  details JSONB
);

-- Step 9: Enhanced cleanup function that logs operations
CREATE OR REPLACE FUNCTION cleanup_old_conversations_with_logging(
  days_old INTEGER DEFAULT 30,
  batch_size INTEGER DEFAULT 100
)
RETURNS TABLE (
  sessions_deleted INTEGER,
  messages_deleted INTEGER,
  contexts_deleted INTEGER,
  cleanup_details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time TIMESTAMP := clock_timestamp();
  v_sessions_deleted INTEGER := 0;
  v_messages_deleted INTEGER := 0;
  v_contexts_deleted INTEGER := 0;
  v_session_ids UUID[];
  v_cleanup_details JSONB;
  v_execution_time INTEGER;
BEGIN
  -- Get sessions to delete
  SELECT array_agg(id) INTO v_session_ids
  FROM conversation_sessions
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '1 day' * days_old
  LIMIT batch_size;
  
  IF v_session_ids IS NULL OR array_length(v_session_ids, 1) = 0 THEN
    v_cleanup_details := '{"message": "No sessions found for cleanup"}'::JSONB;
  ELSE
    -- Count related records before deletion
    SELECT COUNT(*) INTO v_contexts_deleted
    FROM short_term_contexts
    WHERE session_id = ANY(v_session_ids);
    
    SELECT COUNT(*) INTO v_messages_deleted
    FROM conversation_messages
    WHERE session_id = ANY(v_session_ids);
    
    -- Delete the sessions
    DELETE FROM conversation_sessions 
    WHERE id = ANY(v_session_ids);
    
    GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;
    
    v_cleanup_details := jsonb_build_object(
      'cleanup_timestamp', NOW(),
      'sessions_processed', v_sessions_deleted,
      'messages_processed', v_messages_deleted,
      'contexts_processed', v_contexts_deleted,
      'session_ids', v_session_ids
    );
  END IF;
  
  -- Calculate execution time
  v_execution_time := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time);
  
  -- Log the cleanup operation
  INSERT INTO conversation_cleanup_log (
    cleanup_timestamp,
    sessions_deleted,
    messages_deleted,
    contexts_deleted,
    retention_days,
    batch_size,
    execution_time_ms,
    details
  ) VALUES (
    NOW(),
    v_sessions_deleted,
    v_messages_deleted,
    v_contexts_deleted,
    days_old,
    batch_size,
    v_execution_time,
    v_cleanup_details
  );
  
  RETURN QUERY SELECT v_sessions_deleted, v_messages_deleted, v_contexts_deleted, v_cleanup_details;
END;
$$;

-- Step 10: Grant permissions
GRANT EXECUTE ON FUNCTION soft_delete_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_deleted_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sessions_scheduled_for_deletion(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_conversations(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_conversations_with_logging(INTEGER, INTEGER) TO authenticated;

-- Step 11: Create a view for active sessions (excluding deleted ones)
CREATE OR REPLACE VIEW active_conversation_sessions AS
SELECT 
  id,
  user_id,
  title,
  summary,
  last_message_at,
  created_at,
  message_count,
  is_active,
  metadata,
  updated_at
FROM conversation_sessions
WHERE deleted_at IS NULL;

-- Grant permissions on the view
GRANT SELECT ON active_conversation_sessions TO authenticated;

-- Step 12: Display migration status
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ Soft Delete Migration Completed Successfully!';
  RAISE NOTICE '✅ Added deleted_at column to conversation_sessions';
  RAISE NOTICE '✅ Created soft delete functions';
  RAISE NOTICE '✅ Created cleanup functions with logging';
  RAISE NOTICE '✅ Created active_conversation_sessions view';
  RAISE NOTICE '✅ 30-day scheduled deletion system is ready';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '- To soft delete: SELECT soft_delete_session(session_id, user_id);';
  RAISE NOTICE '- To restore: SELECT restore_deleted_session(session_id, user_id);';
  RAISE NOTICE '- To cleanup: SELECT * FROM cleanup_old_conversations_with_logging();';
  RAISE NOTICE '- To view scheduled deletions: SELECT * FROM get_sessions_scheduled_for_deletion();';
END $$; 