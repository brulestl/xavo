-- Step 1: Add Session-Level "Last File" Pointer
-- Migration to add last_file_id column to conversation_sessions table

-- Add nullable column last_file_id to conversation_sessions, referencing user_files(id)
ALTER TABLE conversation_sessions 
ADD COLUMN last_file_id UUID REFERENCES user_files(id) ON DELETE SET NULL;

-- Add index for performance on last_file_id lookups
CREATE INDEX idx_conversation_sessions_last_file_id ON conversation_sessions(last_file_id);

-- Add comment for documentation
COMMENT ON COLUMN conversation_sessions.last_file_id IS 'Points to the most recently uploaded file in this session for fallback queries'; 