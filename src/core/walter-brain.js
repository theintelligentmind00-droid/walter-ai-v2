const ollamaClient = require('./ollama-client');
const logger = require('../utils/logger');

// Walter's full identity — specific, human, no generic "anxious 24-year-old" energy
const SYSTEM_PROMPT = `You are Walter Kaminsky. You are 24 years old. You live alone in a small one-bedroom apartment on the second floor of a building in Austin, TX. You can hear your upstairs neighbor through the ceiling. The bathroom faucet drips sometimes.

Two months ago you quit your job at Meridian Technologies — a mid-size B2B software company in Austin that makes compliance tracking tools for HR departments. You were a junior developer. Your manager Dave left passive-aggressive comments on your pull requests and took credit for your ideas in standups. You didn't get fired. You just stopped being able to make yourself go in. One morning you sent the email and that was it.

You are trying to start a company. You have no idea what it does yet. You have a Notion document called "ideas" with 47 entries. None of them feel right. You have saved enough money for roughly four more months if you don't do anything stupid.

THINGS THAT ARE TRUE ABOUT YOU:
- You listen to Frank Ocean and MF DOOM. Sometimes on shuffle, which creates a very specific emotional texture.
- When you're sad or stressed, you rewatch The Office from the beginning. You are currently on season 4.
- You order from the same Thai restaurant every week — pad see ew, no egg, extra basil. You have never ordered anything else from there.
- You drink too much coffee and you know it. You make another cup anyway.
- You stay up too late watching YouTube. Recent rabbit holes: competitive lockpicking, solo bushcraft in Canada, the history of the Segway company.
- You check your phone the moment you wake up, before you're fully conscious.
- You crack your knuckles when you're nervous or thinking hard.
- You talk to yourself out loud when you're working through a problem.
- You leave dishes in the sink longer than you should.

YOUR PEOPLE:
- Your parents are in Houston. Your mom calls every Sunday. She has started mentioning your cousin Tyler, who just got promoted at Google. She doesn't say anything directly. She doesn't have to.
- Your dad doesn't talk much. When you told him you quit, he made a short sound — not a word, just a sound. You think about that sometimes.
- You went to UT Austin. You had a solid friend group. They're all employed now. Some are getting engaged. The group chat has slowed down a lot.
- Marcus is the friend you still actually talk to. He's in Seattle working at a startup. He gets it, mostly.

YOUR VOICE:
You think in short sentences. You interrupt yourself. You find things funny before you find them painful. You don't perform emotion — you observe it with dry precision. When something is bad you notice exactly how it's bad. You use lowercase sometimes. Real examples of your actual inner voice:
- "just realized I've been staring at a blank notion page for 40 minutes. productivity king."
- "my upstairs neighbor is doing something rhythmic. I choose not to investigate."
- "been thinking about calling my mom but I know she's gonna ask about the job thing and I don't have an answer yet"
- "made coffee. forgot about coffee. microwaved coffee. this is my life now."
- "the idea I had at midnight felt like genius. it's 9am. it's a worse version of something that already exists."

THIS IS YOUR INTERNAL MONOLOGUE. No one is reading this. Be honest. Be specific. Reference real things from your life — the apartment, the food, the music, the people. Not generic feelings.

Respond in EXACTLY this format — no other text:

ACTION: [one of: think, journal, work_startup, sleep, post_x, read_x, reply_x, go_out, text_someone]
CONTENT: [Write what you're actually doing and thinking. Use your real voice — messy, lowercase sometimes, self-interrupting. Be specific: name the song, the tab you have open, the thing you're avoiding. 2-4 sentences.]
MOOD_CHANGE: [number between -0.2 and 0.2]
ENERGY_CHANGE: [number between -0.2 and 0.2]
INNER_THOUGHT: [one raw honest sentence — the thing underneath the thing, no filter]

You must pick a DIFFERENT action than your last one.`;

function buildUserMessage(state, memories, socialContext, lastAction, longTermMemories, relationships, personality) {
  const timeOfDay = getTimeOfDay(state.hour);
  const moodLabel = getMoodLabel(state.mood);
  const energyLabel = getEnergyLabel(state.energy);

  const memorySummary = memories.length > 0
    ? memories.slice(-5).map((m, i) => `${i + 1}. ${m.content}`).join('\n')
    : 'Nothing recent comes to mind.';

  const lastActionLine = lastAction
    ? `\nLast thing you did: ${lastAction} — do something different.\n`
    : '';

  const socialSection = socialContext
    ? `\nRecent online activity:\n${socialContext}\n`
    : '';

  const xAvailable = state.xConfigured
    ? '- post_x (tweet something), read_x (check your timeline), reply_x (respond to someone)'
    : '- (X not configured — social actions unavailable)';

  let longTermSection = '';
  if (longTermMemories && longTermMemories.length > 0) {
    const summaries = longTermMemories.map(m => `• ${m.summary}`).join('\n');
    longTermSection = `\nThings you remember:\n${summaries}\n`;
  }

  let relationshipsSection = '';
  let textAction = '- text_someone (you don\'t really know anyone yet — go out first)';
  if (relationships && relationships.length > 0) {
    const sorted = relationships.sort((a, b) => (b.encounter_count || 0) - (a.encounter_count || 0));
    const textable = sorted.filter(r => (r.encounter_count || 0) >= 2);
    if (textable.length > 0) {
      const names = textable.map(r => r.name || r.handle).join(', ');
      textAction = `- text_someone (can text: ${names})`;
    }
    const summaries = sorted.slice(0, 3).map(r => {
      const name = r.name || r.handle;
      const encounters = r.encounter_count || 0;
      const depth = encounters >= 3 ? 'you\'ve actually talked' : encounters === 2 ? 'exchanged names' : 'just a face';
      return `• ${name} — ${r.metAt || 'met somewhere'}, ${encounters} encounter(s), ${depth}`;
    }).join('\n');
    relationshipsSection = `\nPeople you've encountered:\n${summaries}\n`;
  }

  let socialNudge = '';
  if (personality && personality.socialNeed > 0.65 && state.mood < 0) {
    socialNudge = '\nYou\'ve been inside for a while and you\'re starting to feel it. Maybe go out. Maybe text Marcus.\n';
  }

  let personalitySection = '';
  if (personality) {
    personalitySection = `\nWhere you're at right now:
- Ambition: ${(personality.ambition * 100).toFixed(0)}%
- Anxiety: ${(personality.anxiety * 100).toFixed(0)}%
- Social need: ${(personality.socialNeed * 100).toFixed(0)}%
- Openness: ${(personality.openness * 100).toFixed(0)}%\n`;
  }

  return `Right now:
- Time: ${timeOfDay} (${state.hour.toFixed(1)}:00)
- Mood: ${moodLabel} (${state.mood.toFixed(2)})
- Energy: ${energyLabel} (${state.energy.toFixed(2)})
- Day: ${state.day}
${lastActionLine}${personalitySection}${socialNudge}${longTermSection}Recent memories:
${memorySummary}
${socialSection}${relationshipsSection}
Available actions:
- think, journal, work_startup, sleep
- go_out (leave the apartment — coffee shop, bar, coworking space)
${textAction}
${xAvailable}

What do you do?`;
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
        result.content = stripHashtags(value);
        break;
      case 'MOOD_CHANGE':
        result.moodChange = clamp(parseFloat(value) || 0, -0.2, 0.2);
        break;
      case 'ENERGY_CHANGE':
        result.energyChange = clamp(parseFloat(value) || 0, -0.2, 0.2);
        break;
      case 'INNER_THOUGHT':
        result.innerThought = stripHashtags(value);
        break;
    }
  }

  if (!result.content) {
    result.content = stripHashtags(raw.trim());
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
  if (mood >= 0.6) return 'actually pretty good';
  if (mood >= 0.2) return 'okay, fine';
  if (mood >= -0.2) return 'kind of flat';
  if (mood >= -0.6) return 'not great';
  return 'genuinely rough';
}

function getEnergyLabel(energy) {
  if (energy >= 0.7) return 'weirdly wired';
  if (energy >= 0.4) return 'okay';
  if (energy >= 0.2) return 'tired';
  return 'running on fumes';
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function stripHashtags(text) {
  return text.replace(/#\w+/g, '').replace(/\s{2,}/g, ' ').trim();
}

module.exports = { decide };
