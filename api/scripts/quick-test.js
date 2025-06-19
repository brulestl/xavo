require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

console.log('🔍 Quick RAG Pipeline Test');
console.log('========================');

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function quickTest() {
  try {
    // Test 1: Database connection
    console.log('\n1. Testing database connection...');
    const { count, error: countError } = await supabase
      .from('coach_corpus')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Database error:', countError.message);
      return;
    }
    
    console.log(`✅ Connected! Coach corpus has ${count} entries`);

    // Test 2: Sample data retrieval
    console.log('\n2. Testing data retrieval...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('coach_corpus')
      .select('chunk, source, tags')
      .limit(3);
    
    if (sampleError) {
      console.log('❌ Sample data error:', sampleError.message);
      return;
    }
    
    console.log(`✅ Retrieved ${sampleData.length} sample chunks:`);
    sampleData.forEach((chunk, i) => {
      console.log(`   ${i + 1}. Source: ${chunk.source}`);
      console.log(`      Tags: ${chunk.tags.join(', ')}`);
      console.log(`      Content: ${chunk.chunk.substring(0, 100)}...`);
    });

    // Test 3: OpenAI embedding generation
    console.log('\n3. Testing OpenAI embedding...');
    const testQuery = "How do I handle office politics?";
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: testQuery,
      encoding_format: 'float',
    });
    
    const queryEmbedding = response.data[0].embedding;
    console.log(`✅ Generated embedding (dimension: ${queryEmbedding.length})`);

    // Test 4: Vector search
    console.log('\n4. Testing vector search...');
    const { data: searchResults, error: searchError } = await supabase.rpc('match_coach_corpus', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 3,
    });

    if (searchError) {
      console.log('❌ Vector search error:', searchError.message);
      console.log('This might mean the database function is not installed');
      return;
    }

    console.log(`✅ Vector search returned ${searchResults.length} results:`);
    searchResults.forEach((result, i) => {
      console.log(`   ${i + 1}. Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`      Source: ${result.source}`);
      console.log(`      Content: ${result.chunk.substring(0, 150)}...`);
    });

    console.log('\n🎉 All tests passed! RAG pipeline is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

quickTest(); 