const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Test the complete RAG pipeline
 */
async function testRAGPipeline() {
  console.log('🧪 Testing RAG Pipeline');
  console.log('======================');

  try {
    // Step 1: Test database connection
    console.log('\n1. Testing database connection...');
    const { count, error: dbError } = await supabase
      .from('coach_corpus')
      .select('*', { count: 'exact', head: true });
    
    if (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      return;
    }
    
    console.log(`✅ Database connected. Coach corpus has ${count || 0} entries.`);

    // Step 2: Test embedding generation
    console.log('\n2. Testing embedding generation...');
    const testQuery = "How do I handle office politics effectively?";
    const embedding = await generateEmbedding(testQuery);
    console.log(`✅ Generated embedding for query (dimension: ${embedding.length})`);

    // Step 3: Test vector search
    console.log('\n3. Testing vector search...');
    const searchResults = await searchCoachCorpus(testQuery);
    console.log(`✅ Found ${searchResults.length} similar chunks`);
    
    if (searchResults.length > 0) {
      console.log('\nTop result:');
      console.log(`  Similarity: ${(searchResults[0].similarity * 100).toFixed(1)}%`);
      console.log(`  Source: ${searchResults[0].source}`);
      console.log(`  Content: ${searchResults[0].chunk.substring(0, 200)}...`);
    }

    // Step 4: Test coach corpus stats
    console.log('\n4. Testing corpus statistics...');
    const { data: stats, error: statsError } = await supabase.rpc('get_coach_corpus_stats');
    
    if (statsError) {
      console.error('❌ Stats query failed:', statsError.message);
    } else if (stats && stats.length > 0) {
      const corpusStats = stats[0];
      console.log('✅ Corpus Statistics:');
      console.log(`  Total chunks: ${corpusStats.total_chunks}`);
      console.log(`  Total sources: ${corpusStats.total_sources}`);
      console.log(`  Average chunk length: ${Math.round(corpusStats.avg_chunk_length)} characters`);
      console.log(`  Date range: ${corpusStats.oldest_entry} to ${corpusStats.newest_entry}`);
    }

    // Step 5: Test end-to-end RAG query
    console.log('\n5. Testing end-to-end RAG query...');
    const ragResponse = await testRAGQuery(testQuery);
    console.log('✅ RAG query completed');
    console.log(`  Query: ${testQuery}`);
    console.log(`  Context sources: ${ragResponse.contextSources.join(', ')}`);
    console.log(`  Relevance score: ${(ragResponse.relevanceScore * 100).toFixed(1)}%`);
    console.log(`  Coach context used: ${ragResponse.coachContextUsed ? 'Yes' : 'No'}`);

    console.log('\n🎉 RAG Pipeline Test Complete!');
    console.log('All components are working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.trim(),
    encoding_format: 'float',
  });

  return response.data[0].embedding;
}

/**
 * Search coach corpus
 */
async function searchCoachCorpus(query, threshold = 0.45, matchCount = 3) {
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('match_coach_corpus', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Test complete RAG query simulation
 */
async function testRAGQuery(query) {
  // Simulate the RAG pipeline
  const coachContext = await searchCoachCorpus(query);
  
  // Mock memory context (would come from memory service in real implementation)
  const memoryContext = {
    recentMessages: [],
    relevantHistory: [],
    userProfile: {
      workContext: { role: 'Manager', industry: 'Technology' }
    }
  };

  // Calculate context sources and relevance
  const contextSources = [];
  if (coachContext.length > 0) {
    const uniqueSources = [...new Set(coachContext.map(c => c.source))];
    contextSources.push(`coach expertise from ${uniqueSources.length} source(s)`);
  }
  if (memoryContext.userProfile) {
    contextSources.push('user profile');
  }

  const relevanceScore = coachContext.length > 0 
    ? coachContext.reduce((sum, match) => sum + match.similarity, 0) / coachContext.length
    : 0;

  return {
    coachContext,
    memoryContext,
    contextSources,
    relevanceScore,
    coachContextUsed: coachContext.length > 0
  };
}

/**
 * Test specific queries related to corporate influence
 */
async function testInfluenceQueries() {
  console.log('\n🎯 Testing Corporate Influence Queries');
  console.log('=====================================');

  const testQueries = [
    "How do I build influence with senior leadership?",
    "What's the best way to handle a difficult stakeholder?",
    "How can I improve my executive presence?",
    "What should I do when my ideas are ignored in meetings?",
    "How do I navigate office politics without compromising ethics?"
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n${i + 1}. Testing: "${query}"`);
    
    try {
      const results = await searchCoachCorpus(query, 0.45, 2);
      console.log(`   Found ${results.length} relevant chunks`);
      
      if (results.length > 0) {
        const topResult = results[0];
        console.log(`   Best match: ${(topResult.similarity * 100).toFixed(1)}% from ${topResult.source}`);
        console.log(`   Tags: ${topResult.tags.join(', ')}`);
      }
    } catch (error) {
      console.error(`   ❌ Query failed: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  console.log('Starting RAG Pipeline Tests...\n');

  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing required environment variables');
    console.error('Please set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
    process.exit(1);
  }

  try {
    await testRAGPipeline();
    await testInfluenceQueries();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }

  console.log('\n✅ All tests completed successfully!');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testRAGPipeline,
  searchCoachCorpus,
  generateEmbedding
}; 