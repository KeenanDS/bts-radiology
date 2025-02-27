// Simple test script for Perplexity API
import https from 'node:https';

// API key
const PERPLEXITY_API_KEY = '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';

// Test data
const testData = {
  model: 'sonar-pro',
  messages: [
    {
      role: 'user',
      content: 'What is the capital of France?'
    }
  ],
  frequency_penalty: 1
};

// Options for the HTTP request
const options = {
  hostname: 'api.perplexity.ai',
  path: '/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json'
  }
};

// Make the request
const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response received');
    try {
      const jsonData = JSON.parse(data);
      console.log('Response data:', JSON.stringify(jsonData, null, 2));
    } catch (error) {
      console.error('Error parsing JSON:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error making request:', error);
});

// Write the data to the request body
const requestBody = JSON.stringify(testData);
console.log('Sending request with body:', requestBody);
req.write(requestBody);
req.end();

console.log('Request sent, waiting for response...'); 