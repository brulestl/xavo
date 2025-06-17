-- Create a Supabase RPC function to generate quiz summaries
-- This function will be called from the Expo app after quiz completion

CREATE OR REPLACE FUNCTION generate_quiz_summary(
  user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  user_profile RECORD;
  quiz_answer_count INTEGER;
  context_parts TEXT[];
  context_text TEXT;
  summary_text TEXT;
  fallback_summary TEXT;
BEGIN
  -- Get the user ID (from parameter or JWT token)
  target_user_id := COALESCE(user_id, auth.uid());
  
  -- If no user is identified, return error
  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'error', 'User authentication required',
      'summary', 'Professional seeking to enhance corporate influence and leadership skills.'
    );
  END IF;

  -- Get user personalization data
  SELECT 
    current_position,
    primary_function,
    top_challenges,
    personality_scores,
    preferred_coaching_style,
    company_size,
    tier
  INTO user_profile
  FROM user_personalization
  WHERE user_personalization.user_id = target_user_id;

  -- Get quiz answer count (simpler approach)
  SELECT COUNT(*)
  INTO quiz_answer_count
  FROM onboarding_answers 
  WHERE onboarding_answers.user_id = target_user_id;

  -- Build context parts array
  context_parts := ARRAY[]::TEXT[];

  -- Add personalization data
  IF user_profile.current_position IS NOT NULL THEN
    context_parts := array_append(context_parts, 'Role: ' || user_profile.current_position);
  END IF;
  
  IF user_profile.primary_function IS NOT NULL THEN
    context_parts := array_append(context_parts, 'Function: ' || user_profile.primary_function);
  END IF;
  
  IF user_profile.company_size IS NOT NULL THEN
    context_parts := array_append(context_parts, 'Company Size: ' || user_profile.company_size);
  END IF;
  
  IF user_profile.top_challenges IS NOT NULL AND array_length(user_profile.top_challenges, 1) > 0 THEN
    context_parts := array_append(context_parts, 'Challenges: ' || array_to_string(user_profile.top_challenges, ', '));
  END IF;
  
  IF user_profile.preferred_coaching_style IS NOT NULL THEN
    context_parts := array_append(context_parts, 'Coaching Style: ' || user_profile.preferred_coaching_style);
  END IF;

  -- Add personality scores summary
  IF user_profile.personality_scores IS NOT NULL THEN
    -- Extract top 3 personality traits
    WITH trait_scores AS (
      SELECT key as trait, value::numeric as score
      FROM json_each_text(user_profile.personality_scores)
      WHERE value::numeric > 0
      ORDER BY value::numeric DESC
      LIMIT 3
    )
    SELECT string_agg(trait || ': ' || score::text, ', ')
    INTO summary_text
    FROM trait_scores;
    
    IF summary_text IS NOT NULL THEN
      context_parts := array_append(context_parts, 'Top Traits: ' || summary_text);
    END IF;
  END IF;

  -- Add quiz responses summary (limit to avoid too much text)
  IF quiz_answer_count > 0 THEN
    context_parts := array_append(context_parts, 'Quiz Responses: ' || quiz_answer_count::text || ' questions completed');
  END IF;

  -- Join context parts
  context_text := array_to_string(context_parts, E'\n');

  -- Generate contextual summary based on available data
  -- Since we can't call OpenAI directly from Supabase, we'll create intelligent summaries
  -- based on the user's profile data
  
  summary_text := CASE 
    -- Manager/Director profiles
    WHEN user_profile.current_position ILIKE '%manager%' OR user_profile.current_position ILIKE '%director%' OR user_profile.current_position ILIKE '%lead%' THEN
      CASE 
        WHEN user_profile.primary_function ILIKE '%sales%' THEN
          user_profile.current_position || ' in ' || user_profile.primary_function || ' focused on team leadership, client relationships, and revenue growth through strategic influence.'
        WHEN user_profile.primary_function ILIKE '%marketing%' THEN
          user_profile.current_position || ' in ' || user_profile.primary_function || ' developing cross-functional leadership skills and stakeholder alignment for campaign success.'
        WHEN user_profile.primary_function ILIKE '%operations%' OR user_profile.primary_function ILIKE '%product%' THEN
          user_profile.current_position || ' in ' || user_profile.primary_function || ' building operational excellence through team influence and process optimization.'
        ELSE
          user_profile.current_position || ' developing advanced leadership capabilities, team motivation, and strategic decision-making skills.'
      END
    
    -- Individual contributor profiles
    WHEN user_profile.primary_function ILIKE '%sales%' THEN
      COALESCE(user_profile.current_position, 'Sales Professional') || ' focused on building client relationships, negotiation mastery, and consultative selling approaches.'
    
    WHEN user_profile.primary_function ILIKE '%marketing%' THEN
      COALESCE(user_profile.current_position, 'Marketing Professional') || ' developing stakeholder influence, creative persuasion, and cross-team collaboration skills.'
    
    WHEN user_profile.primary_function ILIKE '%engineering%' OR user_profile.primary_function ILIKE '%technical%' THEN
      COALESCE(user_profile.current_position, 'Technical Professional') || ' building technical leadership, cross-functional communication, and innovation influence skills.'
    
    WHEN user_profile.primary_function ILIKE '%finance%' OR user_profile.primary_function ILIKE '%accounting%' THEN
      COALESCE(user_profile.current_position, 'Finance Professional') || ' developing business partnership skills, data-driven persuasion, and strategic financial influence.'
    
    WHEN user_profile.primary_function ILIKE '%hr%' OR user_profile.primary_function ILIKE '%people%' THEN
      COALESCE(user_profile.current_position, 'HR Professional') || ' focused on organizational influence, change management, and people development strategies.'
    
    -- Generic professional profile
    ELSE
      COALESCE(user_profile.current_position, 'Professional') || 
      CASE 
        WHEN user_profile.primary_function IS NOT NULL THEN ' in ' || user_profile.primary_function
        ELSE ''
      END ||
      ' developing corporate influence, leadership presence, and strategic communication skills.'
  END;

  -- Add challenge focus if available
  IF user_profile.top_challenges IS NOT NULL AND array_length(user_profile.top_challenges, 1) > 0 THEN
    summary_text := summary_text || ' Key focus: ' || lower(user_profile.top_challenges[1]) || '.';
  END IF;

  -- Ensure summary is under 300 characters
  IF length(summary_text) > 300 THEN
    summary_text := left(summary_text, 297) || '...';
  END IF;

  -- Update the user_personalization table with the generated summary
  UPDATE user_personalization 
  SET 
    quiz_summary = summary_text,
    updated_at = NOW()
  WHERE user_personalization.user_id = target_user_id;

  -- Return the summary
  RETURN json_build_object('summary', summary_text);

EXCEPTION
  WHEN OTHERS THEN
    -- Generate fallback summary on any error
    fallback_summary := CASE 
      WHEN user_profile.current_position IS NOT NULL AND user_profile.primary_function IS NOT NULL THEN
        user_profile.current_position || ' in ' || user_profile.primary_function || ' seeking to develop corporate influence and leadership capabilities.'
      WHEN user_profile.current_position IS NOT NULL THEN
        user_profile.current_position || ' focused on enhancing corporate influence and strategic communication skills.'
      ELSE
        'Professional seeking to enhance corporate influence and leadership skills.'
    END;
    
    -- Ensure fallback is under 300 characters
    IF length(fallback_summary) > 300 THEN
      fallback_summary := left(fallback_summary, 297) || '...';
    END IF;
    
    -- Try to save fallback summary
    BEGIN
      UPDATE user_personalization 
      SET 
        quiz_summary = fallback_summary,
        updated_at = NOW()
      WHERE user_personalization.user_id = target_user_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Ignore save errors for fallback
        NULL;
    END;
    
    RETURN json_build_object(
      'summary', fallback_summary,
      'error', 'Generated fallback summary due to processing error'
    );
END;
$$; 