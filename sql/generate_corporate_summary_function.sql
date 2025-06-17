-- Create a SQL function to generate and persist corporate summaries
-- This function builds the summary using the corporate template and saves it to user_personalization

-- 1) Drop the old function
DROP FUNCTION IF EXISTS public.generate_corporate_summary(uuid);

-- 2) Re-create it with the updated definition
CREATE FUNCTION public.generate_corporate_summary(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  up RECORD;
  s  TEXT;
  role             TEXT;
  company_size     TEXT;
  primary_function TEXT;
  challenges       TEXT;
  comm_style       TEXT;
  conflict_appr    TEXT;
  decision_making  TEXT;
  a_pct  INT; st_pct INT; ad_pct INT; e_pct INT; c_pct INT; i_pct INT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  SELECT * INTO up
    FROM public.user_personalization
   WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no personalization for %', p_user_id;
  END IF;

  role             := COALESCE(up.current_position,       'Professional');
  company_size     := COALESCE(up.company_size,           'mid-sized');
  primary_function := COALESCE(up.primary_function,       'their department');
  IF up.top_challenges IS NOT NULL 
     AND array_length(up.top_challenges,1)>0 THEN
    challenges := array_to_string(up.top_challenges[1:2], ', ');
  ELSE
    challenges := 'strategic communication and influence';
  END IF;

  comm_style      := COALESCE((up.metadata->'personalityAnswers')->>'communication_style', 'directly and clearly');
  conflict_appr   := COALESCE((up.metadata->'personalityAnswers')->>'conflict_approach',    'addressing issues head-on');
  decision_making := COALESCE((up.metadata->'personalityAnswers')->>'decision_making',     'data-driven analysis');

  a_pct  := ROUND(COALESCE((up.personality_scores->>'assertiveness')::numeric,0.5)*100);
  st_pct := ROUND(COALESCE((up.personality_scores->>'strategic')::numeric,0.5)*100);
  ad_pct := ROUND(COALESCE((up.personality_scores->>'adaptability')::numeric,0.5)*100);
  e_pct  := ROUND(COALESCE((up.personality_scores->>'empathy')::numeric,0.5)*100);
  c_pct  := ROUND(COALESCE((up.personality_scores->>'conscientiousness')::numeric,0.5)*100);
  i_pct  := ROUND(COALESCE((up.personality_scores->>'integrity')::numeric,0.5)*100);

  s := format(
    '%s in %s at a %s-person firm. Communication: %s. Conflict: %s. Decision-making: %s. '||
    'Personality scores: Assertiveness %s%%, Strategic %s%%, Adaptability %s%%, Empathy %s%%, '||
    'Conscientiousness %s%%, Integrity %s%%. Challenges: %s. '||
    'Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.',
    role, primary_function, company_size,
    comm_style, conflict_appr, decision_making,
    a_pct, st_pct, ad_pct, e_pct, c_pct, i_pct,
    challenges
  );

  IF length(s) > 500 THEN
    s := left(s,497) || '...';
  END IF;

  UPDATE public.user_personalization
  SET
    quiz_summary       = s,
    updated_at         = now()
  WHERE user_id = p_user_id;

  RETURN s;

EXCEPTION WHEN OTHERS THEN
  RETURN 'Professional focused on leadership, communication, and influence.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_corporate_summary(UUID) TO authenticated, anon; 