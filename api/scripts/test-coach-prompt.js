const { buildCoachPrompt } = require('../src/utils/coach-prompt');

console.log('🧪 Testing Coach Prompt Loading');
console.log('==============================');

// Test basic prompt loading
console.log('\n1. Testing basic coach prompt loading...');
try {
  const basicPrompt = buildCoachPrompt({
    tier: 'trial'
  });
  
  console.log('✅ Coach prompt loaded successfully!');
  console.log(`📏 Prompt length: ${basicPrompt.length} characters`);
  
  // Check if it contains key elements from coach.txt
  const keyElements = [
    'Xavo',
    'corporate-influence coach',
    'Power Move:',
    'Bru Le',
    'Strategist',
    'Shark',
    'Trial'
  ];
  
  const foundElements = keyElements.filter(element => basicPrompt.includes(element));
  console.log(`🔍 Found ${foundElements.length}/${keyElements.length} key elements`);
  
  if (foundElements.length === keyElements.length) {
    console.log('✅ All key elements found - coach.txt is being loaded correctly!');
  } else {
    console.log('❌ Missing elements:', keyElements.filter(e => !foundElements.includes(e)));
  }
  
  // Show preview of prompt
  console.log('\n📝 Prompt preview (first 200 chars):');
  console.log(basicPrompt.substring(0, 200) + '...');
  
} catch (error) {
  console.error('❌ Failed to load coach prompt:', error.message);
}

// Test with personalization
console.log('\n2. Testing with personalization...');
try {
  const personalizedPrompt = buildCoachPrompt({
    tier: 'shark',
    userPersonalization: {
      current_position: 'Senior Manager',
      industry: 'Technology',
      seniority_level: 'senior',
      top_challenges: ['team leadership', 'stakeholder management']
    },
    personalityScores: {
      openness: 0.8,
      conscientiousness: 0.7
    }
  });
  
  console.log('✅ Personalized prompt created successfully!');
  console.log(`📏 Personalized prompt length: ${personalizedPrompt.length} characters`);
  
  // Check if personalization data was injected
  if (personalizedPrompt.includes('Senior Manager') && personalizedPrompt.includes('shark')) {
    console.log('✅ Personalization data properly injected!');
  } else {
    console.log('❌ Personalization data not found in prompt');
  }
  
} catch (error) {
  console.error('❌ Failed to create personalized prompt:', error.message);
}

// Test template variable replacement
console.log('\n3. Testing template variable replacement...');
try {
  const testPrompt = buildCoachPrompt({
    tier: 'strategist',
    userPersonalization: {
      current_position: 'Manager'
    }
  });
  
  // Check if template variables were replaced
  const templateVars = ['{{currentDateTime}}', '{{tier}}', '{{token_limit}}'];
  const unreplacedVars = templateVars.filter(varName => testPrompt.includes(varName));
  
  if (unreplacedVars.length === 0) {
    console.log('✅ All template variables properly replaced!');
  } else {
    console.log('❌ Unreplaced variables found:', unreplacedVars);
  }
  
  // Check if current date is included
  const currentYear = new Date().getFullYear().toString();
  if (testPrompt.includes(currentYear)) {
    console.log('✅ Current date properly injected!');
  } else {
    console.log('❌ Current date not found in prompt');
  }
  
} catch (error) {
  console.error('❌ Failed template variable test:', error.message);
}

console.log('\n🎉 Coach prompt testing complete!'); 