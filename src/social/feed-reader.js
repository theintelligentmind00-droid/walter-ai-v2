const xClient = require('./x-client');
const ollamaClient = require('../core/ollama-client');
const logger = require('../utils/logger');

const SUMMARIZE_SYSTEM_PROMPT = `You are helping Walter process what he just read on X (Twitter).
Walter is a 24-year-old guy trying to start a company. He doomscrolls like a normal person.
Summarize what he saw into 2-3 sentences written from Walter's perspective — what stood out,
what annoyed him, what was interesting. Keep it personal and honest. No bullet points.
Write in first person as Walter's internal reaction to his feed.`;

async function readAndSummarizeFeed(maxTweets = 10) {
  logger.info('Walter is reading his X timeline...');

  let tweets;
  try {
    tweets = await xClient.getTimeline(maxTweets);
  } catch (err) {
    logger.error(`Failed to fetch timeline: ${err.message}`);
    return null;
  }

  if (!tweets || tweets.length === 0) {
    logger.info('Timeline was empty.');
    return null;
  }

  logger.info(`Fetched ${tweets.length} tweets from timeline.`);

  // Format tweets for Ollama
  const feedText = tweets
    .map(t => `@${t.author}: "${t.text}"`)
    .join('\n');

  const userMessage = `Here's what Walter just scrolled through:\n\n${feedText}\n\nWhat did Walter notice?`;

  let summary;
  try {
    summary = await ollamaClient.chat(SUMMARIZE_SYSTEM_PROMPT, userMessage);
    summary = summary.trim();
  } catch (err) {
    logger.error(`Failed to summarize feed: ${err.message}`);
    // Fall back to a simple summary without LLM
    summary = `Scrolled through ${tweets.length} tweets. Mostly noise. A few things caught my eye but nothing worth dwelling on.`;
  }

  logger.info(`Feed summary: ${summary.slice(0, 80)}...`);

  return {
    tweetCount: tweets.length,
    summary,
    rawTweets: tweets,
    // Simple mood impact: lots of activity = slightly energizing, bad vibes = draining
    moodImpact: estimateMoodImpact(tweets),
  };
}

async function checkReplies() {
  logger.info('Walter is checking his replies...');

  let replies;
  try {
    replies = await xClient.getReplies(5);
  } catch (err) {
    logger.error(`Failed to fetch replies: ${err.message}`);
    return [];
  }

  logger.info(`Found ${replies.length} replies.`);
  return replies;
}

// Rough heuristic: engagement on Walter's stuff = slight mood boost
function estimateMoodImpact(tweets) {
  if (tweets.length === 0) return 0;

  // High engagement content = slightly positive
  const avgLikes = tweets.reduce((sum, t) => sum + t.likes, 0) / tweets.length;
  if (avgLikes > 100) return 0.05;
  if (avgLikes > 10) return 0.02;
  return -0.02; // Doomscrolling default is slightly draining
}

module.exports = { readAndSummarizeFeed, checkReplies };
