-- Seed script for personality quiz questions
-- This script inserts the 24 personality assessment questions into the onboarding_questions table

-- First, let's create the onboarding_questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS onboarding_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_code TEXT NOT NULL UNIQUE,
  question_type TEXT NOT NULL CHECK (question_type IN ('personalization', 'personality')),
  prompt TEXT NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('single-select', 'multi-select', 'likert')),
  choices TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clear existing personality questions to avoid duplicates
DELETE FROM onboarding_questions WHERE question_type = 'personality';

-- Insert the 24 personality assessment questions
INSERT INTO onboarding_questions (question_code, question_type, prompt, input_type, choices, metadata, display_order) VALUES

-- Assertiveness (Q1-Q4)
('Q1', 'personality', 'I''m comfortable pushing back on higher-ups when I believe I''m right.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "assertiveness", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 1),

('Q2', 'personality', 'I enjoy taking the lead in group discussions.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "assertiveness", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 2),

('Q3', 'personality', 'I can negotiate for what I want without feeling uneasy.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "assertiveness", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 3),

('Q4', 'personality', 'Speaking in front of senior leadership energizes me.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "assertiveness", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 4),

-- Strategic Thinking (Q5-Q8)
('Q5', 'personality', 'I quickly see patterns others miss in complex situations.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "strategic", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 5),

('Q6', 'personality', 'I often think several moves ahead before acting.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "strategic", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 6),

('Q7', 'personality', 'I can map out multiple paths to the same goal.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "strategic", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 7),

('Q8', 'personality', 'I like analyzing power dynamics inside my organization.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "strategic", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 8),

-- Adaptability (Q9-Q12)
('Q9', 'personality', 'Sudden changes at work rarely throw me off course.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "adaptability", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 9),

('Q10', 'personality', 'I can stay calm when priorities shift unexpectedly.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "adaptability", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 10),

('Q11', 'personality', 'I adjust my communication style to match different audiences.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "adaptability", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 11),

('Q12', 'personality', 'I view setbacks as opportunities to learn.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "adaptability", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 12),

-- Empathy (Q13-Q16)
('Q13', 'personality', 'I sense when colleagues are uncomfortable even if they don''t say so.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "empathy", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 13),

('Q14', 'personality', 'People often come to me for advice on interpersonal issues.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "empathy", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 14),

('Q15', 'personality', 'I pay close attention to non-verbal cues in meetings.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "empathy", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 15),

('Q16', 'personality', 'I modify my arguments based on what matters to the listener.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "empathy", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 16),

-- Conscientiousness (Q17-Q20)
('Q17', 'personality', 'I double-check details to ensure my work is error-free.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "conscientiousness", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 17),

('Q18', 'personality', 'I keep promises, even under tight deadlines.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "conscientiousness", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 18),

('Q19', 'personality', 'I plan my day to make steady progress on long-term goals.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "conscientiousness", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 19),

('Q20', 'personality', 'Others describe me as reliable and well-prepared.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "conscientiousness", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 20),

-- Integrity (Q21-Q24)
('Q21', 'personality', 'I refuse to win by bending ethical rules.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "integrity", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 21),

('Q22', 'personality', 'I''m transparent about my intentions with teammates.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "integrity", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 22),

('Q23', 'personality', 'I own up to my mistakes immediately.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "integrity", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 23),

('Q24', 'personality', 'I''d rather lose an argument than mislead someone.', 'likert', 
 ARRAY['1', '2', '3', '4', '5'], 
 '{"trait": "integrity", "scale_labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}', 
 24);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_onboarding_questions_type_order ON onboarding_questions(question_type, display_order);

-- Verify the insert
SELECT 
  question_code, 
  prompt, 
  metadata->>'trait' as trait,
  display_order 
FROM onboarding_questions 
WHERE question_type = 'personality' 
ORDER BY display_order; 