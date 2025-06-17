const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Service key exists:', !!supabaseServiceKey);
console.log('Service key length:', supabaseServiceKey?.length || 0);

if (!supabaseServiceKey) {
  console.error('❌ No service role key found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    console.log('\n🔍 Testing basic Supabase connection...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('prompt_usage')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Basic connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Basic connection successful');
    
    // Test RPC function exists
    console.log('\n🔍 Testing RPC function fn_consume_daily...');
    
    const testUserId = 'test-user-123';
    const testCap = 3;
    
    const { error: rpcError } = await supabase.rpc('fn_consume_daily', {
      p_cap: testCap,
      p_user: testUserId
    });
    
    if (rpcError) {
      console.error('❌ RPC function failed:', rpcError);
      return false;
    }
    
    console.log('✅ RPC function fn_consume_daily works!');
    
    // Check the usage record was created
    const { data: usage, error: usageError } = await supabase
      .from('prompt_usage')
      .select('*')
      .eq('user_id', testUserId);
    
    if (usageError) {
      console.error('❌ Failed to check usage:', usageError.message);
    } else {
      console.log('✅ Usage record:', usage);
    }
    
    return true;
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    return false;
  }
}

testConnection().then(success => {
  console.log('\n🎯 Test result:', success ? 'SUCCESS' : 'FAILED');
  process.exit(success ? 0 : 1);
}); 