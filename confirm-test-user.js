// Script to confirm test user email for RAG endpoint testing
// Run with: node confirm-test-user.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL || 'ragendpoint.test@outlook.com';

async function confirmTestUser() {
  console.log('🚀 Confirming test user email...\n');

  try {
    // Initialize Supabase client with service role key (has admin privileges)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`📧 Looking for user with email: ${TEST_EMAIL}`);
    
    // Get the user by email using admin API
    const { data: users, error: getUserError } = await supabase.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('❌ Failed to list users:', getUserError.message);
      return;
    }
    
    const user = users.users.find(u => u.email === TEST_EMAIL);
    
    if (!user) {
      console.error('❌ User not found with email:', TEST_EMAIL);
      return;
    }
    
    console.log(`✅ Found user: ${user.id}`);
    
    if (user.email_confirmed_at) {
      console.log('✅ User email is already confirmed!');
    } else {
      console.log('📬 Confirming user email...');
      
      // Update the user to confirm their email
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );
      
      if (updateError) {
        console.error('❌ Failed to confirm user email:', updateError.message);
        return;
      }
      
      console.log('✅ User email confirmed successfully!');
    }
    
    // Test authentication
    console.log('🔐 Testing authentication...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: process.env.TEST_PASSWORD || 'testpassword123',
    });
    
    if (signInError) {
      console.error('❌ Authentication failed:', signInError.message);
      return;
    }
    
    console.log('✅ Authentication successful!');
    console.log(`   User ID: ${signInData.user.id}`);
    console.log(`   Email confirmed: ${signInData.user.email_confirmed_at ? 'Yes' : 'No'}`);
    
    console.log('\n🎉 Test user is ready for RAG endpoint testing!');
    console.log('\nYou can now run:');
    console.log('  node test-rag-endpoints.js');
    console.log('  node test-process-document.js');
    console.log('  node test-query-document.js');

  } catch (error) {
    console.error('💥 Error confirming test user:', error.message);
    console.error(error.stack);
  }
}

// Run the script
if (require.main === module) {
  confirmTestUser();
}

module.exports = { confirmTestUser }; 