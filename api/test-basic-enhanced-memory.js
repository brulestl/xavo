/**
 * Basic Enhanced Memory Test - Works around schema cache issues
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_SESSION_ID = '550e8400-e29b-41d4-a716-446655440004';

async function testBasicEnhancedMemory() {
  console.log('🧪 Testing Basic Enhanced Memory System...\n');

  try {
    // Cleanup
    console.log('1. Cleaning up test data...');
    await supabase.from('conversation_messages').delete().eq('session_id', TEST_SESSION_ID);
    await supabase.from('short_term_contexts').delete().eq('session_id', TEST_SESSION_ID);
    await supabase.from('conversation_sessions').delete().eq('id', TEST_SESSION_ID);
    console.log('✅ Cleanup complete\n');

    // Create test session
    console.log('2. Creating test session...');
    const { data: session, error: sessionError } = await supabase
      .from('conversation_sessions')
      .insert({
        id: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
        title: 'Basic Enhanced Memory Test',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) throw sessionError;
    console.log('✅ Test session created\n');

    // Test basic message storage (without raw_response for now)
    console.log('3. Testing basic message storage...');
    const testMessages = [
      { role: 'user', content: 'I need help with team leadership strategies.' },
      { role: 'assistant', content: 'I can help you develop effective leadership strategies. What specific challenges are you facing with your team?' }
    ];

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
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

      if (error) throw error;
      console.log(`✅ Message ${i + 1} stored (${message.role})`);
    }
    console.log('');

    // Test summary with embedding
    console.log('4. Testing summary generation with context_embedding...');
    const summaryText = 'User is seeking help with team leadership strategies. Assistant offered to help and asked about specific team challenges.';
    
    // Generate embedding
    console.log('   Generating embedding...');
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: summaryText,
      encoding_format: 'float'
    });

    const embedding = embeddingResponse.data[0]?.embedding;
    if (!embedding) {
      throw new Error('Failed to generate embedding');
    }
    console.log(`   ✅ Embedding generated (${embedding.length} dimensions)`);

    // Store summary with context_embedding
    const { data: summary, error: summaryError } = await supabase
      .from('short_term_contexts')
      .insert({
        session_id: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
        summary_text: summaryText,
        key_topics: ['leadership', 'team', 'strategies'],
        message_count: testMessages.length,
        summary_version: 1,
        context_weight: 0.8,
        context_embedding: embedding,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString()
      })
      .select()
      .single();

    if (summaryError) throw summaryError;
    console.log('✅ Summary with context_embedding stored successfully\n');

    // Test context retrieval
    console.log('5. Testing context retrieval...');
    
    // Get latest summary with context_embedding
    const { data: latestSummary, error: summaryFetchError } = await supabase
      .from('short_term_contexts')
      .select('summary_text, key_topics, context_embedding')
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
    console.log(`   Context Embedding: ${latestSummary.context_embedding ? 'Present' : 'Missing'}`);
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

    // Add new user message
    contextMessages.push({
      role: 'user',
      content: 'What are some specific techniques for motivating underperforming team members?'
    });

    console.log('✅ Context formatted for OpenAI injection:');
    console.log(`   Total context messages: ${contextMessages.length}`);
    contextMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 60)}...`);
    });
    console.log('');

    // Final success message
    console.log('🎉 BASIC ENHANCED MEMORY TEST COMPLETED SUCCESSFULLY!\n');
    console.log('✅ Core Features Working:');
    console.log('   • Message persistence with timestamps');
    console.log('   • Summary generation with context_embedding');
    console.log('   • Context retrieval and formatting');
    console.log('   • OpenAI context injection ready\n');

    console.log('📝 To Enable Raw Response Storage:');
    console.log('   1. Refresh Supabase schema cache: https://supabase.com/dashboard/project/[your-project]/api');
    console.log('   2. Click "Refresh schema cache" button');
    console.log('   3. Wait 30 seconds and try the full enhanced test');

  } catch (error) {
    console.error('❌ Basic enhanced memory test failed:', error.message);
    console.error('Details:', error);
  }
}

// Run the test
if (require.main === module) {
  testBasicEnhancedMemory().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testBasicEnhancedMemory }; 