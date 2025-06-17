-- Create a Supabase RPC function to generate AI prompts
-- This function will be called from the Expo app via the REST API

CREATE OR REPLACE FUNCTION generate_ai_prompts(
  context TEXT,
  count INTEGER DEFAULT 5
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  user_profile RECORD;
  system_prompt TEXT;
  user_prompt TEXT;
  ai_response TEXT;
  prompts_array JSON;
  fallback_prompts JSON;
BEGIN
  -- Get the current user ID from the JWT token
  user_id := auth.uid();
  
  -- If no user is authenticated, return fallback prompts
  IF user_id IS NULL THEN
    fallback_prompts := '[
      "How can I build stronger relationships with key stakeholders?",
      "What''s the best way to present ideas to senior leadership?",
      "How do I navigate competing priorities effectively?",
      "What strategies help me influence without authority?",
      "How can I improve my executive presence in meetings?"
    ]'::JSON;
    
    RETURN json_build_object('prompts', fallback_prompts);
  END IF;

  -- Get user personalization data
  SELECT 
    current_position,
    primary_function,
    top_challenges,
    personality_scores,
    preferred_coaching_style
  INTO user_profile
  FROM user_personalization
  WHERE user_personalization.user_id = generate_ai_prompts.user_id;

  -- Build system prompt based on user data
  system_prompt := 'You are a corporate influence coach. Generate coaching prompt suggestions based on the following user profile:' || E'\n';
  
  IF user_profile.current_position IS NOT NULL THEN
    system_prompt := system_prompt || 'Role: ' || user_profile.current_position || E'\n';
  END IF;
  
  IF user_profile.primary_function IS NOT NULL THEN
    system_prompt := system_prompt || 'Function: ' || user_profile.primary_function || E'\n';
  END IF;
  
  IF user_profile.top_challenges IS NOT NULL AND array_length(user_profile.top_challenges, 1) > 0 THEN
    system_prompt := system_prompt || 'Challenges: ' || array_to_string(user_profile.top_challenges, ', ') || E'\n';
  END IF;
  
  IF user_profile.personality_scores IS NOT NULL THEN
    system_prompt := system_prompt || 'Personality scores: ' || user_profile.personality_scores::TEXT || E'\n';
  END IF;
  
  IF user_profile.preferred_coaching_style IS NOT NULL THEN
    system_prompt := system_prompt || 'Preferred coaching style: ' || user_profile.preferred_coaching_style || E'\n';
  END IF;

  system_prompt := system_prompt || 
    'Generate exactly ' || count || ' concise, actionable coaching prompt suggestions.' || E'\n' ||
    'Each prompt should be a question that helps the user develop their corporate influence skills.' || E'\n' ||
    'Return the response as a JSON array of strings, like: ["Prompt 1", "Prompt 2", ...]' || E'\n' ||
    'Focus on practical, specific questions they can act on immediately.';

  user_prompt := 'Context: ' || context || E'\n\nPlease generate ' || count || ' personalized coaching prompts for this user.';

  -- Note: This is a placeholder for the actual OpenAI API call
  -- In a real implementation, you would need to use an HTTP extension or external service
  -- For now, we'll return contextual fallback prompts based on user data
  
  -- Generate contextual prompts based on user profile
  prompts_array := CASE 
    WHEN user_profile.current_position ILIKE '%manager%' OR user_profile.current_position ILIKE '%director%' THEN
      '[
        "How can I delegate more effectively while maintaining quality standards?",
        "What strategies help me motivate my team during challenging times?",
        "How do I balance being approachable with maintaining authority?",
        "What''s the best way to give constructive feedback to senior team members?",
        "How can I better align my team''s goals with organizational objectives?"
      ]'::JSON
    WHEN user_profile.primary_function ILIKE '%sales%' OR user_profile.primary_function ILIKE '%business%' THEN
      '[
        "How can I build stronger relationships with key clients?",
        "What techniques help me handle objections more effectively?",
        "How do I position myself as a trusted advisor rather than just a vendor?",
        "What''s the best approach to negotiating win-win outcomes?",
        "How can I leverage social proof to strengthen my proposals?"
      ]'::JSON
    WHEN user_profile.primary_function ILIKE '%marketing%' OR user_profile.primary_function ILIKE '%product%' THEN
      '[
        "How can I better communicate the value of my initiatives to stakeholders?",
        "What strategies help me gain buy-in for innovative ideas?",
        "How do I influence cross-functional teams without direct authority?",
        "What''s the best way to present data-driven insights to executives?",
        "How can I build stronger partnerships with other departments?"
      ]'::JSON
    ELSE
      '[
        "How can I build stronger relationships with key stakeholders?",
        "What''s the best way to present ideas to senior leadership?",
        "How do I navigate competing priorities effectively?",
        "What strategies help me influence without authority?",
        "How can I improve my executive presence in meetings?"
      ]'::JSON
  END;

  -- Return the prompts array
  RETURN json_build_object('prompts', prompts_array);

EXCEPTION
  WHEN OTHERS THEN
    -- Return fallback prompts on any error
    fallback_prompts := '[
      "How can I build stronger relationships with key stakeholders?",
      "What''s the best way to present ideas to senior leadership?",
      "How do I navigate competing priorities effectively?",
      "What strategies help me influence without authority?",
      "How can I improve my executive presence in meetings?"
    ]'::JSON;
    
    RETURN json_build_object('prompts', fallback_prompts);
END;
$$; 