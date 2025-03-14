// Helper function to simplify headlines to be more conversational
export function simplifyHeadline(title) {
  // Remove specific patterns commonly found in formal headlines
  let simplifiedTitle = title
    // Convert to lowercase for more casual tone
    .toLowerCase()
    // Remove words like "new", "novel", "latest", "recent" from the beginning
    .replace(/^(new|novel|latest|recent)\s+/i, '')
    // Remove ending phrases like "study finds", "researchers say", etc.
    .replace(/,?\s+(study|research|report|analysis)\s+(finds|says|shows|reveals|suggests|indicates|concludes)\.?$/i, '')
    // Extract main concept from "Title: Subtitle" format
    .replace(/^(.+?):\s+(.+)$/, (_, main, _subtitle) => main);
  
  // Trim the title to keep it concise (around 8-10 words max)
  const words = simplifiedTitle.split(' ');
  if (words.length > 10) {
    simplifiedTitle = words.slice(0, 8).join(' ') + '...';
  }
  
  return simplifiedTitle.trim();
}
