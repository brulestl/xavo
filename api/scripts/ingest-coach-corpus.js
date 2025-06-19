const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

// Configuration
const BATCH_SIZE = 50; // Process chunks in batches
const MAX_CHUNK_LENGTH = 8000; // OpenAI embedding limit
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text) {
  try {
    // Truncate text if too long
    const truncatedText = text.substring(0, MAX_CHUNK_LENGTH);
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText.trim(),
      encoding_format: 'float'
    });

    // Track usage
    stats.embeddingTokens += response.usage.total_tokens;
    stats.embeddingCost += (response.usage.total_tokens / 1000) * 0.00002;

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
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

      // Generate embedding
      console.log(`  Generating embedding for chunk ${lineNumber}...`);
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
          processed_at: new Date().toISOString()
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
        await new Promise(resolve => setTimeout(resolve, 100));
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
  console.log('🎉 INGESTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`📁 Files processed: ${stats.totalFiles}`);
  console.log(`📄 Total chunks found: ${stats.totalChunks}`);
  console.log(`✅ Successfully processed: ${stats.processedChunks}`);
  console.log(`⏭️  Skipped chunks: ${stats.skippedChunks}`);
  console.log(`❌ Error chunks: ${stats.errorChunks}`);
  console.log(`⏱️  Duration: ${duration.toFixed(1)} minutes`);
  console.log(`🔤 Embedding tokens: ${stats.embeddingTokens.toLocaleString()}`);
  console.log(`💰 Estimated cost: $${stats.embeddingCost.toFixed(4)}`);
  console.log('='.repeat(60));
}

/**
 * Main ingestion function
 */
async function main() {
  try {
    console.log('🚀 Starting Coach Corpus Ingestion');
    console.log('================================');

    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
      throw new Error('Missing required environment variables. Please set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY');
    }

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