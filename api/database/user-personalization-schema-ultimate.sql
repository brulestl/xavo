-- User Personalization Schema (Ultimate Safe Version)
-- This file contains the user_personalization table and related functions
-- Handles all possible function signature conflicts

-- Create user_personalization table
CREATE TABLE IF NOT EXISTS user_personalization (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_position TEXT,
  company_size TEXT,
  primary_function TEXT,
  top_challenges TEXT[],
  preferred_coaching_style TEXT,
  onboarding_status TEXT DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed')),
  personality_scores JSONB,
  tier TEXT DEFAULT 'free',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create onboarding_answers table for storing quiz responses
CREATE TABLE IF NOT EXISTS onboarding_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer_value TEXT,
  answer_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_personalization_user_id ON user_personalization(user_id);
CREATE INDEX IF NOT EXISTS idx_user_personalization_onboarding_status ON user_personalization(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_onboarding_answers_user_id ON onboarding_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_answers_question_id ON onboarding_answers(question_id);

-- Enable RLS
ALTER TABLE user_personalization ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view their own personalization" ON user_personalization;
DROP POLICY IF EXISTS "Users can insert their own personalization" ON user_personalization;
DROP POLICY IF EXISTS "Users can update their own personalization" ON user_personalization;

DROP POLICY IF EXISTS "Users can view their own answers" ON onboarding_answers;
DROP POLICY IF EXISTS "Users can insert their own answers" ON onboarding_answers;
DROP POLICY IF EXISTS "Users can update their own answers" ON onboarding_answers;

-- RLS policies for user_personalization
CREATE POLICY "Users can view their own personalization" ON user_personalization
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personalization" ON user_personalization
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personalization" ON user_personalization
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for onboarding_answers
CREATE POLICY "Users can view their own answers" ON onboarding_answers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own answers" ON onboarding_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own answers" ON onboarding_answers
  FOR UPDATE USING (auth.uid() = user_id);

-- Drop ALL possible function signatures (comprehensive cleanup)
DO $$
BEGIN
    -- Drop all possible variations of fn_insert_or_update_personalization
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT, TEXT);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT, TEXT, TEXT);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT, TEXT, TEXT, TEXT[]);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, JSONB);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, JSONB, TEXT);
    DROP FUNCTION IF EXISTS fn_insert_or_update_personalization(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, JSONB, TEXT, JSONB);
    
    -- Drop all possible variations of fn_calculate_personality_scores
    DROP FUNCTION IF EXISTS fn_calculate_personality_scores(UUID);
    DROP FUNCTION IF EXISTS fn_calculate_personality_scores(TEXT);
    
    RAISE NOTICE 'All function variations dropped successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some functions may not have existed: %', SQLERRM;
END $$;

-- Function to insert or update user personalization
CREATE FUNCTION fn_insert_or_update_personalization(
  p_user_id UUID,
  p_current_position TEXT DEFAULT NULL,
  p_company_size TEXT DEFAULT NULL,
  p_primary_function TEXT DEFAULT NULL,
  p_top_challenges TEXT[] DEFAULT NULL,
  p_preferred_coaching_style TEXT DEFAULT NULL,
  p_onboarding_status TEXT DEFAULT NULL,
  p_personality_scores JSONB DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Insert or update user personalization
  INSERT INTO user_personalization (
    user_id,
    current_position,
    company_size,
    primary_function,
    top_challenges,
    preferred_coaching_style,
    onboarding_status,
    personality_scores,
    tier,
    metadata,
    updated_at
  ) VALUES (
    p_user_id,
    COALESCE(p_current_position, (SELECT current_position FROM user_personalization WHERE user_id = p_user_id)),
    COALESCE(p_company_size, (SELECT company_size FROM user_personalization WHERE user_id = p_user_id)),
    COALESCE(p_primary_function, (SELECT primary_function FROM user_personalization WHERE user_id = p_user_id)),
    COALESCE(p_top_challenges, (SELECT top_challenges FROM user_personalization WHERE user_id = p_user_id)),
    COALESCE(p_preferred_coaching_style, (SELECT preferred_coaching_style FROM user_personalization WHERE user_id = p_user_id)),
    COALESCE(p_onboarding_status, (SELECT onboarding_status FROM user_personalization WHERE user_id = p_user_id)),
    COALESCE(p_personality_scores, (SELECT personality_scores FROM user_personalization WHERE user_id = p_user_id)),
    COALESCE(p_tier, (SELECT tier FROM user_personalization WHERE user_id = p_user_id)),
    COALESCE(p_metadata, (SELECT metadata FROM user_personalization WHERE user_id = p_user_id)),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_position = COALESCE(EXCLUDED.current_position, user_personalization.current_position),
    company_size = COALESCE(EXCLUDED.company_size, user_personalization.company_size),
    primary_function = COALESCE(EXCLUDED.primary_function, user_personalization.primary_function),
    top_challenges = COALESCE(EXCLUDED.top_challenges, user_personalization.top_challenges),
    preferred_coaching_style = COALESCE(EXCLUDED.preferred_coaching_style, user_personalization.preferred_coaching_style),
    onboarding_status = COALESCE(EXCLUDED.onboarding_status, user_personalization.onboarding_status),
    personality_scores = COALESCE(EXCLUDED.personality_scores, user_personalization.personality_scores),
    tier = COALESCE(EXCLUDED.tier, user_personalization.tier),
    metadata = COALESCE(EXCLUDED.metadata, user_personalization.metadata),
    updated_at = NOW()
  RETURNING user_id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

-- Function to calculate personality scores from answers
CREATE FUNCTION fn_calculate_personality_scores(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scores JSONB := '{}';
  v_assertiveness NUMERIC := 0;
  v_strategic NUMERIC := 0;
  v_adaptability NUMERIC := 0;
  v_empathy NUMERIC := 0;
  v_conscientiousness NUMERIC := 0;
  v_integrity NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  -- Calculate scores based on personality quiz answers
  -- Assertiveness (Q1-Q4)
  SELECT COALESCE(AVG(answer_value::INTEGER), 0) INTO v_assertiveness
  FROM onboarding_answers 
  WHERE user_id = p_user_id 
    AND question_id IN ('Q1', 'Q2', 'Q3', 'Q4');

  -- Strategic Thinking (Q5-Q8)
  SELECT COALESCE(AVG(answer_value::INTEGER), 0) INTO v_strategic
  FROM onboarding_answers 
  WHERE user_id = p_user_id 
    AND question_id IN ('Q5', 'Q6', 'Q7', 'Q8');

  -- Adaptability (Q9-Q12)
  SELECT COALESCE(AVG(answer_value::INTEGER), 0) INTO v_adaptability
  FROM onboarding_answers 
  WHERE user_id = p_user_id 
    AND question_id IN ('Q9', 'Q10', 'Q11', 'Q12');

  -- Empathy (Q13-Q16)
  SELECT COALESCE(AVG(answer_value::INTEGER), 0) INTO v_empathy
  FROM onboarding_answers 
  WHERE user_id = p_user_id 
    AND question_id IN ('Q13', 'Q14', 'Q15', 'Q16');

  -- Conscientiousness (Q17-Q20)
  SELECT COALESCE(AVG(answer_value::INTEGER), 0) INTO v_conscientiousness
  FROM onboarding_answers 
  WHERE user_id = p_user_id 
    AND question_id IN ('Q17', 'Q18', 'Q19', 'Q20');

  -- Integrity (Q21-Q24)
  SELECT COALESCE(AVG(answer_value::INTEGER), 0) INTO v_integrity
  FROM onboarding_answers 
  WHERE user_id = p_user_id 
    AND question_id IN ('Q21', 'Q22', 'Q23', 'Q24');

  -- Build scores JSON
  v_scores := jsonb_build_object(
    'assertiveness', v_assertiveness,
    'strategic', v_strategic,
    'adaptability', v_adaptability,
    'empathy', v_empathy,
    'conscientiousness', v_conscientiousness,
    'integrity', v_integrity
  );

  RETURN v_scores;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fn_insert_or_update_personalization TO authenticated;
GRANT EXECUTE ON FUNCTION fn_calculate_personality_scores TO authenticated;

-- Comments
COMMENT ON TABLE user_personalization IS 'User personalization data including personality scores and onboarding status';
COMMENT ON TABLE onboarding_answers IS 'User responses to onboarding and personality quiz questions';
COMMENT ON FUNCTION fn_insert_or_update_personalization IS 'Upserts user personalization data';
COMMENT ON FUNCTION fn_calculate_personality_scores IS 'Calculates personality trait scores from quiz answers';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'User personalization schema setup completed successfully!';
END $$; 