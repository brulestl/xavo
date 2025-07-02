// Test script for query-document endpoint
// Run with: node test-query-document.js
// Make sure you have a processed document first (run test-process-document.js)

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuration - Update these with your values
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testQueryDocument() {
  console.log('🚀 Testing query-document endpoint...\n');

  try {
    // Step 1: Authenticate user
    console.log('1️⃣ Authenticating user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      return;
    }

    const accessToken = authData.session.access_token;
    const userId = authData.user.id;
    console.log('✅ Authenticated successfully');
    console.log(`   User ID: ${userId}\n`);

    // Step 2: Find available documents
    console.log('2️⃣ Finding available documents...');
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('❌ Failed to fetch documents:', docsError.message);
      return;
    }

    if (documents.length === 0) {
      console.log('⚠️ No processed documents found. Please run test-process-document.js first.');
      return;
    }

    console.log(`✅ Found ${documents.length} processed document(s):`);
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.filename} (${doc.chunk_count} chunks)`);
    });

    const testDocument = documents[0];
    console.log(`\n   Using document: ${testDocument.filename} (ID: ${testDocument.id})\n`);

    // Step 3: Create a test session
    console.log('3️⃣ Creating conversation session...');
    const { data: sessionData, error: sessionError } = await supabase
      .from('conversation_sessions')
      .insert({
        user_id: userId,
        title: 'RAG Test Session',
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('❌ Failed to create session:', sessionError.message);
      return;
    }

    const sessionId = sessionData.id;
    console.log(`✅ Session created with ID: ${sessionId}\n`);

    // Step 4: Test questions
    const testQuestions = [
      {
        question: "What are the key findings mentioned in the document?",
        description: "Testing extraction of key findings"
      },
      {
        question: "How many companies were studied in the research?",
        description: "Testing specific data extraction"
      },
      {
        question: "What is the main conclusion of the analysis?",
        description: "Testing conclusion summarization"
      },
      {
        question: "What methodology was used for this study?",
        description: "Testing methodology extraction"
      },
      {
        question: "How effective are informal influence networks compared to formal structures?",
        description: "Testing comparative analysis"
      }
    ];

    console.log('4️⃣ Testing document queries...\n');

    for (let i = 0; i < testQuestions.length; i++) {
      const test = testQuestions[i];
      console.log(`📝 Test ${i + 1}: ${test.description}`);
      console.log(`   Question: "${test.question}"`);

      const queryStartTime = Date.now();

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/query-document`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: test.question,
            documentId: testDocument.id,
            sessionId: sessionId,
            includeConversationContext: i > 0 // Include context for later questions
          })
        });

        const result = await response.json();
        const queryTime = Date.now() - queryStartTime;

        if (!response.ok) {
          console.error(`   ❌ Query failed: ${result.error}`);
          continue;
        }

        console.log('   ✅ Query successful!');
        console.log(`   📊 Response time: ${queryTime}ms`);
        console.log(`   🔍 Sources found: ${result.sources.length}`);
        console.log(`   🎯 Tokens used: ${result.tokensUsed}`);
        console.log(`   \n   📄 Answer:\n   ${result.answer}\n`);

        if (result.sources.length > 0) {
          console.log('   📚 Sources:');
          result.sources.forEach((source, idx) => {
            console.log(`   ${idx + 1}. Page ${source.page}, Similarity: ${source.similarity}`);
            console.log(`      Content: ${source.content}\n`);
          });
        }

        console.log('   ─'.repeat(80) + '\n');

      } catch (error) {
        console.error(`   ❌ Query error: ${error.message}\n`);
      }

      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 5: Test query without document ID (search all documents)
    console.log('5️⃣ Testing global document search...');
    console.log('   Question: "What research methods were used?"');

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/query-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: "What research methods were used?",
          // No documentId - should search all user documents
          sessionId: sessionId,
          includeConversationContext: true
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`   ❌ Global search failed: ${result.error}`);
      } else {
        console.log('   ✅ Global search successful!');
        console.log(`   🔍 Sources found across documents: ${result.sources.length}`);
        console.log(`   📄 Answer: ${result.answer}\n`);
      }
    } catch (error) {
      console.error(`   ❌ Global search error: ${error.message}`);
    }

    // Step 6: Test with irrelevant question
    console.log('6️⃣ Testing with irrelevant question...');
    console.log('   Question: "What is the weather like today?"');

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/query-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: "What is the weather like today?",
          documentId: testDocument.id,
          sessionId: sessionId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`   ❌ Irrelevant query failed: ${result.error}`);
      } else {
        console.log('   ✅ Irrelevant query handled gracefully');
        console.log(`   🔍 Sources found: ${result.sources.length}`);
        console.log(`   📄 Answer: ${result.answer}\n`);
      }
    } catch (error) {
      console.error(`   ❌ Irrelevant query error: ${error.message}`);
    }

    // Step 7: Verify conversation history
    console.log('7️⃣ Checking conversation history...');
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('❌ Failed to fetch conversation history:', messagesError.message);
    } else {
      console.log(`✅ Conversation history: ${messages.length} messages stored`);
      console.log('   Message types:');
      const messageTypes = messages.reduce((acc, msg) => {
        acc[msg.role] = (acc[msg.role] || 0) + 1;
        return acc;
      }, {});
      Object.entries(messageTypes).forEach(([role, count]) => {
        console.log(`   - ${role}: ${count} messages`);
      });
      console.log();
    }

    // Cleanup (optional)
    console.log('8️⃣ Cleaning up test session...');
    // Uncomment if you want to clean up test data
    /*
    await supabase.from('conversation_messages').delete().eq('session_id', sessionId);
    await supabase.from('conversation_sessions').delete().eq('id', sessionId);
    console.log('✅ Test session cleaned up');
    */

    console.log('🎉 Query document test completed successfully!');

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Helper function to test endpoint availability
async function testEndpointHealth() {
  console.log('🏥 Testing endpoint health...\n');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/query-document`, {
      method: 'OPTIONS'
    });

    if (response.ok) {
      console.log('✅ Query-document endpoint is accessible');
    } else {
      console.error('❌ Query-document endpoint is not accessible');
    }
  } catch (error) {
    console.error('❌ Endpoint health check failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  // First check endpoint health, then run full test
  testEndpointHealth().then(() => {
    testQueryDocument();
  });
}

module.exports = { testQueryDocument, testEndpointHealth }; 