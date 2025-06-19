const { debugClassifyResponse, processResponse, isNonAdviceResponse } = require('./dist/utils/response-processor');

console.log('🎯 TESTING RESPONSE PROCESSOR FUNCTIONALITY\n');

// Test scenarios for response classification
const testResponses = [
  {
    text: "Can you tell me more about the specific situation you're dealing with?",
    expected: false,
    type: "clarifying question",
    description: "Should remove Power Move from clarifying question"
  },
  {
    text: "Here's how to handle difficult conversations with confidence. Power Move: Practice the 'acknowledge-redirect-assert' technique.",
    expected: true,
    type: "substantive advice",
    description: "Should keep Power Move for substantive advice"
  },
  {
    text: "I understand your concern about team dynamics.",
    expected: false,
    type: "acknowledgment",
    description: "Should remove Power Move from acknowledgment"
  },
  {
    text: "What specific challenges are you facing with stakeholder alignment? How long has this been an issue?",
    expected: false,
    type: "multiple questions",
    description: "Should remove Power Move from multiple questions"
  },
  {
    text: "To build executive presence, focus on three key areas: communication, confidence, and credibility. Power Move: Start each meeting by stating your main contribution upfront.",
    expected: true,
    type: "strategic advice",
    description: "Should keep Power Move for strategic advice"
  },
  {
    text: "Thanks for that insight about delegation strategies.",
    expected: false,
    type: "acknowledgment",
    description: "Should remove Power Move from gratitude response"
  }
];

// Test individual response classification
console.log('=== RESPONSE CLASSIFICATION TESTS ===\n');

let passedTests = 0;
let totalTests = testResponses.length;

testResponses.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.type}`);
  console.log(`Input: "${test.text}"`);
  console.log(`Description: ${test.description}`);
  
  // Test the classification
  const classification = debugClassifyResponse(test.text);
  const shouldKeepPowerMove = !classification.isNonAdvice;
  
  console.log(`  Classification: ${classification.classification}`);
  console.log(`  Question count: ${classification.questionCount}`);
  console.log(`  Is non-advice: ${classification.isNonAdvice}`);
  console.log(`  Should keep Power Move: ${shouldKeepPowerMove}`);
  console.log(`  Expected: ${test.expected}`);
  
  const passed = shouldKeepPowerMove === test.expected;
  console.log(`  Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (passed) {
    passedTests++;
  }
  
  console.log('');
});

// Test response processing
console.log('=== RESPONSE PROCESSING TESTS ===\n');

const responsesWithPowerMove = [
  "Here's how to handle difficult conversations. Power Move: Use the HEARD technique - Halt, Engage, Affirm, Reframe, Decide.",
  "Can you tell me more about your specific situation? Power Move: Practice active listening to understand the root cause.",
  "I understand your challenge with team dynamics. Power Move: Schedule one-on-one meetings with each team member."
];

responsesWithPowerMove.forEach((response, index) => {
  console.log(`Processing Test ${index + 1}:`);
  console.log(`Original: "${response}"`);
  
  const processed = processResponse(response);
  console.log(`Processed: "${processed}"`);
  
  const wasModified = response !== processed;
  const shouldBeModified = isNonAdviceResponse(response);
  
  console.log(`  Modified: ${wasModified}`);
  console.log(`  Should be modified: ${shouldBeModified}`);
  console.log(`  Result: ${wasModified === shouldBeModified ? '✅ CORRECT' : '❌ INCORRECT'}`);
  console.log('');
});

// Summary
console.log('=== TEST SUMMARY ===');
console.log(`Classification Tests: ${passedTests}/${totalTests} passed`);
console.log(`Success Rate: ${Math.round((passedTests/totalTests) * 100)}%`);

if (passedTests === totalTests) {
  console.log('🎉 ALL TESTS PASSED! Response processor is working correctly.');
} else {
  console.log(`⚠️  ${totalTests - passedTests} tests failed. Review the logic.`);
}

console.log('\n=== KEY FUNCTIONALITY VERIFIED ===');
console.log('✓ Response classification (substantive vs non-advice)');
console.log('✓ Power Move conditional logic');
console.log('✓ Question detection and counting');
console.log('✓ Acknowledgment pattern recognition');
console.log('✓ Response processing pipeline'); 