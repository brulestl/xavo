/**
 * Test current database schema to see what exists
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCurrentSchema() {
  console.log('🔍 Checking Current Database Schema...\n');

  try {
    // Check conversation_messages columns
    console.log('📋 conversation_messages table:');
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select('*')
      .limit(1);

    if (msgError) {
      console.log('❌ conversation_messages table not accessible:', msgError.message);
    } else {
      console.log('✅ conversation_messages table exists');
      
      // Check what columns exist by trying to select them
      const testColumns = ['raw_response', 'message_timestamp'];
      for (const col of testColumns) {
        try {
          await supabase
            .from('conversation_messages')
            .select(col)
            .limit(1);
          console.log(`✅ Column '${col}' exists`);
        } catch (err) {
          console.log(`❌ Column '${col}' missing`);
        }
      }
    }

    console.log('');

    // Check short_term_contexts table
    console.log('📋 short_term_contexts table:');
    const { data: contexts, error: ctxError } = await supabase
      .from('short_term_contexts')
      .select('*')
      .limit(1);

    if (ctxError) {
      console.log('❌ short_term_contexts table not accessible:', ctxError.message);
    } else {
      console.log('✅ short_term_contexts table exists');
      
      // Check what columns exist
      const testCtxColumns = ['context_embedding', 'summary_embedding'];
      for (const col of testCtxColumns) {
        try {
          await supabase
            .from('short_term_contexts')
            .select(col)
            .limit(1);
          console.log(`✅ Column '${col}' exists`);
        } catch (err) {
          console.log(`❌ Column '${col}' missing`);
        }
      }
    }

    console.log('\n🎯 Schema Status Summary:');
    console.log('To add missing columns, run the following SQL in your Supabase SQL Editor:\n');

    console.log('```sql');
    console.log('-- Add missing columns to conversation_messages');
    console.log('ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS raw_response JSONB;');
    console.log('ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS message_timestamp TIMESTAMPTZ DEFAULT NOW();');
    console.log('');
    console.log('-- Update existing records to have message_timestamp');
    console.log('UPDATE conversation_messages SET message_timestamp = created_at WHERE message_timestamp IS NULL;');
    console.log('');
    console.log('-- Create indexes');
    console.log('CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON conversation_messages(message_timestamp DESC);');
    console.log('CREATE INDEX IF NOT EXISTS idx_conversation_messages_raw_response ON conversation_messages USING gin(raw_response);');
    console.log('```');

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

// Run the check
if (require.main === module) {
  checkCurrentSchema().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
}

module.exports = { checkCurrentSchema }; 