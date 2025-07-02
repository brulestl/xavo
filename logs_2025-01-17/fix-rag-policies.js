// Script to fix RLS policies for RAG storage
// Run with: node fix-rag-policies.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function fixRAGPolicies() {
  console.log('🔧 Fixing RLS policies for RAG storage...\n');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  try {
    // Use service role key for admin operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('📋 Step 1: Checking documents bucket...');
    
    // Check if documents bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError.message);
      return;
    }

    const documentsBucket = buckets.find(bucket => bucket.id === 'documents');
    
    if (!documentsBucket) {
      console.log('📦 Creating documents bucket...');
      
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('documents', {
        public: false,
        allowedMimeTypes: [
          'application/pdf',
          'text/plain', 
          'text/csv',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        fileSizeLimit: 10485760 // 10MB
      });

      if (createError) {
        console.error('❌ Failed to create bucket:', createError.message);
        return;
      }
      
      console.log('✅ Documents bucket created successfully');
    } else {
      console.log('✅ Documents bucket exists');
      console.log(`   Public: ${documentsBucket.public}`);
      console.log(`   Created: ${documentsBucket.created_at}`);
    }

    console.log('\n🔐 Step 2: Fixing RLS policies...');
    console.log('   You need to run the SQL commands manually in Supabase SQL Editor:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Copy and run the contents of sql/fix-storage-policies.sql');
    console.log('\n   The SQL file contains the necessary RLS policies for storage.objects table.');

    console.log('\n📄 Step 3: Testing storage access...');
    
    // Test upload with a small file
    const testContent = 'Test file for RLS policy validation';
    const testFileName = `test-${Date.now()}.txt`;
    const testPath = `test-uploads/policy-test/${testFileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(testPath, testContent, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.log('⚠️ Upload test failed (expected if RLS not fixed yet):');
      console.log(`   Error: ${uploadError.message}`);
      console.log('\n🔧 To fix this, run the SQL commands mentioned above.');
    } else {
      console.log('✅ Upload test successful!');
      console.log(`   File uploaded to: ${uploadData.path}`);
      
      // Clean up test file
      await supabase.storage.from('documents').remove([testPath]);
      console.log('✅ Test file cleaned up');
    }

    console.log('\n📝 Next Steps:');
    console.log('1. Run the SQL commands from sql/fix-storage-policies.sql');
    console.log('2. Test file upload in your React Native app again');
    console.log('3. The RLS error should be resolved');

  } catch (error) {
    console.error('💥 Error fixing policies:', error.message);
  }
}

if (require.main === module) {
  fixRAGPolicies();
}

module.exports = { fixRAGPolicies }; 