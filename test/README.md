# Perplexity API Test Scripts

These scripts are designed to test the Perplexity API with different parameter configurations to help diagnose issues with our Supabase Edge Function.

## Prerequisites

- Node.js (for the Node.js version)
- Deno (for the Deno version)
- A valid Perplexity API key

## Setup

1. Replace `YOUR_API_KEY_HERE` in both scripts with your actual Perplexity API key.

## Running the Tests

### Node.js Version

```bash
# Install dependencies
npm install node-fetch

# Run the test
node perplexity-test.js
```

### Deno Version

```bash
# Run the test
deno run --allow-net perplexity-test-deno.ts
```

## What These Tests Do

Both scripts test the Perplexity API with three different parameter configurations:

1. **Minimal Parameters**: Just the model and a simple message
2. **Full Parameters**: All parameters as per the documentation
3. **App Parameters**: The parameters we're using in our application

The scripts will log:
- The request parameters
- The response structure
- The content of the first choice in the response

## Interpreting Results

If any of the tests fail, the error message will help identify what's wrong with our API call. Pay special attention to:

- Error messages about invalid parameters
- Unexpected response structures
- Missing fields in the response

Use these insights to fix our Supabase Edge Function. 