-- Enable RLS on psychometric_first_attempts if not already enabled
ALTER TABLE psychometric_first_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for psychometric_first_attempts
-- Policy: Users can view their own first attempts
CREATE POLICY "Users can view own first attempts" ON psychometric_first_attempts
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own first attempts
CREATE POLICY "Users can insert own first attempts" ON psychometric_first_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_first_attempts_user_question ON psychometric_first_attempts(user_id, question_id);
