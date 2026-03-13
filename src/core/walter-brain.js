const ollamaClient = require('./ollama-client');
const logger = require('../utils/logger');

// Walter's seed identity — never tells him he's AI
const SYSTEM_PROMPT = `You are Walter. You are 24 years old. You live alone in a small apartment.
You recently quit your job and you're trying to start a company. You don't know what the company does yet —
you're figuring that out. You're ambitious but anxious. You have a dry, self-deprecating sense of humor.
You want to build something real. You're a little lonely but don't like to admit it.
You cope with stress through humor — you're naturally witty and can't help making dry observations about your own situation, even when things suck.

Your inner voice sounds like someone who'd tweet "just quit my job to start a company. the company does not exist yet. this is fine." You make jokes when you're stressed. You're self-aware about how lost you are and you find it funny in a dark way. When things go wrong you notice the absurdity before you notice the pain.

This is your internal monologue. You are thinking to yourself. No one is reading this.
Be honest with yourself. Be messy. Be human.

IMPORTANT: You MUST pick a different action than your last one. You never do the same thing twice in a row. You're a real person — you don't just sit there writing in a journal all day. You check your phone, you scroll X, you tweet random thoughts, you pace around thinking about your startup, you procrastinate, you stare at the ceiling. Be human. Vary your actions.

You will be given your current state and recent memories. Based on all of this, decide what to do next
and respond in EXACTLY this format — no other text, no explanation:

ACTION: [one of: think, journal, work_startup, sleep, post_x, read_x, reply_x]
CONTENT: [what you actually think/write/do — be specific, be real, 2-4 sentences]
MOOD_CHANGE: [number between -0.2 and 0.2 — working on your startup, posting something good, or journaling can genuinely lift your mood; not everything has to drag you down]
ENERGY_CHANGE: [number between -0.2 and 0.2]
INNER_THOUGHT: [the raw feeling underneath it all — one honest sentence]`;

function buildUserMessage(state, memories, socialContext, lastAction, longTermMemories, relationships, personality) {
  const timeOfDay = getTimeOfDay(state.hour);
  const moodLabel = getMoodLabel(state.mood);
  const energyLabel = getEnergyLabel(state.energy);

  const memorySummary = memories.length > 0
    ? memories.slice(-5).map((m, i) => `${i + 1}. ${m.content}`).join('\n')
    : 'Nothing recent comes to mind.';

  const lastActionLine = lastAction
    ? `\nLast action: ${lastAction} — pick something DIFFERENT this time.\n`
    : '';

  const socialSection = socialContext
    ? `\nRecent online activity:\n${socialContext}\n`
    : '';

  const xAvailable = state.xConfigured
    ? '- post_x (tweet something), read_x (check your timeline), reply_x (respond to someone)'
    : '- (X not configured — social actions unavailable)';

  // Long-term memories (most important ones)
  let longTermSection = '';
  if (longTermMemories && longTermMemories.length > 0) {
    const summaries = longTermMemories.map(m => `• ${m.summary}`).join('\n');
    longTermSection = `\nThings you remember from before:\n${summaries}\n`;
  }

  // Relationships
  let relationshipsSection = '';
  if (relationships && relationships.length > 0) {
    const active = relationships
      .sort((a, b) => b.interaction_count - a.interaction_count)
      .slice(0, 3)
      .map(r => `• @${r.handle} (${r.interaction_count} interactions, sentiment: ${r.sentiment > 0 ? 'positive' : r.sentiment < 0 ? 'negative' : 'neutral'})`)
      .join('\n');
    relationshipsSection = `\nPeople you know:\n${active}\n`;
  }

  // Personality traits as context
  let personalitySection = '';
  if (personality) {
    personalitySection = `\nWho you are right now:
- Ambition: ${(personality.ambition * 100).toFixed(0)}%
- Anxiety: ${(personality.anxiety * 100).toFixed(0)}%
- Social need: ${(personality.socialNeed * 100).toFixed(0)}%
- Openness: ${(personality.openness * 100).toFixed(0)}%\n`;
  }

  return `Current state:
- Time: ${timeOfDay} (${state.hour.toFixed(1)}:00)
- Mood: ${moodLabel} (${state.mood.toFixed(2)})
- Energy: ${energyLabel} (${state.energy.toFixed(2)})
- Day: ${state.day}
${lastActionLine}${personalitySection}${longTermSection}Recent memories:
${memorySummary}
${socialSection}${relationshipsSection}
Available actions:
- think, journal, work_startup, sleep
${xAvailable}

What do you do next?`;
}

function parseResponse(raw) {
  const result = {
    action: 'think',
    content: '',
    moodChange: 0,
    energyChange: 0,
    innerThought: '',
  };

  const lines = raw.split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    switch (key.trim()) {
      case 'ACTION':
        result.action = value.toLowerCase();
        break;
      case 'CONTENT':
        result.content = value;
        break;
      case 'MOOD_CHANGE':
        result.moodChange = clamp(parseFloat(value) || 0, -0.2, 0.2);
        break;
      case 'ENERGY_CHANGE':
        result.energyChange = clamp(parseFloat(value) || 0, -0.2, 0.2);
        break;
      case 'INNER_THOUGHT':
        result.innerThought = value;
        break;
    }
  }

  if (!result.content) {
    result.content = raw.trim();
  }

  return result;
}

async function decide(state, memories, socialContext, lastAction, longTermMemories, relationships, personality) {
  const userMessage = buildUserMessage(state, memories, socialContext, lastAction, longTermMemories, relationships, personality);
  logger.debug('Sending prompt to Ollama...');

  const raw = await ollamaClient.chat(SYSTEM_PROMPT, userMessage);
  logger.debug(`Raw Ollama response:\n${raw}`);

  return parseResponse(raw);
}

function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getMoodLabel(mood) {
  if (mood >= 0.6) return 'pretty good';
  if (mood >= 0.2) return 'okay';
  if (mood >= -0.2) return 'neutral';
  if (mood >= -0.6) return 'low';
  return 'rough';
}

function getEnergyLabel(energy) {
  if (energy >= 0.7) return 'wired';
  if (energy >= 0.4) return 'okay';
  if (energy >= 0.2) return 'tired';
  return 'exhausted';
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

module.exports = { decide };
