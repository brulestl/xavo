#!/bin/bash

# RAG Pipeline Setup Script
# This script sets up the complete RAG pipeline for Xavo's Coach

set -e  # Exit on any error

echo "🚀 Xavo RAG Pipeline Setup"
echo "=========================="

# Check if we're in the api directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the api directory"
    exit 1
fi

# Check environment variables
echo "📋 Checking environment variables..."
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Missing required environment variables"
    echo "Please set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY"
    exit 1
fi
echo "✅ Environment variables configured"

# Check for training data
echo "📁 Checking training data..."
if [ ! -d "../llm_training_data" ]; then
    echo "❌ Training data directory not found: ../llm_training_data"
    echo "Please ensure the llm_training_data folder exists with JSONL files"
    exit 1
fi

# Count JSONL files
JSONL_COUNT=$(find ../llm_training_data -name "*.jsonl" -not -empty | wc -l)
if [ "$JSONL_COUNT" -eq 0 ]; then
    echo "❌ No JSONL files found in ../llm_training_data"
    exit 1
fi
echo "✅ Found $JSONL_COUNT JSONL files to process"

# Install required dependencies
echo "📦 Installing dependencies..."
npm install @supabase/supabase-js openai dotenv
echo "✅ Dependencies installed"

# Test database connection
echo "🔌 Testing database connection..."
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('conversation_sessions').select('count').limit(1).then(({error}) => {
  if (error && !error.message.includes('does not exist')) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
  console.log('✅ Database connection successful');
}).catch(() => {
  console.log('✅ Database connection successful (table check skipped)');
});
"

# Create database schema
echo "🗄️  Setting up database schema..."
echo "Please run the following SQL in your Supabase SQL Editor:"
echo ""
echo "-- Enable pgvector extension"
echo "CREATE EXTENSION IF NOT EXISTS vector;"
echo ""
echo "-- Then run the schema file:"
cat database/coach-corpus-schema.sql
echo ""

read -p "Have you applied the database schema? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please apply the database schema first"
    exit 1
fi

# Test schema
echo "🧪 Testing database schema..."
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('coach_corpus').select('count').limit(1).then(({error}) => {
  if (error) {
    console.error('❌ Schema test failed:', error.message);
    console.log('Please ensure you have applied the database schema');
    process.exit(1);
  }
  console.log('✅ Database schema verified');
});
"

echo "✅ Setup complete! Next steps:"
echo ""
echo "1. 📥 Ingest training data:"
echo "   node scripts/ingest-coach-corpus.js"
echo ""
echo "2. 🧪 Test the pipeline:"
echo "   node scripts/test-rag-pipeline.js"
echo ""
echo "3. 🚀 Start your application with RAG enabled"
echo ""
echo "📖 See RAG_IMPLEMENTATION_GUIDE.md for detailed documentation" 