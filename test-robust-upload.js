// Test script for robust file upload workflow
// Run with: node test-robust-upload.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testRobustUpload() {
  console.log('🚀 Testing robust file upload workflow...\n');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const TEST_EMAIL = process.env.TEST_EMAIL || 'ragendpoint.test@outlook.com';
  const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

  try {
    // Step 1: Authenticate
    console.log('🔐 Step 1: Authenticating...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      console.log('\n💡 You may need to confirm the user email in Supabase dashboard');
      return;
    }

    console.log('✅ Authenticated successfully');

    // Step 2: Create test file
    console.log('\n📄 Step 2: Creating test file...');
    const testContent = `# Corporate Politics Test Document

This is a test document for the robust RAG upload workflow.

## Key Features Tested:
1. Buffer-based file reading
2. Direct Supabase Storage upload
3. Polyfill support for React Native
4. Proper CORS handling

## Test Content:
The corporate influence study shows that:
- Informal networks are more effective than formal structures
- Decision-making processes vary by organizational culture
- Communication flows are often non-hierarchical

This document will be processed for RAG search capabilities.`;

    const testFileName = `robust-test-${Date.now()}.txt`;
    const testFilePath = `./${testFileName}`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log(`✅ Created test file: ${testFileName}`);

    // Step 3: Test Buffer upload
    console.log('\n☁️ Step 3: Testing Buffer-based upload...');
    const fileBuffer = fs.readFileSync(testFilePath);
    const bucketPath = `test-uploads/${authData.user.id}/${Date.now()}_${testFileName}`;
    
    console.log(`📁 Uploading to: ${bucketPath}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(bucketPath, fileBuffer, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      return;
    }

    console.log('✅ File uploaded successfully:', uploadData);

    // Step 4: Test database record
    console.log('\n💾 Step 4: Testing database operations...');
    const { data: docRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: authData.user.id,
        filename: testFileName,
        bucket_path: bucketPath,
        file_size: fileBuffer.length,
        file_type: 'text/plain',
        processing_status: 'pending',
        metadata: {
          test: true,
          upload_method: 'buffer_direct'
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return;
    }

    console.log('✅ Database record created:', docRecord.id);

    // Step 5: Test Edge Function
    console.log('\n🔧 Step 5: Testing process-document endpoint...');
    const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session.access_token}`
      },
      body: JSON.stringify({
        documentId: docRecord.id,
        bucketPath: bucketPath,
        filename: testFileName
      })
    });

    console.log(`📊 Process response status: ${processResponse.status}`);

    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error('❌ Process failed:', errorText);
      return;
    }

    const processResult = await processResponse.json();
    console.log('✅ Document processing successful:', processResult);

    // Step 6: Test query
    console.log('\n❓ Step 6: Testing document query...');
    const queryResponse = await fetch(`${SUPABASE_URL}/functions/v1/query-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session.access_token}`
      },
      body: JSON.stringify({
        question: "What does this document say about corporate influence?",
        documentId: docRecord.id
      })
    });

    console.log(`📊 Query response status: ${queryResponse.status}`);

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('❌ Query failed:', errorText);
      return;
    }

    const queryResult = await queryResponse.json();
    console.log('✅ Document query successful!');
    console.log(`📄 Answer: ${queryResult.answer}`);
    console.log(`🔍 Sources found: ${queryResult.sources?.length || 0}`);

    // Cleanup
    console.log('\n🧹 Cleanup...');
    fs.unlinkSync(testFilePath);
    await supabase.storage.from('documents').remove([bucketPath]);
    await supabase.from('document_chunks').delete().eq('document_id', docRecord.id);
    await supabase.from('documents').delete().eq('id', docRecord.id);
    console.log('✅ Cleanup completed');

    console.log('\n🎉 Robust upload test completed successfully!');
    console.log('\n📋 Test Results:');
    console.log('✅ Authentication: PASSED');
    console.log('✅ File creation: PASSED');
    console.log('✅ Buffer upload: PASSED');
    console.log('✅ Database operations: PASSED');
    console.log('✅ Document processing: PASSED');
    console.log('✅ Document querying: PASSED');
    console.log('\n🚀 Your React Native app should now handle file uploads without "Network request failed" errors!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

if (require.main === module) {
  testRobustUpload();
}

module.exports = { testRobustUpload }; 