// Debug script that mimics exactly what the React Native app is doing
// Run with: node debug-rag-requests.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function debugRAGRequests() {
  console.log('🔍 Debug RAG Requests - Mimicking React Native App\n');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const TEST_EMAIL = process.env.TEST_EMAIL || 'ragendpoint.test@outlook.com';
  const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

  try {
    // Step 1: Authenticate (like the app does)
    console.log('🔐 Step 1: Authenticating like the app...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      return;
    }

    console.log('✅ Authenticated successfully');
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Access Token: ${authData.session.access_token.substring(0, 20)}...`);

    // Step 2: Test the exact URL the app uses
    console.log('\n🌐 Step 2: Testing endpoint URLs...');
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wdhmlynmbrhunizbdhdt.supabase.co';
    console.log(`   Using Supabase URL: ${supabaseUrl}`);
    
    const processDocumentUrl = `${supabaseUrl}/functions/v1/process-document`;
    const queryDocumentUrl = `${supabaseUrl}/functions/v1/query-document`;
    
    console.log(`   Process Document URL: ${processDocumentUrl}`);
    console.log(`   Query Document URL: ${queryDocumentUrl}`);

    // Step 3: Test process-document endpoint with exact app headers
    console.log('\n📄 Step 3: Testing process-document endpoint...');
    
    // Create a test document first (like the app does)
    const testContent = 'Test document for RAG processing.';
    const testFileName = `debug-test-${Date.now()}.txt`;
    const testFilePath = `./${testFileName}`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log(`   Created test file: ${testFileName}`);

    // Upload to storage (like the app does)
    const fileBuffer = fs.readFileSync(testFilePath);
    const bucketPath = `uploads/${authData.user.id}/${Date.now()}_${testFileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(bucketPath, fileBuffer, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      return;
    }
    
    console.log(`   ✅ File uploaded to: ${bucketPath}`);

    // Create document record (like the app does)
    const { data: documentRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: authData.user.id,
        filename: testFileName,
        bucket_path: bucketPath,
        file_size: fileBuffer.length,
        file_type: 'text/plain',
        processing_status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database save failed:', dbError.message);
      return;
    }
    
    console.log(`   ✅ Document record created: ${documentRecord.id}`);

    // Step 4: Make the exact fetch request the app makes
    console.log('\n🚀 Step 4: Making fetch request (exactly like React Native app)...');
    
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.session.access_token}`
    };
    
    const requestBody = {
      documentId: documentRecord.id,
      bucketPath: bucketPath,
      filename: testFileName
    };
    
    console.log('🔍 Request headers:', Object.keys(requestHeaders));
    console.log('🔍 Request body:', JSON.stringify(requestBody, null, 2));
    console.log(`🌐 Making fetch request to: ${processDocumentUrl}`);
    
    try {
      const processResponse = await fetch(processDocumentUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });

      console.log(`📊 Response status: ${processResponse.status}`);
      console.log(`📊 Response headers:`, Object.fromEntries(processResponse.headers.entries()));
      
      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        console.error('❌ Process document failed:');
        console.error(`   Status: ${processResponse.status}`);
        console.error(`   Status Text: ${processResponse.statusText}`);
        console.error(`   Response: ${errorText}`);
        return;
      }

      const processResult = await processResponse.json();
      console.log('✅ Process document succeeded!');
      console.log(`   Chunks created: ${processResult.chunksCreated}`);
      console.log(`   Processing time: ${processResult.processingTime}ms`);

      // Step 5: Test query-document endpoint
      console.log('\n❓ Step 5: Testing query-document endpoint...');
      
      const queryRequestBody = {
        question: "What is this document about?",
        documentId: documentRecord.id,
        sessionId: null,
        includeConversationContext: false
      };
      
      console.log('🔍 Query request body:', JSON.stringify(queryRequestBody, null, 2));
      console.log(`🌐 Making query request to: ${queryDocumentUrl}`);
      
      const queryResponse = await fetch(queryDocumentUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(queryRequestBody)
      });

      console.log(`📊 Query response status: ${queryResponse.status}`);
      
      if (!queryResponse.ok) {
        const errorText = await queryResponse.text();
        console.error('❌ Query document failed:');
        console.error(`   Status: ${queryResponse.status}`);
        console.error(`   Response: ${errorText}`);
        return;
      }

      const queryResult = await queryResponse.json();
      console.log('✅ Query document succeeded!');
      console.log(`   Answer: ${queryResult.answer}`);
      console.log(`   Sources found: ${queryResult.sources?.length || 0}`);

    } catch (fetchError) {
      console.error('❌ Fetch request failed:');
      console.error('   Error type:', fetchError.constructor.name);
      console.error('   Error message:', fetchError.message);
      console.error('   Error stack:', fetchError.stack);
      
      // Check if it's a network error
      if (fetchError.message.includes('Network request failed')) {
        console.log('\n🔧 Network Error Debugging:');
        console.log('   This is the same error as in React Native!');
        console.log('   Possible causes:');
        console.log('   1. Network connectivity issues');
        console.log('   2. Firewall blocking requests');
        console.log('   3. Edge function not deployed or crashed');
        console.log('   4. Wrong endpoint URL');
        console.log('   5. CORS issues (though we tested this)');
      }
    }

    // Cleanup
    console.log('\n🧹 Cleanup...');
    fs.unlinkSync(testFilePath);
    await supabase.storage.from('documents').remove([bucketPath]);
    await supabase.from('documents').delete().eq('id', documentRecord.id);
    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('💥 Debug script failed:', error);
  }
}

// Test individual endpoint health with different methods
async function testEndpointHealth() {
  console.log('🏥 Testing endpoint health with different methods...\n');
  
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wdhmlynmbrhunizbdhdt.supabase.co';
  const endpoints = [
    `${supabaseUrl}/functions/v1/process-document`,
    `${supabaseUrl}/functions/v1/query-document`
  ];

  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint}`);
    
    try {
      // Test OPTIONS
      const optionsResponse = await fetch(endpoint, { method: 'OPTIONS' });
      console.log(`  OPTIONS: ${optionsResponse.status} ${optionsResponse.statusText}`);
      
      // Test GET (should return method not allowed but proves connectivity)
      const getResponse = await fetch(endpoint, { method: 'GET' });
      console.log(`  GET: ${getResponse.status} ${getResponse.statusText}`);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
    console.log();
  }
}

// Run tests
if (require.main === module) {
  console.log('Choose test to run:');
  const args = process.argv.slice(2);
  
  if (args.includes('--health')) {
    testEndpointHealth();
  } else {
    debugRAGRequests();
  }
}

module.exports = { debugRAGRequests, testEndpointHealth }; 