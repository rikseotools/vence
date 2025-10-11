-- Create psychometric_user_question_history table
CREATE TABLE IF NOT EXISTS psychometric_user_question_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    last_answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answer_count INTEGER DEFAULT 1,
    correct_count INTEGER DEFAULT 0,
    total_time_spent INTEGER DEFAULT 0,
    last_was_correct BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, question_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_psychometric_user_question_history_user_id 
ON psychometric_user_question_history(user_id);

CREATE INDEX IF NOT EXISTS idx_psychometric_user_question_history_question_id 
ON psychometric_user_question_history(question_id);

CREATE INDEX IF NOT EXISTS idx_psychometric_user_question_history_last_answered 
ON psychometric_user_question_history(last_answered_at);

-- Enable RLS
ALTER TABLE psychometric_user_question_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own question history" 
ON psychometric_user_question_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own question history" 
ON psychometric_user_question_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own question history" 
ON psychometric_user_question_history FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_psychometric_user_question_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_psychometric_user_question_history_updated_at
    BEFORE UPDATE ON psychometric_user_question_history
    FOR EACH ROW
    EXECUTE FUNCTION update_psychometric_user_question_history_updated_at();
