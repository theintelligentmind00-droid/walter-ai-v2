const cron = require('node-cron');
const config = require('../utils/config');
const logger = require('../utils/logger');
const brain = require('./walter-brain');
const ollamaClient = require('./ollama-client');
const memoryManager = require('../memory/memory-manager');
const xClient = require('../social/x-client');
const postComposer = require('../social/post-composer');
const feedReader = require('../social/feed-reader');

// Convert minutes to a cron expression
// For sub-minute intervals in testing, we use setInterval instead
function buildCronExpression(minutes) {
  if (minutes >= 1) {
    return `*/${Math.round(minutes)} * * * *`;
  }
  return null; // Signal to use setInterval
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// Advance Walter's simulated clock by one tick
function advanceClock(state) {
  const minutesPerTick = config.tick.intervalMinutes;
  const hoursAdvanced = minutesPerTick / 60;

  state.hour = (state.hour + hoursAdvanced) % 24;

  // Increment day when hour wraps past midnight
  if (state.hour < hoursAdvanced) {
    state.day += 1;
  }
}

function isSleeping(state) {
  const { sleepHour, wakeHour } = config.walter;
  const h = Math.floor(state.hour);
  if (sleepHour > wakeHour) {
    // Spans midnight: e.g. sleep 23, wake 7
    return h >= sleepHour || h < wakeHour;
  }
  return h >= sleepHour && h < wakeHour;
}

// Execute a social action decided by Walter's brain
async function executeSocialAction(decision, state, memories) {
  switch (decision.action) {
    case 'post_x': {
      const tweet = await postComposer.composeTweet(state, memories);
      const posted = await xClient.postTweet(tweet);
      logger.tick(`Walter tweeted: "${tweet}"`);
      memoryManager.addSocialInteraction({
        type: 'tweet_posted',
        content: tweet,
        tweetId: posted.id,
      });
      // Override decision content with the actual tweet text
      decision.content = `Posted on X: "${tweet}"`;
      break;
    }

    case 'read_x': {
      const feedResult = await feedReader.readAndSummarizeFeed(10);
      if (feedResult) {
        logger.tick(`Walter read his feed: ${feedResult.summary.slice(0, 80)}...`);
        // Apply feed mood impact on top of brain's decision
        state.mood = clamp(state.mood + feedResult.moodImpact, -1, 1);
        memoryManager.addSocialInteraction({
          type: 'feed_read',
          content: feedResult.summary,
          tweetCount: feedResult.tweetCount,
        });
        decision.content = feedResult.summary;
      }
      break;
    }

    case 'reply_x': {
      const replies = await feedReader.checkReplies();
      if (replies.length === 0) {
        logger.tick('No replies to respond to. Walter thinks instead.');
        decision.action = 'think';
        break;
      }
      // Pick the most recent reply
      const target = replies[0];
      const replyText = await postComposer.composeReply(target.text, target.author, state);
      if (replyText) {
        await xClient.replyToTweet(target.id, replyText);
        logger.tick(`Walter replied to @${target.author}: "${replyText}"`);
        memoryManager.addSocialInteraction({
          type: 'reply_posted',
          content: replyText,
          toAuthor: target.author,
          toTweet: target.text,
        });
        decision.content = `Replied to @${target.author}: "${replyText}"`;
      } else {
        logger.tick('Walter decided not to reply. Nothing genuine to say.');
        decision.action = 'think';
        decision.content = `Checked replies, saw @${target.author}'s message ("${target.text.slice(0, 60)}"), didn't feel like responding.`;
      }
      break;
    }
  }
}

async function runTick() {
  logger.tick('--- TICK START ---');

  let state;
  try {
    state = memoryManager.loadState();
  } catch (err) {
    logger.error(`Failed to load state: ${err.message}`);
    return;
  }

  state.tickCount = (state.tickCount || 0) + 1;
  advanceClock(state);

  // Check if X is configured and store on state for brain context
  state.xConfigured = await xClient.isConfigured();

  logger.tick(`Tick #${state.tickCount} | Day ${state.day} | Hour ${state.hour.toFixed(1)} | Mood ${state.mood.toFixed(2)} | Energy ${state.energy.toFixed(2)}`);

  // Skip tick if Walter is sleeping
  if (isSleeping(state)) {
    logger.tick('Walter is asleep. Skipping tick.');
    state.energy = clamp(state.energy + 0.05, 0, 1);
    memoryManager.saveState(state);
    return;
  }

  // Check Ollama is up
  const available = await ollamaClient.isAvailable();
  if (!available) {
    logger.error('Ollama is not available. Skipping tick.');
    memoryManager.saveState(state);
    return;
  }

  // Get recent memories for context
  let memories;
  try {
    memories = memoryManager.getRecentMemories(5);
  } catch (err) {
    logger.error(`Failed to load memories: ${err.message}`);
    memories = [];
  }

  // Build social context string for the brain (recent social interactions)
  let socialContext = null;
  try {
    const recentSocial = memoryManager.getRecentSocialInteractions(3);
    if (recentSocial.length > 0) {
      socialContext = recentSocial
        .map(s => `[${s.type}] ${s.content.slice(0, 100)}`)
        .join('\n');
    }
  } catch (err) {
    // Non-critical — brain works without it
  }

  // Ask Walter's brain what to do
  let decision;
  try {
    decision = await brain.decide(state, memories, socialContext);
  } catch (err) {
    logger.error(`Brain failed: ${err.message}`);
    memoryManager.saveState(state);
    return;
  }

  logger.tick(`Action: ${decision.action}`);

  // Execute social actions if chosen
  const isSocialAction = ['post_x', 'read_x', 'reply_x'].includes(decision.action);
  if (isSocialAction) {
    if (!state.xConfigured) {
      logger.warn('Walter chose a social action but X is not configured. Falling back to think.');
      decision.action = 'think';
      decision.content = decision.content || 'Thought about posting something but the moment passed.';
    } else {
      try {
        await executeSocialAction(decision, state, memories);
      } catch (err) {
        logger.error(`Social action failed: ${err.message}. Falling back to think.`);
        decision.action = 'think';
        decision.content = 'Tried to do something online but it didn\'t work out. Moved on.';
      }
    }
  }

  logger.tick(`Content: ${decision.content}`);
  logger.tick(`Inner thought: ${decision.innerThought}`);

  // Apply mood and energy changes
  const moodBefore = state.mood;
  state.mood = clamp(state.mood + decision.moodChange, -1, 1);
  state.energy = clamp(state.energy + decision.energyChange, 0, 1);

  logger.tick(`Mood: ${moodBefore.toFixed(2)} → ${state.mood.toFixed(2)} | Energy: ${state.energy.toFixed(2)}`);

  // Store this tick in short-term memory
  try {
    memoryManager.addMemory({
      action: decision.action,
      content: decision.content,
      innerThought: decision.innerThought,
      mood_before: moodBefore,
      mood_after: state.mood,
      energy: state.energy,
      tags: [decision.action],
    });
  } catch (err) {
    logger.error(`Failed to save memory: ${err.message}`);
  }

  // Save updated state (strip xConfigured — it's derived, not persisted)
  delete state.xConfigured;
  try {
    memoryManager.saveState(state);
  } catch (err) {
    logger.error(`Failed to save state: ${err.message}`);
  }

  logger.tick('--- TICK END ---\n');
}

function start() {
  const minutes = config.tick.intervalMinutes;
  logger.info(`Tick engine starting. Interval: ${minutes} minute(s).`);

  // Run one tick immediately on start
  runTick();

  if (minutes < 1) {
    const ms = Math.round(minutes * 60 * 1000);
    logger.info(`Using setInterval (${ms}ms) for fast testing mode.`);
    setInterval(runTick, ms);
  } else {
    const expr = buildCronExpression(minutes);
    logger.info(`Cron expression: ${expr}`);
    cron.schedule(expr, runTick);
  }
}

module.exports = { start, runTick };
