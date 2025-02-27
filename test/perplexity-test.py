import requests
import json

# API key
PERPLEXITY_API_KEY = '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'

# Test configurations
tests = {
    'minimal': {
        'model': 'sonar-pro',
        'messages': [
            {
                'role': 'user',
                'content': 'What is the capital of France?'
            }
        ]
    },
    'full': {
        'model': 'sonar-pro',
        'messages': [
            {
                'role': 'system',
                'content': 'Be precise and concise.'
            },
            {
                'role': 'user',
                'content': 'What is the capital of France?'
            }
        ],
        'max_tokens': 100,
        'temperature': 0.2,
        'top_p': 0.9,
        'frequency_penalty': 1
    },
    'app': {
        'model': 'sonar-pro',
        'messages': [
            {
                'role': 'system',
                'content': 'You are a fact-checker.'
            },
            {
                'role': 'user',
                'content': 'Verify this claim: Paris is the capital of Italy.'
            }
        ],
        'temperature': 0.1,
        'max_tokens': 1500,
        'frequency_penalty': 1
    }
}

def run_test(test_name, params):
    print(f"\n--- Test: {test_name} ---")
    print("Request parameters:")
    print(json.dumps(params, indent=2))
    
    try:
        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers={
                'Authorization': f'Bearer {PERPLEXITY_API_KEY}',
                'Content-Type': 'application/json',
            },
            json=params
        )
        
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Error: {response.text}")
            return
        
        data = response.json()
        
        # Print a summary of the response
        summary = {
            'id': data.get('id'),
            'model': data.get('model'),
            'object': data.get('object'),
            'created': data.get('created'),
            'choices': f"Array with {len(data.get('choices', []))} items" if 'choices' in data else 'undefined',
            'usage': data.get('usage')
        }
        
        print("Response summary:")
        print(json.dumps(summary, indent=2))
        
        # Print the content of the first choice
        if 'choices' in data and len(data['choices']) > 0 and 'message' in data['choices'][0]:
            print("\nFirst choice content:")
            print(data['choices'][0]['message']['content'])
        else:
            print("\nNo content in response")
            print("Full response:")
            print(json.dumps(data, indent=2))
    
    except Exception as e:
        print(f"Error: {str(e)}")

# Run all tests
for test_name, params in tests.items():
    run_test(test_name, params) 