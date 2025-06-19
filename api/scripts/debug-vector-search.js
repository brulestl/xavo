require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

console.log('🔍 Debug Vector Search');
console.log('=====================');

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function debugVectorSearch() {
  try {
    // Step 1: Check if embeddings exist in database
    console.log('\n1. Checking embedding data...');
    const { data: embeddingCheck, error: embeddingError } = await supabase
      .from('coach_corpus')
      .select('id, embedding')
      .not('embedding', 'is', null)
      .limit(5);
    
    if (embeddingError) {
      console.log('❌ Embedding check error:', embeddingError.message);
      return;
    }
    
    console.log(`✅ Found ${embeddingCheck.length} chunks with embeddings`);
    if (embeddingCheck.length > 0) {
      const sampleEmbedding = embeddingCheck[0].embedding;
      console.log(`   Sample embedding type: ${typeof sampleEmbedding}`);
      console.log(`   Sample embedding preview: ${JSON.stringify(sampleEmbedding).substring(0, 100)}...`);
    }

    // Step 2: Generate test query embedding
    console.log('\n2. Generating test query embedding...');
    const testQuery = "leadership communication";
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: testQuery,
      encoding_format: 'float',
    });
    
    const queryEmbedding = response.data[0].embedding;
    console.log(`✅ Generated query embedding (dimension: ${queryEmbedding.length})`);

    // Step 3: Test vector search with very low threshold
    console.log('\n3. Testing vector search with low threshold (0.1)...');
    const { data: lowThresholdResults, error: lowThresholdError } = await supabase.rpc('match_coach_corpus', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 5,
    });

    if (lowThresholdError) {
      console.log('❌ Low threshold search error:', lowThresholdError.message);
      return;
    }

    console.log(`✅ Low threshold search returned ${lowThresholdResults.length} results`);
    
    if (lowThresholdResults.length > 0) {
      console.log('   Top results:');
      lowThresholdResults.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. Similarity: ${(result.similarity * 100).toFixed(2)}%`);
        console.log(`      Source: ${result.source}`);
        console.log(`      Content: ${result.chunk.substring(0, 100)}...`);
      });
    } else {
      console.log('   No results even with 0.1 threshold - investigating further...');
      
      // Step 4: Check the vector search function directly
      console.log('\n4. Testing raw vector distance calculation...');
      
      const { data: rawDistanceCheck, error: rawError } = await supabase
        .from('coach_corpus')
        .select(`
          id, 
          chunk,
          source,
          (embedding <=> '${JSON.stringify(queryEmbedding)}') as distance,
          (1 - (embedding <=> '${JSON.stringify(queryEmbedding)}')) as similarity
        `)
        .not('embedding', 'is', null)
        .order('distance', { ascending: true })
        .limit(5);
      
      if (rawError) {
        console.log('❌ Raw distance check error:', rawError.message);
      } else {
        console.log(`✅ Raw distance calculation returned ${rawDistanceCheck.length} results:`);
        rawDistanceCheck.forEach((result, i) => {
          console.log(`   ${i + 1}. Distance: ${result.distance?.toFixed(4)}, Similarity: ${(result.similarity * 100).toFixed(2)}%`);
          console.log(`      Source: ${result.source}`);
          console.log(`      Content: ${result.chunk.substring(0, 80)}...`);
        });
      }
    }

    // Step 5: Test with corporate influence specific queries
    console.log('\n5. Testing with corporate influence queries...');
    const influenceQueries = [
      "office politics navigation",
      "executive presence building", 
      "stakeholder management",
      "team leadership",
      "communication skills"
    ];

    for (const query of influenceQueries) {
      const queryResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        encoding_format: 'float',
      });
      
      const { data: results } = await supabase.rpc('match_coach_corpus', {
        query_embedding: queryResponse.data[0].embedding,
        match_threshold: 0.5,
        match_count: 2,
      });

      console.log(`   "${query}": ${results?.length || 0} results`);
      if (results && results.length > 0) {
        console.log(`      Best: ${(results[0].similarity * 100).toFixed(1)}% - ${results[0].source}`);
      }
    }

    console.log('\n🎉 Debug analysis complete!');

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugVectorSearch(); 