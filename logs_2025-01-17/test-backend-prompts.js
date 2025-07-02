// Test script for backend prompts endpoint
const fetch = require('node-fetch');

async function testBackendPrompts() {
  console.log('🧪 Testing backend prompts endpoint...');
  
  try {
    const response = await fetch('http://localhost:3000/api/v1/prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'test-user-id',
        count: 3
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Backend response:', data);
    console.log('📊 Prompts count:', data.prompts?.length);
    
    if (data.prompts && Array.isArray(data.prompts)) {
      console.log('🎯 Test completed successfully!');
      data.prompts.forEach((prompt, index) => {
        console.log(`${index + 1}. ${prompt}`);
      });
    } else {
      console.error('❌ Invalid response format');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBackendPrompts(); 