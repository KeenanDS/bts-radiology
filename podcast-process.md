
# Podcast Script Generation Process

## Overview

The "Beyond the Scan" podcast uses AI to generate both content and audio. This document explains how the script generation process works.

## Process Flow

1. **News Collection**:
   - System searches for healthcare & medical imaging news from the past 7-30 days
   - Uses Perplexity API to find relevant, recent stories
   - Prioritizes medical imaging, healthcare technology, and research findings

2. **Script Generation**:
   - Converts news stories to a conversational podcast script
   - Uses a friendly, casual tone as if having a conversation
   - Follows a standard intro → stories → outro format

3. **Audio Generation**:
   - Converts the text script to audio using ElevenLabs TTS

## Script Structure

### Intro Section
The intro follows this structure:
- Greeting and date
- Sponsor mention
- Preview of stories with clear transitions between topics:
  - Uses sequence words: "First," "Next," "Finally"
  - Simplified headlines (conversational, not technical)
  - Brief mention of why stories matter

### Main Content
Each story is presented with:
- Clear transition from previous story
- Conversational explanation of the topic
- Practical implications for healthcare professionals
- Personal reactions and thoughts

### Outro Section
The outro includes:
- Reflection on main story impact
- Call to action for listeners
- Mention of website resources
- Sign-off message

## Headline Simplification

Headlines are simplified in the intro to be more conversational:
- Technical titles are condensed to core concepts
- Format changed from "Study Shows XYZ Discovery in ABC Field" to "a discovery in ABC"
- Detailed explanations are saved for the main story sections

## Best Practices

1. **Clear Transitions**: Always make it obvious when moving from one story to another
2. **Conversational Tone**: Use contractions, varied sentence lengths, occasional verbal fillers
3. **Simplified Technical Content**: Explain complex concepts in accessible language
4. **Personal Touch**: Include host reactions and thoughts on the content

## Audio Considerations

- Script is designed to be read aloud naturally
- Includes pauses and verbal cues that help with audio pacing
- Avoids complex sentence structures that would be difficult to follow in audio format
