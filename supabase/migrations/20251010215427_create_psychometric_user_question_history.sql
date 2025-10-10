-- Create the missing psychometric_user_question_history table
CREATE TABLE IF NOT EXISTS psychometric_user_question_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  attempts INTEGER DEFAULT 1,
  correct_attempts INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  personal_difficulty NUMERIC,
  first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trend TEXT DEFAULT 'stable',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, question_id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES psychometric_questions(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_psychometric_user_history_user ON psychometric_user_question_history(user_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_user_history_question ON psychometric_user_question_history(question_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_user_history_difficulty ON psychometric_user_question_history(personal_difficulty);

-- Enable Row Level Security
ALTER TABLE psychometric_user_question_history ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view their own question history" ON psychometric_user_question_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage question history" ON psychometric_user_question_history
  FOR ALL USING (true);

-- Add table comment
COMMENT ON TABLE psychometric_user_question_history IS 'Historial personal de cada usuario con cada pregunta psicotécnica para dificultad adaptativa';