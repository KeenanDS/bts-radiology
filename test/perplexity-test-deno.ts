// Simple test script for Perplexity API using Deno
export {}; // Make this file a module

// Replace with your actual API key
const PERPLEXITY_API_KEY = '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';

async function testPerplexityAPI() {
  console.log('Testing Perplexity API with Deno...');
  
  // Test with minimal parameters
  const minimalTest = {
    model: 'sonar-pro',
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?'
      }
    ]
  };
  
  // Test with all parameters as per documentation
  const fullTest = {
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: 'Be precise and concise.'
      },
      {
        role: 'user',
        content: 'What is the capital of France?'
      }
    ],
    max_tokens: 100,
    temperature: 0.2,
    top_p: 0.9,
    frequency_penalty: 1
  };
  
  // Test with the parameters we're using in our application
  const appTest = {
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: 'You are a fact-checker.'
      },
      {
        role: 'user',
        content: 'Verify this claim: Paris is the capital of Italy.'
      }
    ],
    temperature: 0.1,
    max_tokens: 1500,
    frequency_penalty: 1
  };

  // Run tests
  try {
    console.log('\n--- Test 1: Minimal Parameters ---');
    await runTest(minimalTest);
    
    console.log('\n--- Test 2: Full Parameters ---');
    await runTest(fullTest);
    
    console.log('\n--- Test 3: App Parameters ---');
    await runTest(appTest);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

async function runTest(params: any) {
  console.log('Request parameters:', JSON.stringify(params, null, 2));
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      return;
    }
    
    const data = await response.json();
    console.log('Response structure:', JSON.stringify({
      id: data.id,
      model: data.model,
      object: data.object,
      created: data.created,
      choices: data.choices ? `Array with ${data.choices.length} items` : 'undefined',
      usage: data.usage
    }, null, 2));
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      console.log('First choice content:', data.choices[0].message.content);
    } else {
      console.error('Unexpected response structure:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error during API call:', error);
  }
}

await testPerplexityAPI(); 