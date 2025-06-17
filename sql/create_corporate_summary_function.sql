-- Create a Supabase RPC function to generate corporate summaries
-- This function will be called from the Expo app after quiz completion

CREATE OR REPLACE FUNCTION generate_corporate_summary(
  user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  user_profile RECORD;
  corporate_summary TEXT;
  fallback_summary TEXT;
  
  -- Template variables
  role TEXT;
  company_size TEXT;
  primary_function TEXT;
  challenges TEXT;
  communication_style TEXT;
  conflict_approach TEXT;
  decision_making TEXT;
  
  -- Personality scores as percentages
  assertiveness INTEGER;
  strategic INTEGER;
  adaptability INTEGER;
  empathy INTEGER;
  conscientiousness INTEGER;
  integrity INTEGER;
BEGIN
  -- Get the user ID (from parameter or JWT token)
  target_user_id := COALESCE(user_id, auth.uid());
  
  -- If no user is identified, return error
  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'error', 'User authentication required',
      'summary', 'Professional in their department at a mid-sized firm. Communication: directly and clearly. Conflict: addressing issues head-on. Decision-making: data-driven analysis. Personality scores: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%. Challenges: strategic communication and influence. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.'
    );
  END IF;

  -- Get comprehensive user personalization data
  SELECT 
    current_position,
    primary_function,
    top_challenges,
    personality_scores,
    preferred_coaching_style,
    company_size,
    tier,
    metadata
  INTO user_profile
  FROM user_personalization
  WHERE user_personalization.user_id = target_user_id;

  -- Extract basic profile data with fallbacks
  role := COALESCE(user_profile.current_position, 'Professional');
  company_size := COALESCE(user_profile.company_size, 'mid-sized');
  primary_function := COALESCE(user_profile.primary_function, 'their department');
  
  -- Extract challenges (limit to first 2 for brevity)
  IF user_profile.top_challenges IS NOT NULL AND array_length(user_profile.top_challenges, 1) > 0 THEN
    challenges := array_to_string(user_profile.top_challenges[1:2], ', ');
  ELSE
    challenges := 'strategic communication and influence';
  END IF;

  -- Extract personality answers from metadata with fallbacks
  communication_style := COALESCE(
    user_profile.metadata->>'personalityAnswers'->>'communication_style',
    'directly and clearly'
  );
  
  conflict_approach := COALESCE(
    user_profile.metadata->>'personalityAnswers'->>'conflict_approach',
    'addressing issues head-on'
  );
  
  decision_making := COALESCE(
    user_profile.metadata->>'personalityAnswers'->>'decision_making',
    'data-driven analysis'
  );

  -- Extract personality scores and convert to percentages
  IF user_profile.personality_scores IS NOT NULL THEN
    assertiveness := ROUND(COALESCE((user_profile.personality_scores->>'assertiveness')::numeric, 0.5) * 100);
    strategic := ROUND(COALESCE((user_profile.personality_scores->>'strategic')::numeric, 0.5) * 100);
    adaptability := ROUND(COALESCE((user_profile.personality_scores->>'adaptability')::numeric, 0.5) * 100);
    empathy := ROUND(COALESCE((user_profile.personality_scores->>'empathy')::numeric, 0.5) * 100);
    conscientiousness := ROUND(COALESCE((user_profile.personality_scores->>'conscientiousness')::numeric, 0.5) * 100);
    integrity := ROUND(COALESCE((user_profile.personality_scores->>'integrity')::numeric, 0.5) * 100);
  ELSE
    -- Default scores if no personality data
    assertiveness := 50;
    strategic := 50;
    adaptability := 50;
    empathy := 50;
    conscientiousness := 50;
    integrity := 50;
  END IF;

  -- Generate corporate summary using the template
  corporate_summary := format(
    '%s in %s at a %s-person firm. Communication: %s. Conflict: %s. Decision-making: %s. Personality scores: Assertiveness %s%%, Strategic %s%%, Adaptability %s%%, Empathy %s%%, Conscientiousness %s%%, Integrity %s%%. Challenges: %s. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.',
    role,
    primary_function,
    company_size,
    communication_style,
    conflict_approach,
    decision_making,
    assertiveness,
    strategic,
    adaptability,
    empathy,
    conscientiousness,
    integrity,
    challenges
  );

  -- Ensure summary is under 500 characters
  IF length(corporate_summary) > 500 THEN
    corporate_summary := left(corporate_summary, 497) || '...';
  END IF;

  -- Update the user_personalization table with the generated summary
  UPDATE user_personalization 
  SET 
    quiz_summary = corporate_summary,
    updated_at = NOW()
  WHERE user_personalization.user_id = target_user_id;

  -- Return the summary
  RETURN json_build_object('summary', corporate_summary);

EXCEPTION
  WHEN OTHERS THEN
    -- Generate fallback summary on any error
    fallback_summary := format(
      '%s in %s at a %s-person firm. Communication: directly and clearly. Conflict: addressing issues head-on. Decision-making: data-driven analysis. Personality scores: Assertiveness 50%%, Strategic 50%%, Adaptability 50%%, Empathy 50%%, Conscientiousness 50%%, Integrity 50%%. Challenges: %s. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.',
      COALESCE(user_profile.current_position, 'Professional'),
      COALESCE(user_profile.primary_function, 'their department'),
      COALESCE(user_profile.company_size, 'mid-sized'),
      COALESCE(
        CASE 
          WHEN user_profile.top_challenges IS NOT NULL AND array_length(user_profile.top_challenges, 1) > 0 
          THEN array_to_string(user_profile.top_challenges[1:2], ', ')
          ELSE 'strategic communication and influence'
        END,
        'strategic communication and influence'
      )
    );
    
    -- Ensure fallback is under 500 characters
    IF length(fallback_summary) > 500 THEN
      fallback_summary := left(fallback_summary, 497) || '...';
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