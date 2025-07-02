// Comprehensive RAG endpoints test
// Run with: node test-rag-endpoints.js

require('dotenv').config();
const { testProcessDocument } = require('./test-process-document');
const { testQueryDocument, testEndpointHealth } = require('./test-query-document');

async function runFullRAGTest() {
  console.log('🚀 Starting comprehensive RAG endpoints test...\n');
  console.log('=' * 80);

  try {
    // Step 1: Check environment variables
    console.log('1️⃣ Checking environment variables...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'TEST_EMAIL',
      'TEST_PASSWORD'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.log('\n   Please set these in your .env file or environment:');
      console.log('   SUPABASE_URL=your-supabase-url');
      console.log('   SUPABASE_ANON_KEY=your-anon-key');
      console.log('   TEST_EMAIL=test@example.com');
      console.log('   TEST_PASSWORD=testpassword123\n');
      return;
    }

    console.log('✅ All environment variables are set\n');

    // Step 2: Test endpoint availability
    console.log('2️⃣ Testing endpoint availability...');
    await testEndpointHealth();
    console.log();

    // Step 3: Test process-document endpoint
    console.log('3️⃣ Testing process-document endpoint...');
    console.log('─'.repeat(80));
    await testProcessDocument();
    console.log('─'.repeat(80));
    console.log();

    // Small delay between tests
    console.log('⏱️ Waiting 3 seconds before query test...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Test query-document endpoint
    console.log('4️⃣ Testing query-document endpoint...');
    console.log('─'.repeat(80));
    await testQueryDocument();
    console.log('─'.repeat(80));
    console.log();

    console.log('🎉 All RAG endpoint tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('✅ Environment check: PASSED');
    console.log('✅ Endpoint health: PASSED');
    console.log('✅ Document processing: PASSED');
    console.log('✅ Document querying: PASSED');

  } catch (error) {
    console.error('💥 RAG test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// CLI usage instructions
function printUsage() {
  console.log(`
🧪 RAG Endpoints Test Suite

Usage:
  node test-rag-endpoints.js [options]

Options:
  --process-only    Run only the process-document test
  --query-only      Run only the query-document test
  --health-only     Run only the health check
  --help            Show this help message

Environment Variables Required:
  SUPABASE_URL      Your Supabase project URL
  SUPABASE_ANON_KEY Your Supabase anon key
  TEST_EMAIL        Test user email
  TEST_PASSWORD     Test user password

Examples:
  # Run full test suite
  node test-rag-endpoints.js
  
  # Run only document processing test
  node test-rag-endpoints.js --process-only
  
  # Run only document query test
  node test-rag-endpoints.js --query-only

Prerequisites:
  1. Deploy both edge functions to Supabase
  2. Set up the database schema (run the SQL migration)
  3. Create a test user account
  4. Set the required environment variables
  5. Ensure you have the 'documents' storage bucket created
`);
}

// Handle command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  
  if (args.includes('--health-only')) {
    testEndpointHealth();
  } else if (args.includes('--process-only')) {
    testProcessDocument();
  } else if (args.includes('--query-only')) {
    testQueryDocument();
  } else {
    runFullRAGTest();
  }
}

module.exports = {
  runFullRAGTest,
  printUsage
}; 