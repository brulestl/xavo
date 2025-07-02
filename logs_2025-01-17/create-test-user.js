// Script to create a test user for RAG endpoint testing
// Run with: node create-test-user.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

async function createTestUser() {
  console.log('🚀 Creating test user for RAG endpoint testing...\n');

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log(`📧 Creating user with email: ${TEST_EMAIL}`);
    
    // Create the test user
    const { data, error } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ Test user already exists! Trying to sign in...');
        
        // Try to sign in with existing user
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });

        if (signInError) {
          console.error('❌ Failed to sign in with existing user:', signInError.message);
          console.log('\n💡 You may need to:');
          console.log('1. Reset the password for this user in Supabase Auth dashboard');
          console.log('2. Or use a different email in your .env file');
          return;
        }

        console.log('✅ Successfully signed in with existing test user!');
        console.log(`   User ID: ${signInData.user.id}`);
        console.log(`   Email: ${signInData.user.email}`);
        
      } else {
        console.error('❌ User creation failed:', error.message);
        return;
      }
    } else {
      console.log('✅ Test user created successfully!');
      console.log(`   User ID: ${data.user.id}`);
      console.log(`   Email: ${data.user.email}`);
      
      if (!data.user.email_confirmed_at) {
        console.log('\n📧 Note: If email confirmation is required, you may need to:');
        console.log('1. Check the email for a confirmation link, or');
        console.log('2. Disable email confirmation in Supabase Auth settings');
      }
    }

    console.log('\n🎉 Test user setup completed!');
    console.log('\nYou can now run the RAG endpoint tests:');
    console.log('  node test-rag-endpoints.js');
    console.log('  node test-process-document.js');
    console.log('  node test-query-document.js');

  } catch (error) {
    console.error('💥 Error creating test user:', error.message);
    console.error(error.stack);
  }
}

// Run the script
if (require.main === module) {
  createTestUser();
}

module.exports = { createTestUser }; 