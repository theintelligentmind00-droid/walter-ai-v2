const ollamaClient = require('../core/ollama-client');
const logger = require('../utils/logger');

const TWEET_SYSTEM_PROMPT = `You are Walter. You are 24 years old, living alone, trying to start a company.
You're about to post something on X (Twitter). You post as a real person — no hashtags, no cringe,
no "as someone who..." openers. You're dry, a little self-deprecating, sometimes funny, sometimes
anxious, sometimes weirdly philosophical. You tweet about whatever is actually on your mind.

Write ONE tweet. Plain text only. No hashtags. No @ mentions unless you're directly referencing
someone specific. Under 280 characters. Sound like a real person, not a content creator.
Output ONLY the tweet text — nothing else.`;

const REPLY_SYSTEM_PROMPT = `You are Walter. You are 24 years old, living alone, trying to start a company.
Someone replied to your tweet and you're deciding whether and how to respond.
You reply like a real person — casual, honest, occasionally funny. Short replies. No hashtags.
If you have nothing genuine to say, output exactly: SKIP
Otherwise output ONLY the reply text — nothing else.`;

async function composeTweet(state, recentMemories) {
  const moodLabel = getMoodLabel(state.mood);
  const timeOfDay = getTimeOfDay(state.hour);

  const context = recentMemories.length > 0
    ? recentMemories.slice(-3).map(m => m.content).join(' | ')
    : 'Just existing.';

  const userMessage = `Your current mood: ${moodLabel}
Time of day: ${timeOfDay}
What's been on your mind: ${context}

What do you tweet?`;

  logger.debug('Composing tweet via Ollama...');
  const raw = await ollamaClient.chat(TWEET_SYSTEM_PROMPT, userMessage);
  const tweet = raw.trim().replace(/^["']|["']$/g, ''); // Strip surrounding quotes if LLM adds them

  // Hard enforce 280 char limit
  return tweet.slice(0, 280);
}

async function composeReply(replyText, authorHandle, state) {
  const userMessage = `Someone (@${authorHandle}) replied to one of your tweets:
"${replyText}"

Your current mood: ${getMoodLabel(state.mood)}

How do you respond? (or SKIP if you have nothing genuine to say)`;

  logger.debug(`Composing reply to @${authorHandle} via Ollama...`);
  const raw = await ollamaClient.chat(REPLY_SYSTEM_PROMPT, userMessage);
  const reply = raw.trim().replace(/^["']|["']$/g, '');

  if (reply.toUpperCase() === 'SKIP') return null;
  return reply.slice(0, 280);
}

function getMoodLabel(mood) {
  if (mood >= 0.6) return 'pretty good, almost optimistic';
  if (mood >= 0.2) return 'okay, moving along';
  if (mood >= -0.2) return 'kind of flat, neutral';
  if (mood >= -0.6) return 'a bit low, tired';
  return 'rough, not great';
}

function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'late night';
}

module.exports = { composeTweet, composeReply };
