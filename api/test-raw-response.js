/**
 * Test raw_response insertion directly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_SESSION_ID = '550e8400-e29b-41d4-a716-446655440099';

async function testRawResponseInsertion() {
  console.log('🧪 Testing Raw Response Insertion...\n');

  try {
    // Cleanup
    await supabase.from('conversation_messages').delete().eq('session_id', TEST_SESSION_ID);
    await supabase.from('conversation_sessions').delete().eq('id', TEST_SESSION_ID);

    // Create test session
    console.log('1. Creating test session...');
    const { data: session, error: sessionError } = await supabase
      .from('conversation_sessions')
      .insert({
        id: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
        title: 'Raw Response Test',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) throw sessionError;
    console.log('✅ Session created\n');

    // Test 1: Insert without raw_response (should work)
    console.log('2. Testing message without raw_response...');
    const { data: msg1, error: error1 } = await supabase
      .from('conversation_messages')
      .insert({
        session_id: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
        role: 'user',
        content: 'Test message without raw response',
        message_timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error1) throw error1;
    console.log('✅ Message without raw_response inserted successfully\n');

    // Test 2: Insert with raw_response using direct SQL
    console.log('3. Testing message with raw_response via RPC...');
    
    const rawResponseData = {
      model: 'gpt-4o-mini',
      fullText: 'This is a test response',
      processedText: 'This is a test response',
      timestamp: new Date().toISOString(),
      chunks: [
        { choices: [{ delta: { content: 'This is a test' } }] },
        { choices: [{ delta: { content: ' response' } }] }
      ]
    };

    // Use RPC to bypass any schema cache issues
    const { data: rpcResult, error: rpcError } = await supabase.rpc('exec', {
      query: `
        INSERT INTO conversation_messages (
          session_id, user_id, role, content, message_timestamp, raw_response
        ) VALUES (
          '${TEST_SESSION_ID}',
          '${TEST_USER_ID}',
          'assistant',
          'Test response with raw data',
          NOW(),
          '${JSON.stringify(rawResponseData)}'::jsonb
        ) RETURNING id, role, content, raw_response IS NOT NULL as has_raw_response;
      `
    });

    if (rpcError) {
      console.log('⚠️  RPC method failed, trying direct insert...');
      
      // Try direct insert method
      const { data: msg2, error: error2 } = await supabase
        .from('conversation_messages')
        .insert({
          session_id: TEST_SESSION_ID,
          user_id: TEST_USER_ID,
          role: 'assistant',
          content: 'Test response with raw data',
          message_timestamp: new Date().toISOString(),
          raw_response: rawResponseData
        })
        .select('id, role, content')
        .single();

      if (error2) {
        console.log('❌ Direct insert also failed:', error2.message);
        console.log('📝 Manual SQL to run in Supabase SQL Editor:');
        console.log(`
INSERT INTO conversation_messages (
  session_id, user_id, role, content, message_timestamp, raw_response
) VALUES (
  '${TEST_SESSION_ID}',
  '${TEST_USER_ID}',
  'assistant',
  'Test response with raw data',
  NOW(),
  '${JSON.stringify(rawResponseData)}'::jsonb
);
        `);
      } else {
        console.log('✅ Direct insert with raw_response worked!');
      }
    } else {
      console.log('✅ RPC insert with raw_response worked!');
    }

    // Test 3: Query back the data
    console.log('\n4. Querying back all messages...');
    const { data: allMessages, error: queryError } = await supabase
      .from('conversation_messages')
      .select('id, role, content, raw_response, message_timestamp')
      .eq('session_id', TEST_SESSION_ID)
      .order('message_timestamp', { ascending: true });

    if (queryError) throw queryError;

    console.log(`✅ Found ${allMessages.length} messages:`);
    allMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 40)}...`);
      console.log(`      Has raw_response: ${msg.raw_response ? 'YES' : 'NO'}`);
      if (msg.raw_response) {
        console.log(`      Raw response keys: [${Object.keys(msg.raw_response).join(', ')}]`);
      }
    });

    console.log('\n🎉 Raw Response Test Complete!');

  } catch (error) {
    console.error('❌ Raw response test failed:', error.message);
    console.error('Details:', error);
  }
}

// Run the test
if (require.main === module) {
  testRawResponseInsertion().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testRawResponseInsertion }; 