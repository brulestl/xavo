const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Coach Prompt File Loading');
console.log('====================================');

// Test the correct path
const correctPath = path.join(__dirname, '..', '..', 'prompts', 'coach.txt');
console.log(`🎯 Testing path: ${correctPath}`);

try {
  const coachContent = fs.readFileSync(correctPath, 'utf-8');
  console.log('✅ Coach prompt loaded successfully!');
  console.log(`📏 Length: ${coachContent.length} characters`);
  
  // Test template variable replacement
  const testPrompt = coachContent
    .replace(/\{\{currentDateTime\}\}/g, new Date().toISOString())
    .replace(/\{\{tier\}\}/g, 'shark')
    .replace(/\{\{token_limit\}\}/g, '128000')
    .replace(/\{\{json user_personalization\}\}/g, JSON.stringify({
      current_position: 'Senior Manager',
      industry: 'Technology'
    }, null, 2))
    .replace(/\{\{json personality_scores\}\}/g, JSON.stringify({
      openness: 0.8
    }, null, 2));
  
  console.log('✅ Template variables replaced successfully!');
  console.log(`📏 Final prompt length: ${testPrompt.length} characters`);
  
  // Verify key elements
  const keyElements = ['Xavo', 'Bru Le', 'Power Move:', 'Strategist', 'Shark', 'Senior Manager'];
  const foundElements = keyElements.filter(element => testPrompt.includes(element));
  console.log(`🔍 Found ${foundElements.length}/${keyElements.length} key elements in final prompt`);
  
  if (foundElements.length === keyElements.length) {
    console.log('🎉 Coach prompt system is working perfectly!');
  }
  
  // Show preview
  console.log('\n📝 Coach prompt preview (first 300 chars):');
  console.log(testPrompt.substring(0, 300) + '...');
  
} catch (error) {
  console.error('❌ Failed to load coach prompt:', error.message);
}

console.log('\n✅ Coach prompt testing complete!'); 