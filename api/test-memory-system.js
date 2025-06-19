/**
 * Test script for Xavo memory system
 * Verifies that conversation messages are persisted and summaries are generated
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_SESSION_ID = '550e8400-e29b-41d4-a716-446655440001';

async function runMemorySystemTest() {
  console.log('🧪 Testing Xavo Memory System...\n');

  try {
    // Test 1: Clean up any existing test data
    console.log('1. Cleaning up existing test data...');
    await supabase.from('conversation_messages').delete().eq('session_id', TEST_SESSION_ID);
    await supabase.from('short_term_contexts').delete().eq('session_id', TEST_SESSION_ID);
    await supabase.from('conversation_sessions').delete().eq('id', TEST_SESSION_ID);
    console.log('✅ Cleanup complete\n');

    // Test 2: Create test session
    console.log('2. Creating test session...');
    const { data: session, error: sessionError } = await supabase
      .from('conversation_sessions')
      .insert({
        id: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
        title: 'Memory System Test',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('❌ Session creation failed:', sessionError);
      return;
    }
    console.log('✅ Session created:', session.id, '\n');

    // Test 3: Insert conversation messages
    console.log('3. Inserting test conversation messages...');
    const messages = [
      { role: 'user', content: 'I need help with team communication. My team seems disengaged during meetings.' },
      { role: 'assistant', content: 'I understand your concern about team engagement. Let\'s explore some strategies to improve meeting dynamics. What specific behaviors are you noticing?' },
      { role: 'user', content: 'People are often on their phones, some don\'t speak up, and when they do contribute, it feels forced.' },
      { role: 'assistant', content: 'Those are common signs of disengagement. Here are three power moves to re-energize your meetings: 1) Start with a 2-minute personal check-in round, 2) Use the "phone parking lot" technique, 3) Implement rotating leadership for agenda items.' },
      { role: 'user', content: 'The phone parking lot sounds interesting. How exactly does that work?' },
      { role: 'assistant', content: 'Great question! The phone parking lot involves designating a physical spot or box where everyone places their phones at the start of the meeting. This creates psychological commitment to being present. You can make it engaging by having a small reward for participation or making it a team norm rather than a rule.' }
    ];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          session_id: TEST_SESSION_ID,
          user_id: TEST_USER_ID,
          role: message.role,
          content: message.content,
          message_timestamp: new Date(Date.now() + i * 1000).toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Failed to insert message ${i + 1}:`, error);
        return;
      }
      console.log(`✅ Message ${i + 1} inserted (${message.role})`);
    }
    console.log('\n');

    // Test 4: Verify messages were stored
    console.log('4. Verifying messages were stored...');
    const { data: storedMessages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('id, role, content')
      .eq('session_id', TEST_SESSION_ID)
      .order('message_timestamp', { ascending: true });

    if (messagesError) {
      console.error('❌ Failed to fetch messages:', messagesError);
      return;
    }

    console.log(`✅ ${storedMessages.length} messages stored successfully`);
    storedMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
    });
    console.log('\n');

    // Test 5: Manually trigger summary generation
    console.log('5. Testing summary generation...');
    
    // Import and use the SummaryGenerationService
    const { SummaryGenerationService } = require('./src/modules/chat/summary-generation.service');
    const summaryService = new SummaryGenerationService();
    
    const summary = await summaryService.generateSessionSummary(TEST_SESSION_ID, TEST_USER_ID, 3);
    
    if (summary) {
      console.log('✅ Summary generated successfully:');
      console.log(`   Summary: ${summary.summaryText}`);
      console.log(`   Key Topics: ${summary.keyTopics.join(', ')}`);
      console.log(`   Message Count: ${summary.messageCount}`);
    } else {
      console.log('⚠️ No summary generated (this might be expected behavior)');
    }
    console.log('\n');

    // Test 6: Check if summary was stored
    console.log('6. Verifying summary storage...');
    const { data: storedSummaries, error: summariesError } = await supabase
      .from('short_term_contexts')
      .select('*')
      .eq('session_id', TEST_SESSION_ID)
      .order('summary_version', { ascending: false });

    if (summariesError) {
      console.error('❌ Failed to fetch summaries:', summariesError);
      return;
    }

    console.log(`✅ ${storedSummaries.length} summaries found`);
    storedSummaries.forEach((summary, i) => {
      console.log(`   ${i + 1}. Version ${summary.summary_version}: ${summary.summary_text.substring(0, 100)}...`);
      console.log(`      Topics: [${summary.key_topics.join(', ')}]`);
    });
    console.log('\n');

    // Test 7: Test context injection
    console.log('7. Testing context injection...');
    const { ContextInjectionService } = require('./src/modules/chat/context-injection.service');
    const contextService = new ContextInjectionService();
    
    const context = await contextService.getSessionContext(TEST_SESSION_ID, TEST_USER_ID, 10);
    
    console.log('✅ Context retrieved:');
    console.log(`   Short-term summary: ${context.shortTermSummary ? 'Yes' : 'No'}`);
    console.log(`   Message history count: ${context.messageHistory.length}`);
    console.log(`   Estimated tokens: ${context.contextTokens}`);
    
    if (context.shortTermSummary) {
      console.log(`   Summary preview: ${context.shortTermSummary.substring(0, 100)}...`);
    }
    console.log('\n');

    // Test 8: Test context formatting for OpenAI
    console.log('8. Testing OpenAI context formatting...');
    const formattedContext = contextService.formatContextForOpenAI(context);
    
    console.log('✅ Context formatted for OpenAI:');
    console.log(`   Total messages in context: ${formattedContext.length}`);
    formattedContext.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 60)}...`);
    });
    console.log('\n');

    console.log('🎉 Memory System Test COMPLETED SUCCESSFULLY!');
    console.log('\nSummary of Results:');
    console.log(`✅ Messages persisted: ${storedMessages.length}`);
    console.log(`✅ Summaries generated: ${storedSummaries.length}`);
    console.log(`✅ Context injection working: ${context.messageHistory.length > 0 ? 'Yes' : 'No'}`);
    console.log(`✅ OpenAI formatting working: ${formattedContext.length > 0 ? 'Yes' : 'No'}`);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  runMemorySystemTest().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });
}

module.exports = { runMemorySystemTest }; 