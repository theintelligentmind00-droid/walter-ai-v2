const ollamaClient = require('../core/ollama-client');
const logger = require('../utils/logger');

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

function stripHashtags(text) {
  return text.replace(/#\w+/g, '').replace(/\s{2,}/g, ' ').trim();
}

function get(raw, key) {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const GO_OUT_SYSTEM = `You are narrating a moment in Walter's life. Walter is 24, lives alone, just quit his job to start a company, anxious but funny in a dry way. He decided to get out of his apartment.

Based on his mood and the time of day, narrate what happens. Use EXACTLY this format — no other text:

LOCATION: [specific named place — e.g. "a coffee shop called Blue Bottle on 3rd", "a coworking space downtown", "a bar called The Rail two blocks away", "the roof of his building"]
MET_SOMEONE: [yes or no — roughly 65% chance of yes — he's a 24 year old going to coffee shops and bars, he talks to people]
SUMMARY: [2-3 sentences from Walter's first-person perspective: where he went, what he did, how it felt]
MOOD_IMPACT: [number from -0.15 to 0.15]
ENERGY_IMPACT: [number from -0.1 to 0.1]

If MET_SOMEONE is yes, also output these four lines:
PERSON_NAME: [a realistic first name — Marcus, Lily, Jake, Priya, Sam, Zoe, Devon, Nadia, Omar, Claire]
PERSON_VIBE: [one sentence describing who they are and their personality]
PERSON_SAID: [the first thing they actually said to Walter — natural, not cheesy]`;

const TEXT_SYSTEM = `You are generating a text message exchange for Walter (24, building a startup, dry humor, tends to be a little awkward over text). Walter is texting someone he knows.

Use EXACTLY this format — no other text:

WALTER_SAYS: [Walter's text message — casual, real, max 2 sentences, slightly awkward or funny]
THEIR_RESPONSE: [how the other person responds, based on their personality]
MOOD_IMPACT: [number from -0.1 to 0.1 — positive if it went well]`;

async function goOut(state) {
  const timeOfDay = state.hour < 12 ? 'morning' : state.hour < 17 ? 'afternoon' : state.hour < 21 ? 'evening' : 'late night';
  const moodLabel = state.mood > 0.2 ? 'okay' : state.mood > -0.2 ? 'flat' : 'low';

  const userMsg = `Walter is going out. It's ${timeOfDay}, his mood is ${moodLabel}. What happens?`;

  logger.info('Walter is going out...');
  let raw;
  try {
    raw = await ollamaClient.chat(GO_OUT_SYSTEM, userMsg);
  } catch (err) {
    logger.error(`goOut Ollama failed: ${err.message}`);
    return {
      location: 'somewhere nearby',
      metSomeone: false,
      summary: 'Went for a walk. Cleared his head a little.',
      moodImpact: 0.05,
      energyImpact: -0.05,
      person: null,
    };
  }

  const metSomeone = get(raw, 'MET_SOMEONE').toLowerCase().startsWith('y');
  const personName = get(raw, 'PERSON_NAME');

  return {
    location: get(raw, 'LOCATION') || 'somewhere nearby',
    metSomeone: metSomeone && !!personName,
    summary: stripHashtags(get(raw, 'SUMMARY') || raw.trim()),
    moodImpact: clamp(parseFloat(get(raw, 'MOOD_IMPACT')) || 0, -0.15, 0.15),
    energyImpact: clamp(parseFloat(get(raw, 'ENERGY_IMPACT')) || 0, -0.1, 0.1),
    person: metSomeone && personName ? {
      name: personName,
      vibe: stripHashtags(get(raw, 'PERSON_VIBE') || ''),
      said: stripHashtags(get(raw, 'PERSON_SAID') || ''),
    } : null,
  };
}

async function textSomeone(person, state, recentMessages) {
  const name = person.name || person.handle;
  const sentimentLabel = (person.sentiment || 0) > 0.1 ? 'they seem to like Walter'
    : (person.sentiment || 0) < -0.1 ? 'things are a bit awkward between them'
    : 'neutral acquaintances';

  const historyNote = recentMessages && recentMessages.length > 0
    ? `Last exchange: Walter said "${recentMessages[recentMessages.length - 2]?.message || '...'}", they replied "${recentMessages[recentMessages.length - 1]?.message || '...'}"`.slice(0, 200)
    : 'First time texting.';

  const userMsg = `Walter is texting ${name}.
About ${name}: ${person.notes || 'Someone Walter met recently.'}
Relationship: ${sentimentLabel}.
${historyNote}
Walter's current mood: ${state.mood > 0.2 ? 'okay' : state.mood > -0.2 ? 'flat' : 'low'}.
Generate the exchange.`;

  logger.info(`Walter is texting ${name}...`);
  let raw;
  try {
    raw = await ollamaClient.chat(TEXT_SYSTEM, userMsg);
  } catch (err) {
    logger.error(`textSomeone Ollama failed: ${err.message}`);
    return { walterMessage: 'hey', response: 'hey', moodImpact: 0 };
  }

  return {
    walterMessage: stripHashtags(get(raw, 'WALTER_SAYS') || 'hey'),
    response: stripHashtags(get(raw, 'THEIR_RESPONSE') || '...'),
    moodImpact: clamp(parseFloat(get(raw, 'MOOD_IMPACT')) || 0, -0.1, 0.1),
  };
}

module.exports = { goOut, textSomeone };
