// Test script for process-document endpoint
// Run with: node test-process-document.js

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Configuration - Update these with your values
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testProcessDocument() {
  console.log('🚀 Testing process-document endpoint...\n');

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
    console.log(`   User ID: ${userId}`);
    console.log(`   Token: ${accessToken.substring(0, 20)}...\n`);

    // Step 2: Create a test document file
    console.log('2️⃣ Creating test document...');
    const testContent = `
    Corporate Influence Analysis Report
    
    Introduction
    This document analyzes the influence patterns within corporate environments and their impact on decision-making processes.
    
    Key Findings:
    1. Hierarchical structures significantly impact information flow
    2. Informal networks often bypass official channels
    3. Decision authority varies by organizational culture
    
    Methodology
    We conducted interviews with 150 executives across 50 companies to understand influence dynamics.
    
    Results
    The study reveals that informal influence networks are 40% more effective than formal reporting structures for driving change initiatives.
    
    Conclusion
    Organizations should recognize and leverage both formal and informal influence channels for maximum effectiveness.
    `;

    const testFileName = `test-document-${Date.now()}.txt`;
    const testFilePath = `./${testFileName}`;
    
    // Write test file
    fs.writeFileSync(testFilePath, testContent);
    console.log(`✅ Created test file: ${testFileName}\n`);

    // Step 3: Upload file to Supabase storage
    console.log('3️⃣ Uploading file to storage...');
    const fileBuffer = fs.readFileSync(testFilePath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`test/${testFileName}`, fileBuffer, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.error('❌ File upload failed:', uploadError.message);
      return;
    }

    const bucketPath = uploadData.path;
    console.log(`✅ File uploaded to: ${bucketPath}\n`);

    // Step 4: Create document record
    console.log('4️⃣ Creating document record...');
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        filename: testFileName,
        original_name: testFileName,
        file_type: 'text/plain',
        file_size: fileBuffer.length,
        bucket_path: bucketPath,
        status: 'pending'
      })
      .select()
      .single();

    if (docError) {
      console.error('❌ Document record creation failed:', docError.message);
      return;
    }

    const documentId = docData.id;
    console.log(`✅ Document record created with ID: ${documentId}\n`);

    // Step 5: Call process-document endpoint
    console.log('5️⃣ Calling process-document endpoint...');
    const processStartTime = Date.now();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-document`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: documentId,
        bucketPath: bucketPath,
        filename: testFileName
      })
    });

    const result = await response.json();
    const processTime = Date.now() - processStartTime;

    if (!response.ok) {
      console.error('❌ Process document failed:', result.error);
      return;
    }

    console.log('✅ Document processed successfully!');
    console.log(`   Chunks created: ${result.chunksCreated}`);
    console.log(`   Processing time: ${result.processingTime}ms`);
    console.log(`   Total test time: ${processTime}ms\n`);

    // Step 6: Verify chunks in database
    console.log('6️⃣ Verifying chunks in database...');
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', documentId);

    if (chunksError) {
      console.error('❌ Failed to fetch chunks:', chunksError.message);
      return;
    }

    console.log(`✅ Found ${chunks.length} chunks in database`);
    chunks.forEach((chunk, index) => {
      console.log(`   Chunk ${index + 1}: Page ${chunk.page}, ${chunk.token_count} tokens`);
      console.log(`   Content preview: ${chunk.content.substring(0, 100)}...\n`);
    });

    // Step 7: Verify document status
    console.log('7️⃣ Checking final document status...');
    const { data: finalDoc, error: finalDocError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (finalDocError) {
      console.error('❌ Failed to fetch final document:', finalDocError.message);
      return;
    }

    console.log('✅ Final document status:');
    console.log(`   Status: ${finalDoc.status}`);
    console.log(`   Chunk count: ${finalDoc.chunk_count}`);
    console.log(`   Processed at: ${finalDoc.processed_at}`);
    console.log(`   Error message: ${finalDoc.error_message || 'None'}\n`);

    // Cleanup
    console.log('8️⃣ Cleaning up test files...');
    
    // Delete local test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('✅ Local test file deleted');
    }

    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([bucketPath]);

    if (deleteError) {
      console.warn('⚠️ Failed to delete from storage:', deleteError.message);
    } else {
      console.log('✅ Storage file deleted');
    }

    // Optionally delete document record and chunks
    // Uncomment if you want to clean up test data
    /*
    await supabase.from('document_chunks').delete().eq('document_id', documentId);
    await supabase.from('documents').delete().eq('id', documentId);
    console.log('✅ Database records deleted');
    */

    console.log('\n🎉 Process document test completed successfully!');

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testProcessDocument();
}

module.exports = { testProcessDocument }; 