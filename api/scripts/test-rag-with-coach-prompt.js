require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing RAG Pipeline with Coach Prompt Integration');
console.log('==================================================');

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simulate the coach prompt builder (JavaScript version)
function buildCoachPrompt(options) {
  const {
    tier = 'trial',
    userPersonalization = {},
    personalityScores = {},
    currentDateTime = new Date().toISOString(),
    tokenLimit = getTokenLimitForTier(tier)
  } = options;

  // Load the coach prompt template
  const templatePath = path.join(__dirname, '..', '..', 'prompts', 'coach.txt');
  let promptTemplate = '';
  
  try {
    promptTemplate = fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    console.error('Error loading coach prompt:', error.message);
    return getBasicCoachPrompt(tier);
  }

  // Replace template variables
  let prompt = promptTemplate
    .replace(/\{\{currentDateTime\}\}/g, currentDateTime)
    .replace(/\{\{json user_personalization\}\}/g, JSON.stringify(userPersonalization, null, 2))
    .replace(/\{\{json personality_scores\}\}/g, JSON.stringify(personalityScores, null, 2))
    .replace(/\{\{tier\}\}/g, tier)
    .replace(/\{\{token_limit\}\}/g, tokenLimit.toString());

  return prompt;
}

function getTokenLimitForTier(tier) {
  switch (tier) {
    case 'trial': return 2000;
    case 'strategist': return 32000;
    case 'shark': return 128000;
    default: return 2000;
  }
}

function getBasicCoachPrompt(tier) {
  return `You are Xavo, the corporate-influence coach. Current tier: ${tier}. End responses with "Power Move:".`;
}

// Simulate RAG context building
async function buildRAGContext(userQuery) {
  try {
    // Generate embedding for user query
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userQuery,
      encoding_format: 'float',
    });
    
    const queryEmbedding = response.data[0].embedding;

    // Search coach corpus
    const { data: coachMatches, error } = await supabase.rpc('match_coach_corpus', {
      query_embedding: queryEmbedding,
      match_threshold: 0.45,
      match_count: 3,
    });

    if (error) {
      console.error('RAG search error:', error.message);
      return { coachContext: [], contextUsed: false };
    }

    // Build context string
    let contextString = '';
    if (coachMatches && coachMatches.length > 0) {
      contextString = '\n\nRelevant Coach Expertise:\n';
      coachMatches.forEach((match, index) => {
        contextString += `\n--- Expert Insight ${index + 1} (${(match.similarity * 100).toFixed(1)}% relevant) ---\n`;
        contextString += `Source: ${match.source}\n`;
        contextString += `Content: ${match.chunk}\n`;
      });
      contextString += '\n--- End Expert Insights ---\n';
    }

    return {
      coachContext: coachMatches || [],
      contextString,
      contextUsed: coachMatches && coachMatches.length > 0
    };

  } catch (error) {
    console.error('Error building RAG context:', error.message);
    return { coachContext: [], contextUsed: false };
  }
}

// Test complete RAG integration
async function testRAGIntegration() {
  try {
    console.log('\n1. Testing coach prompt loading...');
    
    // Test user scenario
    const userPersonalization = {
      current_position: 'Senior Manager',
      industry: 'Technology',
      seniority_level: 'senior',
      top_challenges: ['team leadership', 'stakeholder management']
    };
    
    const personalityScores = {
      openness: 0.8,
      conscientiousness: 0.7
    };

    // Build complete coach prompt
    const coachPrompt = buildCoachPrompt({
      tier: 'shark',
      userPersonalization,
      personalityScores
    });

    console.log('✅ Coach prompt built successfully!');
    console.log(`📏 Coach prompt length: ${coachPrompt.length} characters`);
    
    // Verify key elements from coach.txt are included
    const keyElements = [
      'Xavo', 'Bru Le', 'corporate-influence coach',
      'Power Move:', 'Strategist', 'Shark', 'Trial',
      'Senior Manager', 'Technology', 'team leadership'
    ];
    
    const foundElements = keyElements.filter(element => coachPrompt.includes(element));
    console.log(`🔍 Found ${foundElements.length}/${keyElements.length} key elements in coach prompt`);

    console.log('\n2. Testing RAG context retrieval...');
    
    const testQuery = "How do I handle difficult conversations with my team?";
    const ragContext = await buildRAGContext(testQuery);
    
    console.log(`✅ RAG context built - Found ${ragContext.coachContext.length} relevant chunks`);
    console.log(`📊 Context used: ${ragContext.contextUsed ? 'Yes' : 'No'}`);
    
    if (ragContext.contextUsed) {
      console.log('📋 Top coaching insights:');
      ragContext.coachContext.slice(0, 2).forEach((match, i) => {
        console.log(`   ${i + 1}. ${(match.similarity * 100).toFixed(1)}% match from ${match.source}`);
        console.log(`      "${match.chunk.substring(0, 100)}..."`);
      });
    }

    console.log('\n3. Building complete system messages...');
    
    // Build the complete message array as the chat system would
    const messages = [
      {
        role: 'system',
        content: coachPrompt
      }
    ];

    // Add RAG context if available
    if (ragContext.contextUsed) {
      messages.push({
        role: 'system',
        content: `Additional Context: ${ragContext.contextString}`
      });
    }

    // Add user message
    messages.push({
      role: 'user',
      content: testQuery
    });

    console.log('✅ Complete message array built');
    console.log(`📊 System messages: ${messages.filter(m => m.role === 'system').length}`);
    console.log(`📊 Total message content length: ${messages.reduce((sum, m) => sum + m.content.length, 0)} characters`);

    // Verify the system prompt includes key coaching elements
    const systemContent = messages[0].content;
    const coachElements = [
      'max 3 paragraphs',
      'Power Move:',
      'Strategist ($20/mo)',
      'Shark ($200/mo)',
      'Senior / Director',
      'Advisory, incisive'
    ];
    
    const foundCoachElements = coachElements.filter(element => systemContent.includes(element));
    console.log(`🎯 Coach system prompt includes ${foundCoachElements.length}/${coachElements.length} coaching features`);

    if (foundCoachElements.length === coachElements.length) {
      console.log('🎉 Perfect! Your rich coach.txt prompt is fully integrated with RAG!');
    } else {
      console.log('⚠️  Some coaching features missing:', coachElements.filter(e => !foundCoachElements.includes(e)));
    }

    console.log('\n4. Preview of complete system integration:');
    console.log('   📋 System Prompt: Rich Xavo coach with tier/persona features');
    console.log('   📋 RAG Context: Relevant coaching expertise from corpus');
    console.log('   📋 User Query: Personalized based on role and challenges');
    console.log('   🎯 Result: Comprehensive coaching response with expertise backing');

    console.log('\n🎉 RAG + Coach Prompt Integration Test Complete!');
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testRAGIntegration(); 