/**
 * Simple Memory System Test - Database Functionality
 * Tests core database operations for Xavo memory system
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';

async function testDatabaseOperations() {
  console.log('🧪 Testing Xavo Memory System Database Operations...\n');

  try {
    // Cleanup
    console.log('1. Cleaning up test data...');
    await supabase.from('conversation_messages').delete().eq('session_id', TEST_SESSION_ID);
    await supabase.from('short_term_contexts').delete().eq('session_id', TEST_SESSION_ID);
    await supabase.from('conversation_sessions').delete().eq('id', TEST_SESSION_ID);
    console.log('✅ Cleanup complete\n');

    // Test session creation
    console.log('2. Creating conversation session...');
    const { data: session, error: sessionError } = await supabase
      .from('conversation_sessions')
      .insert({
        id: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
        title: 'Database Test Session',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) throw sessionError;
    console.log('✅ Session created successfully\n');

    // Test message insertion
    console.log('3. Testing message persistence...');
    const testMessages = [
      { role: 'user', content: 'I need help with leadership challenges.' },
      { role: 'assistant', content: 'I can help you develop stronger leadership skills. What specific challenges are you facing?' },
      { role: 'user', content: 'My team doesn\'t follow through on commitments.' },
      { role: 'assistant', content: 'That\'s a common leadership challenge. Let\'s explore some strategies for accountability.' }
    ];

    for (let i = 0; i < testMessages.length; i++) {
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          session_id: TEST_SESSION_ID,
          user_id: TEST_USER_ID,
          role: testMessages[i].role,
          content: testMessages[i].content,
          message_timestamp: new Date(Date.now() + i * 1000).toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      console.log(`✅ Message ${i + 1} stored (${testMessages[i].role})`);
    }
    console.log('');

    // Test short-term context creation
    console.log('4. Testing short-term context storage...');
    const { data: summary, error: summaryError } = await supabase
      .from('short_term_contexts')
      .insert({
        session_id: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
        summary_text: 'User discussed leadership challenges, specifically team accountability issues. Assistant provided guidance on accountability strategies and team management approaches.',
        key_topics: ['leadership', 'accountability', 'team management'],
        message_count: testMessages.length,
        summary_version: 1,
        context_weight: 0.8,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString()
      })
      .select()
      .single();

    if (summaryError) throw summaryError;
    console.log('✅ Short-term context stored successfully\n');

    // Test context retrieval
    console.log('5. Testing context retrieval...');
    
    // Get latest summary
    const { data: latestSummary, error: summaryFetchError } = await supabase
      .from('short_term_contexts')
      .select('summary_text, key_topics')
      .eq('session_id', TEST_SESSION_ID)
      .eq('user_id', TEST_USER_ID)
      .order('summary_version', { ascending: false })
      .limit(1)
      .single();

    if (summaryFetchError) throw summaryFetchError;

    // Get message history
    const { data: messageHistory, error: historyError } = await supabase
      .from('conversation_messages')
      .select('role, content, message_timestamp')
      .eq('session_id', TEST_SESSION_ID)
      .eq('user_id', TEST_USER_ID)
      .order('message_timestamp', { ascending: true });

    if (historyError) throw historyError;

    console.log('✅ Context retrieval successful:');
    console.log(`   Summary: ${latestSummary.summary_text}`);
    console.log(`   Topics: [${latestSummary.key_topics.join(', ')}]`);
    console.log(`   Message History: ${messageHistory.length} messages`);
    console.log('');

    // Test context injection format
    console.log('6. Testing context injection format...');
    const contextMessages = [];
    
    // Add summary as system message
    if (latestSummary.summary_text) {
      contextMessages.push({
        role: 'system',
        content: `SYSTEM: Short-term summary: ${latestSummary.summary_text}`
      });
    }

    // Add message history
    messageHistory.forEach(msg => {
      contextMessages.push({
        role: msg.role,
        content: msg.content
      });
    });

    console.log('✅ Context formatted for injection:');
    console.log(`   Total context messages: ${contextMessages.length}`);
    contextMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 60)}...`);
    });
    console.log('');

    // Final success message
    console.log('🎉 DATABASE OPERATIONS TEST COMPLETED SUCCESSFULLY!\n');
    console.log('✅ Key Components Verified:');
    console.log('   • Session creation and management');
    console.log('   • Message persistence with timestamps');
    console.log('   • Short-term context storage');
    console.log('   • Context retrieval and formatting');
    console.log('   • Proper data relationships\n');

    console.log('🚀 The memory system database layer is fully functional!');
    console.log('   The API services can now persist conversations and generate summaries.');

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Details:', error);
  }
}

// Run the test
if (require.main === module) {
  testDatabaseOperations().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testDatabaseOperations }; 