
#!/usr/bin/env python3
# handler.py - A wrapper script that will be called by the TypeScript entry point

import json
import sys
from index import Handler

# Read the request from stdin
request_data = sys.stdin.read()
payload = json.loads(request_data)

# Create a handler instance
handler = Handler()

# Set the request properties on the handler
handler.headers = {"Content-Type": "application/json"}
handler.body = request_data

# Call the handler
handler.do_POST()

# Get the response from the handler
response = {
    "success": True,
    "episodeId": payload.get("episodeId"),
    "processedAudioUrl": handler.response_data.get("processedAudioUrl") if hasattr(handler, "response_data") else None
}

# Print the response to stdout (will be captured by the TypeScript entry point)
print(json.dumps(response))
