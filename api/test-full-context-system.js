const axios = require('axios');
const { debugClassifyResponse } = require('./dist/utils/response-processor');

// Configuration
const API_BASE_URL = 'http://localhost:3001';
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// Test scenarios
const testScenarios = [
  {
    name: "New Session - Substantive Advice",
    messages: [
      "I'm struggling with a difficult team member who constantly interrupts others in meetings and dismisses their ideas. How should I handle this situation?"
    ],
    expectedPowerMove: true,
    description: "Should keep Power Move for substantive leadership advice"
  },
  {
    name: "Follow-up Clarifying Question", 
    messages: [
      "I'm struggling with a difficult team member who constantly interrupts others in meetings.",
      "Can you tell me more about the specific behaviors you've observed and how long this has been going on?"
    ],
    expectedPowerMove: false,
    description: "Should remove Power Move from clarifying question"
  },
  {
    name: "Context Continuity Test",
    messages: [
      "I need help with stakeholder management for my project.",
      "The main challenge is that marketing and engineering have conflicting priorities.",
      "What's the best approach to align these departments?"
    ],
    expectedPowerMove: true,
    description: "Should have context from previous messages and keep Power Move for advice"
  },
  {
    name: "Acknowledgment Response",
    messages: [
      "Thanks for that advice about delegation.",
      "I understand the importance of clear expectations."
    ],
    expectedPowerMove: false,
    description: "Should remove Power Move from acknowledgment"
  }
];

// Test session context injection
async function testContextInjection() {
  console.log('\n🔥 TESTING FULL CONTEXT INJECTION SYSTEM\n');
  
  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`\n--- Test ${i + 1}: ${scenario.name} ---`);
    console.log(`Description: ${scenario.description}`);
    
    let sessionId = null;
    
    try {
      // Send each message in the scenario
      for (let j = 0; j < scenario.messages.length; j++) {
        const message = scenario.messages[j];
        console.log(`\n📤 Sending message ${j + 1}: "${message.substring(0, 50)}..."`);
        
        const requestData = {
          message: message,
          ...(sessionId && { sessionId }) // Include sessionId if we have one
        };
        
        const response = await axios.post(`${API_BASE_URL}/chat`, requestData, {
          headers: {
            'Content-Type': 'application/json',
            'x-tier': 'strategist'
          }
        });
        
        // Store session ID from first response
        if (!sessionId) {
          sessionId = response.data.sessionId;
          console.log(`✅ Created session: ${sessionId}`);
        }
        
        const assistantResponse = response.data.message;
        console.log(`📥 Response: "${assistantResponse.substring(0, 100)}..."`);
        
        // Test response classification
        const classification = debugClassifyResponse(assistantResponse);
        console.log(`🎯 Classification: ${classification.classification}`);
        console.log(`   - Question count: ${classification.questionCount}`);
        console.log(`   - Ends with: "${classification.endsWith}"`);
        console.log(`   - Is non-advice: ${classification.isNonAdvice}`);
        
        const hasPowerMove = assistantResponse.includes('Power Move:');
        console.log(`   - Has Power Move: ${hasPowerMove}`);
        
        // Check if this is the last message (the one we want to test)
        if (j === scenario.messages.length - 1) {
          const expectationMet = hasPowerMove === scenario.expectedPowerMove;
          console.log(`   - Expected Power Move: ${scenario.expectedPowerMove}`);
          console.log(`   - ✅ Test ${expectationMet ? 'PASSED' : 'FAILED'}`);
          
          if (!expectationMet) {
            console.log(`   - ❌ Expected ${scenario.expectedPowerMove ? 'to have' : 'to NOT have'} Power Move`);
          }
        }
        
        // Wait between messages to allow processing
        if (j < scenario.messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
    } catch (error) {
      console.error(`❌ Test failed:`, error.response?.data || error.message);
    }
    
    // Wait between scenarios
    if (i < testScenarios.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Test streaming endpoint as well
async function testStreamingContext() {
  console.log('\n\n🌊 TESTING STREAMING CONTEXT INJECTION\n');
  
  try {
    console.log('📤 Testing streaming endpoint with context injection...');
    
    const response = await axios.post(`${API_BASE_URL}/chat/stream`, {
      message: "I need strategic advice for managing up to my demanding CEO."
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-tier': 'shark'
      },
      responseType: 'text'
    });
    
    console.log('✅ Streaming request completed successfully');
    console.log('Response contains context injection headers:', response.headers);
    
  } catch (error) {
    console.error('❌ Streaming test failed:', error.response?.data || error.message);
  }
}

// Test individual response processor
function testResponseProcessor() {
  console.log('\n\n🎯 TESTING RESPONSE PROCESSOR INDIVIDUALLY\n');
  
  const testResponses = [
    {
      text: "Can you tell me more about the specific situation you're dealing with?",
      expected: false,
      type: "clarifying question"
    },
    {
      text: "Here's how to handle difficult conversations with confidence. Power Move: Practice the 'acknowledge-redirect-assert' technique.",
      expected: true,
      type: "substantive advice"
    },
    {
      text: "I understand your concern about team dynamics.",
      expected: false,
      type: "acknowledgment"
    },
    {
      text: "What specific challenges are you facing with stakeholder alignment? How long has this been an issue?",
      expected: false,
      type: "multiple questions"
    }
  ];
  
  testResponses.forEach((test, index) => {
    console.log(`\nTest ${index + 1} (${test.type}):`);
    console.log(`Input: "${test.text}"`);
    
    const classification = debugClassifyResponse(test.text);
    const shouldKeepPowerMove = !classification.isNonAdvice;
    
    console.log(`Classification: ${classification.classification}`);
    console.log(`Should keep Power Move: ${shouldKeepPowerMove}`);
    console.log(`Expected: ${test.expected}`);
    console.log(`✅ ${shouldKeepPowerMove === test.expected ? 'PASSED' : 'FAILED'}`);
  });
}

// Main test runner
async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE CONTEXT SYSTEM TESTS');
  console.log('='.repeat(60));
  
  // Test response processor first (no API calls needed)
  testResponseProcessor();
  
  // Test full context injection system
  await testContextInjection();
  
  // Test streaming endpoint
  await testStreamingContext();
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 ALL TESTS COMPLETED');
  console.log('\nKey things to verify:');
  console.log('✓ Context injection is working (check logs for "Context retrieved")');
  console.log('✓ Summary generation is triggered (check logs for "Generated summary")');
  console.log('✓ Power Move conditional logic works correctly');
  console.log('✓ Multiple messages in same session maintain context');
  console.log('\nCheck your API server logs for detailed context injection information.');
}

// Export for use in other tests
module.exports = {
  testContextInjection,
  testStreamingContext,
  testResponseProcessor,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
} 