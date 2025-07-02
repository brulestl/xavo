// Simple test to check user authentication and provide manual instructions
// Run with: node simple-user-test.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function simpleUserTest() {
  console.log('🚀 Testing user authentication...\n');
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const TEST_EMAIL = process.env.TEST_EMAIL || 'ragendpoint.test@outlook.com';
  const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log(`📧 Testing authentication for: ${TEST_EMAIL}`);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    
    if (error) {
      console.error('❌ Authentication failed:', error.message);
      
      if (error.message.includes('Email not confirmed')) {
        console.log('\n💡 Manual steps to confirm email:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to Authentication > Users');
        console.log(`3. Find the user: ${TEST_EMAIL}`);
        console.log('4. Click on the user and toggle "Email Confirmed" to ON');
        console.log('5. Save the changes');
        console.log('\nOR alternatively:');
        console.log('1. Go to Authentication > Settings');
        console.log('2. Disable "Enable email confirmations" temporarily for testing');
        console.log('\nThen try running the tests again.');
      }
      return false;
    }
    
    console.log('✅ Authentication successful!');
    console.log(`   User ID: ${data.user.id}`);
    console.log(`   Email: ${data.user.email}`);
    console.log(`   Email confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No'}`);
    
    console.log('\n🎉 Ready to test RAG endpoints!');
    return true;
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    return false;
  }
}

if (require.main === module) {
  simpleUserTest().then(success => {
    if (success) {
      console.log('\nYou can now run:');
      console.log('  node test-rag-endpoints.js');
      console.log('  node test-process-document.js');
      console.log('  node test-query-document.js');
    }
  });
}

module.exports = { simpleUserTest }; 