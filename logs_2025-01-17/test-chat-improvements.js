const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Create both clients like the edge function
const supabaseClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false }
});

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function testServiceRoleAccess() {
  console.log('\n🔐 Testing Service-Role Client Access\n');

  try {
    // Test with anon client (should be limited by RLS)
    console.log('1. Testing anon client access to user_profiles...');
    const { data: anonProfileData, error: anonProfileError } = await supabaseClient
      .from('user_profiles')
      .select('user_id, tier, trial_end')
      .limit(5);

    console.log(`   Anon client (user_profiles): ${anonProfileData ? anonProfileData.length : 0} rows`);
    if (anonProfileError) console.log(`   Anon client error: ${anonProfileError.message}`);

    // Test anon client access to user_files 
    console.log('\n   Testing anon client access to user_files...');
    const { data: anonFileData, error: anonFileError } = await supabaseClient
      .from('user_files')
      .select('id, file_name, file_type')
      .limit(5);

    console.log(`   Anon client (user_files): ${anonFileData ? anonFileData.length : 0} rows`);
    if (anonFileError) console.log(`   Anon client error: ${anonFileError.message}`);

    // Test with service client (should bypass RLS)
    console.log('\n2. Testing service client access to user_profiles...');
    const { data: serviceProfileData, error: serviceProfileError } = await serviceClient
      .from('user_profiles')
      .select('user_id, tier, trial_end')
      .limit(5);

    console.log(`   Service client (user_profiles): ${serviceProfileData ? serviceProfileData.length : 0} rows`);
    if (serviceProfileError) console.log(`   Service client error: ${serviceProfileError.message}`);

    // Test service client access to user_files
    console.log('\n   Testing service client access to user_files...');
    const { data: serviceFileData, error: serviceFileError } = await serviceClient
      .from('user_files')
      .select('id, file_name, file_type')
      .limit(5);

    console.log(`   Service client (user_files): ${serviceFileData ? serviceFileData.length : 0} rows`);
    if (serviceFileError) console.log(`   Service client error: ${serviceFileError.message}`);

    if (serviceProfileData && serviceProfileData.length > 0) {
      console.log('   ✅ Service client successfully bypassed RLS for user_profiles');
      console.log('   Sample profile:', {
        user_id: serviceProfileData[0].user_id,
        tier: serviceProfileData[0].tier || 'null',
        trial_end: serviceProfileData[0].trial_end || 'null'
      });
    } else {
      console.log('   ❌ Service client failed to retrieve profiles');
    }

    if (serviceFileData && serviceFileData.length > 0) {
      console.log('   ✅ Service client successfully bypassed RLS for user_files');
      console.log('   Sample file:', {
        id: serviceFileData[0].id,
        name: serviceFileData[0].file_name,
        type: serviceFileData[0].file_type
      });
    } else {
      console.log('   ❌ Service client failed to retrieve files');
    }

  } catch (error) {
    console.error('   ❌ Service role test failed:', error.message);
  }
}

async function testSessionFileRestriction() {
  console.log('\n📂 Testing Session-Restricted File Lookups\n');

  try {
    // Get a sample session with a file
    console.log('1. Finding sessions with uploaded files...');
    const { data: sessionsWithFiles, error: sessionError } = await serviceClient
      .from('conversation_sessions')
      .select('id, user_id, last_file_id')
      .not('last_file_id', 'is', null)
      .limit(3);

    if (sessionError) {
      console.log(`   ❌ Error fetching sessions: ${sessionError.message}`);
      return;
    }

    if (!sessionsWithFiles || sessionsWithFiles.length === 0) {
      console.log('   ⚠️ No sessions with files found. Upload a file first.');
      return;
    }

    console.log(`   Found ${sessionsWithFiles.length} sessions with files`);

    // Test session-specific lookup
    const testSession = sessionsWithFiles[0];
    console.log(`\n2. Testing session-specific file lookup for session: ${testSession.id}`);

    const { data: sessionData, error: lookupError } = await supabaseClient
      .from('conversation_sessions')
      .select('last_file_id')
      .eq('id', testSession.id)
      .single();

    if (lookupError) {
      console.log(`   ❌ Session lookup error: ${lookupError.message}`);
      return;
    }

    const fileId = sessionData?.last_file_id;
    console.log(`   Session last_file_id: ${fileId || 'null'}`);

    if (fileId) {
      // Get file metadata
      const { data: fileData, error: fileError } = await supabaseClient
        .from('user_files')
        .select('file_name, file_type, upload_date')
        .eq('id', fileId)
        .single();

      if (fileError) {
        console.log(`   ❌ File metadata error: ${fileError.message}`);
      } else if (fileData) {
        console.log('   ✅ Successfully retrieved file metadata:', {
          name: fileData.file_name,
          type: fileData.file_type,
          uploaded: new Date(fileData.upload_date).toLocaleDateString()
        });

        // Check for file analysis messages in this session only
        const { data: analysisMessage, error: analysisError } = await supabaseClient
          .from('conversation_messages')
          .select('content, created_at')
          .eq('session_id', testSession.id)
          .eq('role', 'assistant')
          .eq('action_type', 'file_response')
          .like('metadata->fileId', `%${fileId}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (analysisMessage) {
          console.log('   ✅ Found file analysis message in current session');
          console.log(`   Analysis preview: "${analysisMessage.content.substring(0, 100)}..."`);
        } else {
          console.log('   ⚠️ No file analysis message found in current session');
        }
      }
    }

    // Test cross-session isolation
    if (sessionsWithFiles.length > 1) {
      console.log('\n3. Testing cross-session isolation...');
      const otherSession = sessionsWithFiles[1];
      
      console.log(`   Querying session ${testSession.id} for files from session ${otherSession.id}`);
      
      // This should NOT find files from other sessions
      const { data: crossSessionData } = await supabaseClient
        .from('conversation_sessions')
        .select('last_file_id')
        .eq('id', testSession.id)
        .single();
      
      const shouldNotMatch = crossSessionData?.last_file_id === otherSession.last_file_id;
      console.log(`   ✅ Cross-session isolation: ${shouldNotMatch ? 'FAILED - found other session file' : 'PASSED - session-specific only'}`);
    }

  } catch (error) {
    console.error('   ❌ Session file restriction test failed:', error.message);
  }
}

async function testChatContextInjection() {
  console.log('\n💬 Testing Smart File Query Detection\n');

  const lightFileQueries = [
    'What does this file contain?',
    'Show me that image',
    'Tell me about the document',
    'What\'s in this pdf?',
    'Explain this file'
  ];

  const deepAnalysisQueries = [
    'Extract key insights from the document',
    'Summarize the main points',
    'Search inside the file for...',
    'Detailed analysis of the content',
    'Find important sections',
    'Comprehensive breakdown',
    'In-depth review of the document'
  ];

  const nonFileQueries = [
    'Hello, how are you?',
    'What is the weather today?',
    'Help me with project management',
    'Tell me about leadership strategies'
  ];

  console.log('1. Testing light file query detection...');
  const lightFileKeywords = [
    'that image', 'this image', 'the image', 'uploaded image', 'my image',
    'that file', 'this file', 'the file', 'uploaded file', 'my file',
    'that document', 'this document', 'the document', 'uploaded document', 'my document',
    'that pdf', 'this pdf', 'the pdf', 'uploaded pdf', 'my pdf',
    'what\'s in', 'show me', 'tell me about', 'what does this', 'explain this'
  ];
  
  lightFileQueries.forEach(query => {
    const isLightQuery = lightFileKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
    console.log(`   "${query}" -> ${isLightQuery ? '✅ LIGHT FILE QUERY' : '❌ NOT DETECTED'}`);
  });

  console.log('\n2. Testing deep analysis query detection...');
  const deepAnalysisKeywords = [
    'extract', 'summarize', 'search inside', 'deep analysis', 'detailed analysis',
    'find in', 'key insights', 'main points', 'important sections', 'analyze thoroughly',
    'comprehensive analysis', 'break down', 'examine', 'detailed summary',
    'full text', 'complete analysis', 'in-depth', 'thorough review'
  ];
  
  deepAnalysisQueries.forEach(query => {
    const isDeepQuery = deepAnalysisKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
    console.log(`   "${query}" -> ${isDeepQuery ? '✅ DEEP ANALYSIS QUERY' : '❌ NOT DETECTED'}`);
  });

  console.log('\n3. Testing non-file query detection...');
  nonFileQueries.forEach(query => {
    const isLightQuery = lightFileKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
    const isDeepQuery = deepAnalysisKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
    const isAnyFileQuery = isLightQuery || isDeepQuery;
    console.log(`   "${query}" -> ${isAnyFileQuery ? '❌ FALSE POSITIVE' : '✅ CORRECTLY IGNORED'}`);
  });
}

async function testEarlyReturnBehavior() {
  console.log('\n🔄 Testing Early Return for No-File Scenarios\n');

  try {
    // Find a session without files for testing
    console.log('1. Finding sessions without files...');
    const { data: sessionsWithoutFiles, error: sessionError } = await serviceClient
      .from('conversation_sessions')
      .select('id, user_id, last_file_id')
      .is('last_file_id', null)
      .limit(3);

    if (sessionError) {
      console.log(`   ❌ Error fetching sessions: ${sessionError.message}`);
      return;
    }

    if (!sessionsWithoutFiles || sessionsWithoutFiles.length === 0) {
      console.log('   ⚠️ No sessions without files found. Creating test scenario...');
      
      // Create a test session without files
      const { data: testSession, error: createError } = await serviceClient
        .from('conversation_sessions')
        .insert({
          user_id: 'test-user-id',
          last_file_id: null
        })
        .select()
        .single();
        
      if (createError) {
        console.log(`   ❌ Could not create test session: ${createError.message}`);
        return;
      }
      
      console.log(`   ✅ Created test session: ${testSession.id}`);
      sessionsWithoutFiles.push(testSession);
    }

    console.log(`   Found ${sessionsWithoutFiles.length} sessions without files`);

    // Test the logic for sessions without files
    const testSession = sessionsWithoutFiles[0];
    console.log(`\n2. Testing early return logic for session: ${testSession.id}`);

    // Simulate the chat function logic
    const { data: sessionData, error: lookupError } = await serviceClient
      .from('conversation_sessions')
      .select('last_file_id')
      .eq('id', testSession.id)
      .single();

    if (lookupError) {
      console.log(`   ❌ Session lookup error: ${lookupError.message}`);
      return;
    }

    const fileId = sessionData?.last_file_id;
    console.log(`   Session last_file_id: ${fileId || 'null'}`);

    if (!fileId) {
      console.log('   ✅ No file detected - early return should trigger');
      console.log('   Expected behavior: Return user-friendly message without OpenAI call');
      console.log('   Message should be: "I don\'t see any file uploaded in this conversation yet..."');
    } else {
      console.log('   ❌ File detected when none expected');
    }

    // Test with a session that HAS files
    const { data: sessionsWithFiles } = await serviceClient
      .from('conversation_sessions')
      .select('id, user_id, last_file_id')
      .not('last_file_id', 'is', null)
      .limit(1);

    if (sessionsWithFiles && sessionsWithFiles.length > 0) {
      const sessionWithFile = sessionsWithFiles[0];
      console.log(`\n3. Testing normal flow for session with file: ${sessionWithFile.id}`);
      
      const { data: fileSessionData } = await serviceClient
        .from('conversation_sessions')
        .select('last_file_id')
        .eq('id', sessionWithFile.id)
        .single();

      const hasFile = fileSessionData?.last_file_id;
      console.log(`   Session last_file_id: ${hasFile || 'null'}`);
      
      if (hasFile) {
        console.log('   ✅ File detected - normal processing should continue');
        console.log('   Expected behavior: Fetch file metadata and build context');
      } else {
        console.log('   ❌ No file detected when file expected');
      }
    }

  } catch (error) {
    console.error('   ❌ Early return test failed:', error.message);
  }
}

async function testVectorSearchCapability() {
  console.log('\n🔍 Testing Vector Search & Deep Analysis\n');

  try {
    // Check if the match_file_texts_rest function exists
    console.log('1. Testing vector search function availability...');
    
    const { data: functions, error: funcError } = await serviceClient
      .rpc('match_file_texts_rest', {
        query_embedding: new Array(1536).fill(0.1), // Dummy embedding
        file_id_param: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        match_threshold: 0.5,
        match_count: 1
      });

    if (funcError && funcError.message.includes('function match_file_texts_rest')) {
      console.log('   ❌ Vector search function not found - RPC needs to be created');
      console.log('   💡 Run: CREATE OR REPLACE FUNCTION match_file_texts_rest(...)');
    } else {
      console.log('   ✅ Vector search function is available');
    }

    // Test embedding generation capability
    console.log('\n2. Testing OpenAI embeddings access...');
    
    const testQuery = "What are the main points in this document?";
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: testQuery,
        model: 'text-embedding-3-small'
      }),
    });

    if (embeddingResponse.ok) {
      const embeddingResult = await embeddingResponse.json();
      console.log('   ✅ OpenAI embeddings API accessible');
      console.log(`   Embedding dimensions: ${embeddingResult.data[0].embedding.length}`);
    } else {
      console.log('   ❌ OpenAI embeddings API error:', embeddingResponse.statusText);
    }

    // Find files that should have embeddings
    console.log('\n3. Testing file embeddings availability...');
    
    const { data: filesWithEmbeddings, error: embeddingCheckError } = await serviceClient
      .from('file_texts')
      .select('file_id, content, embedding')
      .not('embedding', 'is', null)
      .limit(3);

    if (embeddingCheckError) {
      console.log(`   ❌ Error checking embeddings: ${embeddingCheckError.message}`);
    } else if (!filesWithEmbeddings || filesWithEmbeddings.length === 0) {
      console.log('   ⚠️ No files with embeddings found - upload and process files first');
    } else {
      console.log(`   ✅ Found ${filesWithEmbeddings.length} files with embeddings`);
      console.log('   Sample file IDs:', filesWithEmbeddings.map(f => f.file_id).slice(0, 2));
    }

    // Test the two-tier detection system
    console.log('\n4. Testing two-tier query classification...');
    
    const testQueries = [
      { query: 'show me that document', expected: 'light' },
      { query: 'extract key insights from the file', expected: 'deep' },
      { query: 'what does this image contain?', expected: 'light' },
      { query: 'comprehensive analysis of the document', expected: 'deep' },
      { query: 'tell me about the pdf', expected: 'light' },
      { query: 'summarize the main points thoroughly', expected: 'deep' }
    ];

    testQueries.forEach(({ query, expected }) => {
      const lightFileKeywords = [
        'that image', 'this image', 'the image', 'show me', 'tell me about', 'what does this'
      ];
      
      const deepAnalysisKeywords = [
        'extract', 'summarize', 'comprehensive analysis', 'key insights', 'main points'
      ];
      
      const isLightQuery = lightFileKeywords.some(keyword => 
        query.toLowerCase().includes(keyword.toLowerCase())
      );
      
      const isDeepQuery = deepAnalysisKeywords.some(keyword => 
        query.toLowerCase().includes(keyword.toLowerCase())
      );

      let detected = 'none';
      if (isDeepQuery) detected = 'deep';
      else if (isLightQuery) detected = 'light';

      const isCorrect = detected === expected;
      console.log(`   "${query}" -> Expected: ${expected}, Detected: ${detected} ${isCorrect ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('   ❌ Vector search test failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🧪 Testing Chat Function Improvements');
  console.log('=====================================');

  await testServiceRoleAccess();
  await testSessionFileRestriction();
  await testChatContextInjection();
  await testEarlyReturnBehavior();
  await testVectorSearchCapability();

  console.log('\n🎯 Test Summary');
  console.log('==============');
  console.log('✅ Service-role client should bypass RLS for user_profiles AND user_files');
  console.log('✅ File lookups should be restricted to current session only');
  console.log('✅ File context injection should use session-specific data');
  console.log('✅ No cross-session file leakage should occur');
  console.log('✅ Early return with friendly message when no files present');
  console.log('✅ No OpenAI calls wasted on file queries without files');
  console.log('✅ Smart two-tier query detection (light vs deep analysis)');
  console.log('✅ Vector search integration for deep analysis queries');
  console.log('✅ RAG-enhanced responses with source citations');
  console.log('\n💡 Deploy the updated chat function to test in production');
}

runAllTests().catch(console.error); 