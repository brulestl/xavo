// Test script for AI prompt service
const { generateAiPrompts } = require('./src/services/aiPromptService.ts');

async function testAiPrompts() {
  console.log('🧪 Testing AI prompt generation...');
  
  try {
    const prompts = await generateAiPrompts(3);
    console.log('✅ Generated prompts:', prompts);
    console.log('📊 Count:', prompts.length);
    console.log('🎯 Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAiPrompts(); 