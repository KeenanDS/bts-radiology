
import { fetchWithRetry } from "./utils.ts";
import { STANDARD_INTRO_BASE, STANDARD_OUTRO_BASE, PODCAST_SCRIPT_SYSTEM_PROMPT } from "./prompts.ts";
import { simplifyHeadline } from "./headline-utils.ts";

// Function to generate podcast script using OpenAI API with improved headline transitions
export async function generatePodcastScript(newsStories, scheduledDate) {
  try {
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    const formattedDate = new Date(scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create a more conversational headlines preview for the intro with clear transitions
    let headlinesPreview = "";
    if (newsStories.length > 0) {
      headlinesPreview = "I've got some really exciting stories to share with you today! ";
      
      if (newsStories.length === 1) {
        headlinesPreview += `We're going to talk about ${simplifyHeadline(newsStories[0].title)}, which has some fascinating implications for our field.`;
      } else {
        // Create a more conversational list with clear transitions
        newsStories.forEach((story, index) => {
          const simplifiedTitle = simplifyHeadline(story.title);
          
          if (index === 0) {
            headlinesPreview += `First, we'll be discussing ${simplifiedTitle}. `;
          } else if (index === newsStories.length - 1) {
            headlinesPreview += `And finally, we'll wrap up with ${simplifiedTitle}. `;
          } else {
            const transitionWords = ["Then", "Next", "After that"];
            const transition = transitionWords[index - 1 % transitionWords.length];
            headlinesPreview += `${transition}, we'll explore ${simplifiedTitle}. `;
          }
        });
        
        headlinesPreview += "I'm really excited to dive into these stories with you because they're all showing us where healthcare is headed.";
      }
      
      // Add a personal touch for the main story
      if (newsStories.length > 0) {
        headlinesPreview += ` I think you'll be particularly interested in our main story about ${simplifyHeadline(newsStories[0].title)}, which I found absolutely fascinating when I was researching for today's episode.`;
      }
    } else {
      // Default text if no stories were found
      headlinesPreview = "Today I've got some really interesting developments in medical imaging to share with you. These are the kinds of advances that are changing how we practice and improving outcomes for our patients. I'm really excited to walk through these with you today.";
    }

    // Create conversational top story impact for the outro
    let topStoryImpact = "";
    if (newsStories.length > 0) {
      topStoryImpact = `You know, I was thinking about our main story today on ${simplifyHeadline(newsStories[0].title)}. It really shows how quickly our field is evolving, and I think it's the kind of development that could make a real difference in patient care. That's what I love about doing this podcast - we get to explore these advances together and think about how they'll shape our work.`;
    }

    // Fill in the dynamic parts of the intro and outro templates
    const introWithDynamicContent = STANDARD_INTRO_BASE
      .replace("{date}", formattedDate)
      .replace("{headlines_preview}", headlinesPreview);
    
    const outroWithDynamicContent = STANDARD_OUTRO_BASE
      .replace("{top_story_impact}", topStoryImpact);

    const newsStoriesText = newsStories.map((story, index) => 
      `Story ${index + 1}: "${story.title}"
${story.summary}
Source: ${story.source}, Date: ${story.date}
`).join("\n\n");

    const userPrompt = `Create a conversational, friendly script for the "Beyond the Scan" podcast episode recorded on ${formattedDate}. 
Use these news stories as the content:

${newsStoriesText}

Please use the exact following intro for the podcast:
${introWithDynamicContent}

Please use the exact following outro for the podcast:
${outroWithDynamicContent}

Remember, this is for audio - DO NOT include any formatting labels or section markers (like "intro:" or "outro:"). The script should be pure spoken content as if Jackie is having a casual conversation with the listener.`;

    const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: PODCAST_SCRIPT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    const data = await response.json();
    return data.choices[0]?.message?.content || "Failed to generate podcast script";
  } catch (error) {
    console.error(`Error in generatePodcastScript: ${error.message}`);
    throw error;
  }
}
