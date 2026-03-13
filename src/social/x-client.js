const { TwitterApi } = require('twitter-api-v2');
const config = require('../utils/config');
const logger = require('../utils/logger');

let client = null;

function getClient() {
  if (client) return client;

  const { appKey, appSecret, accessToken, accessSecret } = config.x;
  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error('X API credentials missing. Set X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET in .env');
  }

  client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  return client;
}

async function postTweet(text) {
  const c = getClient();
  const result = await c.v2.tweet(text);
  logger.info(`Tweet posted: ${result.data.id} — "${text.slice(0, 50)}..."`);
  return result.data;
}

async function getTimeline(maxResults = 10) {
  const c = getClient();
  // Get the authenticated user's ID first
  const me = await c.v2.me();
  const timeline = await c.v2.homeTimeline({
    max_results: maxResults,
    'tweet.fields': ['author_id', 'created_at', 'text', 'public_metrics'],
    'user.fields': ['name', 'username'],
    expansions: ['author_id'],
  });

  const tweets = timeline.data?.data || [];
  const users = timeline.data?.includes?.users || [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return tweets.map(t => ({
    id: t.id,
    text: t.text,
    author: userMap[t.author_id]?.username || 'unknown',
    authorName: userMap[t.author_id]?.name || 'unknown',
    createdAt: t.created_at,
    likes: t.public_metrics?.like_count || 0,
    retweets: t.public_metrics?.retweet_count || 0,
  }));
}

async function getReplies(maxResults = 10) {
  const c = getClient();
  const me = await c.v2.me();

  // Search for replies mentioning Walter's handle
  const results = await c.v2.search(`@${me.data.username}`, {
    max_results: maxResults,
    'tweet.fields': ['author_id', 'created_at', 'text', 'conversation_id'],
    'user.fields': ['name', 'username'],
    expansions: ['author_id'],
  });

  const tweets = results.data?.data || [];
  const users = results.data?.includes?.users || [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return tweets
    .filter(t => t.author_id !== me.data.id) // Exclude Walter's own tweets
    .map(t => ({
      id: t.id,
      text: t.text,
      author: userMap[t.author_id]?.username || 'unknown',
      authorName: userMap[t.author_id]?.name || 'unknown',
      createdAt: t.created_at,
      conversationId: t.conversation_id,
    }));
}

async function replyToTweet(tweetId, text) {
  const c = getClient();
  const result = await c.v2.reply(text, tweetId);
  logger.info(`Reply posted to ${tweetId}: "${text.slice(0, 50)}..."`);
  return result.data;
}

async function isConfigured() {
  const { appKey, appSecret, accessToken, accessSecret } = config.x;
  return !!(appKey && appSecret && accessToken && accessSecret);
}

module.exports = { postTweet, getTimeline, getReplies, replyToTweet, isConfigured };
