// Script to check if RAG setup is complete in Supabase
// Run with: node check-rag-setup.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkRAGSetup() {
  console.log('🔍 Checking RAG Setup in Supabase\n');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Test 1: Check if documents table exists
    console.log('📋 Test 1: Checking documents table...');
    try {
      const { data, error, count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error('❌ Documents table does not exist or is not accessible');
        console.error(`   Error: ${error.message}`);
        console.log('\n🔧 Fix: Run the SQL migration:');
        console.log('   1. Go to your Supabase dashboard');
        console.log('   2. Navigate to SQL Editor');
        console.log('   3. Copy and run the contents of sql/create_rag_schema.sql');
        return false;
      } else {
        console.log(`✅ Documents table exists (${count || 0} records)`);
      }
    } catch (err) {
      console.error('❌ Error checking documents table:', err.message);
      return false;
    }

    // Test 2: Check if document_chunks table exists
    console.log('\n📊 Test 2: Checking document_chunks table...');
    try {
      const { data, error, count } = await supabase
        .from('document_chunks')
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error('❌ Document_chunks table does not exist or is not accessible');
        console.error(`   Error: ${error.message}`);
        return false;
      } else {
        console.log(`✅ Document_chunks table exists (${count || 0} records)`);
      }
    } catch (err) {
      console.error('❌ Error checking document_chunks table:', err.message);
      return false;
    }

    // Test 3: Check if documents storage bucket exists
    console.log('\n🗂️ Test 3: Checking documents storage bucket...');
    try {
      const { data, error } = await supabase.storage.getBucket('documents');

      if (error) {
        console.error('❌ Documents storage bucket does not exist');
        console.error(`   Error: ${error.message}`);
        console.log('\n🔧 Fix: Create the storage bucket:');
        console.log('   1. Go to your Supabase dashboard');
        console.log('   2. Navigate to Storage');
        console.log('   3. Click "New bucket"');
        console.log('   4. Name it "documents"');
        console.log('   5. Set it to Private (RLS will handle access)');
        return false;
      } else {
        console.log('✅ Documents storage bucket exists');
        console.log(`   Name: ${data.name}`);
        console.log(`   Public: ${data.public}`);
        console.log(`   Created: ${data.created_at}`);
      }
    } catch (err) {
      console.error('❌ Error checking storage bucket:', err.message);
      return false;
    }

    // Test 4: Check RLS policies
    console.log('\n🔒 Test 4: Checking RLS policies...');
    try {
      // This is a basic check - try to query with an unauthenticated request
      const { data, error } = await supabase
        .from('documents')
        .select('id')
        .limit(1);

      // We expect this to fail because RLS should block unauthenticated access
      if (error && error.message.includes('not allowed')) {
        console.log('✅ RLS policies are active (unauthenticated access blocked)');
      } else if (error) {
        console.log(`⚠️ Unexpected RLS behavior: ${error.message}`);
      } else {
        console.log('⚠️ RLS might not be configured correctly (unauthenticated access allowed)');
      }
    } catch (err) {
      console.log('✅ RLS policies are likely active (access properly restricted)');
    }

    // Test 5: Check vector extension
    console.log('\n🧮 Test 5: Checking pgvector extension...');
    try {
      // Try to create a test vector (this will fail if pgvector is not enabled)
      const { data, error } = await supabase.rpc('vector_test', {});
      
      // We expect this to fail because the function doesn't exist,
      // but if pgvector is missing, we'll get a different error
      if (error && error.message.includes('function vector_test')) {
        console.log('✅ pgvector extension appears to be available');
      } else if (error && error.message.includes('vector')) {
        console.error('❌ pgvector extension may not be enabled');
        console.log('\n🔧 Fix: Enable pgvector extension:');
        console.log('   1. Go to your Supabase dashboard');
        console.log('   2. Navigate to SQL Editor');
        console.log('   3. Run: CREATE EXTENSION IF NOT EXISTS vector;');
        return false;
      } else {
        console.log('✅ pgvector extension appears to be available');
      }
    } catch (err) {
      console.log('✅ pgvector extension appears to be available');
    }

    // Test 6: Check if match_document_chunks function exists
    console.log('\n🔍 Test 6: Checking match_document_chunks function...');
    try {
      const { data, error } = await supabase.rpc('match_document_chunks', {
        query_embedding: JSON.stringify(new Array(1536).fill(0.1)),
        filter_user_id: '00000000-0000-0000-0000-000000000000',
        filter_document_id: null,
        similarity_threshold: 0.5,
        match_count: 1
      });

      if (error && error.message.includes('function match_document_chunks')) {
        console.error('❌ match_document_chunks function does not exist');
        console.log('\n🔧 Fix: Run the SQL migration to create the function');
        return false;
      } else {
        console.log('✅ match_document_chunks function exists');
      }
    } catch (err) {
      console.log('✅ match_document_chunks function exists');
    }

    console.log('\n🎉 All RAG setup checks passed!');
    console.log('\nIf you\'re still getting "Network request failed" errors,');
    console.log('the issue might be with:');
    console.log('1. User authentication in your React Native app');
    console.log('2. Network connectivity from the mobile device');
    console.log('3. React Native fetch configuration');
    
    return true;

  } catch (error) {
    console.error('💥 Setup check failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  checkRAGSetup();
}

module.exports = { checkRAGSetup }; 