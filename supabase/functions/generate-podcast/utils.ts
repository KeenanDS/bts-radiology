
// Maximum retry attempts for API calls
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Helper function to implement retries with exponential backoff
export async function fetchWithRetry(url: string, options: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`API request attempt ${attempt}/${maxRetries}`);
      const response = await fetch(url, options);
      
      // Check if response is successful
      if (response.ok) {
        return response;
      }
      
      // If not successful, get the error message
      const errorText = await response.text();
      lastError = new Error(`Request failed with status ${response.status}: ${errorText}`);
      
      // If this is a server error (5xx), we should retry
      if (response.status >= 500) {
        console.warn(`Server error (${response.status}), retrying in ${RETRY_DELAY_MS * attempt}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt)); // Exponential backoff
        continue;
      }
      
      // For 4xx errors, don't retry as these are client errors
      throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      console.warn(`Request failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt)); // Exponential backoff
    }
  }
  
  // This should never happen due to the throw in the loop, but TypeScript needs it
  throw lastError || new Error('Unknown error during fetch with retry');
}
