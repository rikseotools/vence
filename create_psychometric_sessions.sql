-- Create psychometric_test_sessions table
CREATE TABLE IF NOT EXISTS psychometric_test_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    configuration jsonb NOT NULL DEFAULT '{}',
    total_questions integer NOT NULL DEFAULT 0,
    current_question_index integer NOT NULL DEFAULT 0,
    questions_order jsonb NOT NULL DEFAULT '[]',
    start_time timestamp with time zone DEFAULT now(),
    end_time timestamp with time zone,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create RLS policies for psychometric_test_sessions
ALTER TABLE psychometric_test_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
CREATE POLICY "Users can view own psychometric sessions" ON psychometric_test_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can insert own psychometric sessions" ON psychometric_test_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update own psychometric sessions" ON psychometric_test_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_psychometric_sessions_user_id ON psychometric_test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_sessions_status ON psychometric_test_sessions(status);
