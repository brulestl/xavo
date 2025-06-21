const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const BATCH_SIZE = 50; // Process chunks in batches
const MAX_CHUNK_LENGTH = 8000; // OpenAI embedding limit
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Statistics tracking
let stats = {
  totalFiles: 0,
  totalChunks: 0,
  processedChunks: 0,
  skippedChunks: 0,
  errorChunks: 0,
  startTime: Date.now(),
  embeddingTokens: 0,
  embeddingCost: 0 // $0.00002 per 1K tokens for text-embedding-3-small
};

/**
 * Generate embedding for text using Supabase Edge Functions
 */
async function generateEmbedding(text) {
  try {
    // Truncate text if too long
    const truncatedText = text.substring(0, MAX_CHUNK_LENGTH);
    
    // Get admin session for service operations
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.warn('No session available, using service role key for embeddings...');
    }

    // Call Supabase Edge Functions for embeddings
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        text: truncatedText.trim(),
        model: EMBEDDING_MODEL
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Edge Function failed: ${response.statusText} - ${errorText}`);
      
      // Fallback: return zero vector
      console.log('Using zero vector fallback...');
      const zeroVector = new Array(EMBEDDING_DIMENSION).fill(0);
      
      // Estimate tokens for cost tracking
      const estimatedTokens = Math.ceil(truncatedText.length / 4);
      stats.embeddingTokens += estimatedTokens;
      stats.embeddingCost += (estimatedTokens / 1000) * 0.00002;
      
      return zeroVector;
    }

    const data = await response.json();
    
    // Track usage
    if (data.usage && data.usage.total_tokens) {
      stats.embeddingTokens += data.usage.total_tokens;
      stats.embeddingCost += (data.usage.total_tokens / 1000) * 0.00002;
    } else {
      // Estimate tokens if not provided
      const estimatedTokens = Math.ceil(truncatedText.length / 4);
      stats.embeddingTokens += estimatedTokens;
      stats.embeddingCost += (estimatedTokens / 1000) * 0.00002;
    }

    return data.embedding;

  } catch (error) {
    console.error('Error generating embedding:', error.message);
    console.log('Using zero vector fallback due to error...');
    
    // Return zero vector as fallback
    const zeroVector = new Array(EMBEDDING_DIMENSION).fill(0);
    
    // Estimate tokens for cost tracking
    const estimatedTokens = Math.ceil(text.length / 4);
    stats.embeddingTokens += estimatedTokens;
    stats.embeddingCost += (estimatedTokens / 1000) * 0.00002;
    
    return zeroVector;
  }
}

/**
 * Insert chunks into Supabase in batches
 */
async function insertChunksBatch(chunks) {
  try {
    const { data, error } = await supabase
      .from('coach_corpus')
      .insert(chunks)
      .select('id');

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Error inserting batch:', error.message);
    throw error;
  }
}

/**
 * Process a single JSONL file
 */
async function processJSONLFile(filePath) {
  console.log(`\n📄 Processing: ${path.basename(filePath)}`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let chunks = [];
  let lineNumber = 0;
  let fileChunkCount = 0;

  for await (const line of rl) {
    lineNumber++;
    
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);
      
      // Validate required fields
      if (!data.text || !data.id) {
        console.warn(`Skipping line ${lineNumber}: missing text or id`);
        stats.skippedChunks++;
        continue;
      }

      // Skip if text is too short (less than 50 characters)
      if (data.text.length < 50) {
        console.warn(`Skipping line ${lineNumber}: text too short`);
        stats.skippedChunks++;
        continue;
      }

      // Generate embedding using Edge Functions
      console.log(`  Generating embedding for chunk ${lineNumber} via Edge Functions...`);
      const embedding = await generateEmbedding(data.text);

      // Prepare chunk for database
      const chunk = {
        chunk: data.text,
        embedding: JSON.stringify(embedding), // PostgreSQL vector format
        tags: data.tags || [],
        source: data.source || path.basename(filePath, '.jsonl'),
        speaker: data.speaker || 'Unknown',
        original_id: data.id,
        metadata: {
          original_metadata: data.original_metadata || {},
          file_path: filePath,
          line_number: lineNumber,
          processed_at: new Date().toISOString(),
          embedding_method: 'edge_functions'
        },
        token_count: Math.ceil(data.text.length / 4) // Rough token estimate
      };

      chunks.push(chunk);
      fileChunkCount++;
      stats.totalChunks++;

      // Insert batch when we reach batch size
      if (chunks.length >= BATCH_SIZE) {
        console.log(`  📦 Inserting batch of ${chunks.length} chunks...`);
        const inserted = await insertChunksBatch(chunks);
        stats.processedChunks += inserted;
        chunks = [];
        
        // Brief pause to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (error) {
      console.error(`Error processing line ${lineNumber}:`, error.message);
      stats.errorChunks++;
    }
  }

  // Insert remaining chunks
  if (chunks.length > 0) {
    console.log(`  📦 Inserting final batch of ${chunks.length} chunks...`);
    const inserted = await insertChunksBatch(chunks);
    stats.processedChunks += inserted;
  }

  console.log(`✅ Completed ${path.basename(filePath)}: ${fileChunkCount} chunks processed`);
  return fileChunkCount;
}

/**
 * Get all JSONL files from training data directory
 */
function getJSONLFiles(directory) {
  const files = fs.readdirSync(directory);
  return files
    .filter(file => file.endsWith('.jsonl') && !file.startsWith('.'))
    .map(file => path.join(directory, file))
    .filter(filePath => {
      const stat = fs.statSync(filePath);
      return stat.size > 0; // Skip empty files
    })
    .sort(); // Process in alphabetical order
}

/**
 * Check if corpus already has data
 */
async function checkExistingData() {
  try {
    const { count, error } = await supabase
      .from('coach_corpus')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error checking existing data:', error);
    return 0;
  }
}

/**
 * Print final statistics
 */
function printFinalStats() {
  const duration = (Date.now() - stats.startTime) / 1000 / 60; // minutes
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 INGESTION COMPLETE (Edge Functions)');
  console.log('='.repeat(60));
  console.log(`📁 Files processed: ${stats.totalFiles}`);
  console.log(`📄 Total chunks found: ${stats.totalChunks}`);
  console.log(`✅ Successfully processed: ${stats.processedChunks}`);
  console.log(`⏭️  Skipped chunks: ${stats.skippedChunks}`);
  console.log(`❌ Error chunks: ${stats.errorChunks}`);
  console.log(`⏱️  Duration: ${duration.toFixed(1)} minutes`);
  console.log(`🔤 Embedding tokens: ${stats.embeddingTokens.toLocaleString()}`);
  console.log(`💰 Estimated cost: $${stats.embeddingCost.toFixed(4)}`);
  console.log(`🚀 Method: Supabase Edge Functions`);
  console.log('='.repeat(60));
}

/**
 * Main ingestion function
 */
async function main() {
  try {
    console.log('🚀 Starting Coach Corpus Ingestion (Edge Functions)');
    console.log('===================================================');

    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    console.log('🔧 Configuration:');
    console.log(`   - Supabase URL: ${process.env.SUPABASE_URL}`);
    console.log(`   - Using Edge Functions for embeddings`);
    console.log(`   - Embedding model: ${EMBEDDING_MODEL}`);
    console.log(`   - Fallback: Zero vectors for failed embeddings`);

    // Check for existing data
    const existingCount = await checkExistingData();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing chunks in coach_corpus table`);
      console.log('This will add to existing data. Press Ctrl+C to cancel or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Get training data directory
    const trainingDataDir = path.join(__dirname, '../../llm_training_data');
    if (!fs.existsSync(trainingDataDir)) {
      throw new Error(`Training data directory not found: ${trainingDataDir}`);
    }

    // Get all JSONL files
    const jsonlFiles = getJSONLFiles(trainingDataDir);
    stats.totalFiles = jsonlFiles.length;

    console.log(`📁 Found ${jsonlFiles.length} JSONL files to process`);
    console.log(`📦 Batch size: ${BATCH_SIZE} chunks`);
    console.log(`🔤 Max chunk length: ${MAX_CHUNK_LENGTH} characters`);
    console.log(`🤖 Embedding model: ${EMBEDDING_MODEL}`);
    console.log('');

    // Process each file
    for (let i = 0; i < jsonlFiles.length; i++) {
      const filePath = jsonlFiles[i];
      console.log(`[${i + 1}/${jsonlFiles.length}] Processing ${path.basename(filePath)}`);
      
      try {
        await processJSONLFile(filePath);
      } catch (error) {
        console.error(`❌ Failed to process ${path.basename(filePath)}:`, error.message);
        stats.errorChunks++;
      }
    }

    // Print final statistics
    printFinalStats();

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Process interrupted by user');
  printFinalStats();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { processJSONLFile, generateEmbedding, insertChunksBatch }; 