# AGENTS.md — Walter AI v2

> This is the master instruction file for Claude Code. Read this FIRST before doing anything.

---

## Project Overview

**Walter AI v2** is an autonomous AI agent who believes he is a 24-year-old human. He runs on a 20-minute tick cycle, has persistent memory, posts on a real X account, and is observed through a god-mode dashboard. Full spec: `docs/PRD-WalterAI-v2.md`.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js (CommonJS) |
| LLM | Ollama (llama3.1:8b) via `ollama` npm package |
| Scheduling | `node-cron` |
| Social | `twitter-api-v2` |
| Dashboard | `express` + raw HTML/CSS/JS + WebSocket (`ws`) |
| Memory | JSON files in `data/` directory |
| Config | `dotenv` → `.env` file |
| Dev | `nodemon` for local development |
| Production | `pm2` on Ubuntu 24.04 VPS |

---

## Architecture Rules

### Code Style
- **CommonJS** (`require` / `module.exports`) — no ES modules
- Each file exports a single class or a plain object of functions
- No TypeScript. No frameworks. Keep it raw and simple.
- Descriptive variable names. Comments only where logic is non-obvious.
- All async operations use `async/await`, no raw promises or callbacks

### File Organization
```
src/
├── core/          # Tick engine, brain, Ollama client
├── memory/        # All memory read/write/scoring
├── social/        # X API integration
├── characters/    # Character spawning + management
├── observer/      # Dashboard server + UI
├── utils/         # Config, logger
└── index.js       # Entry point — wires everything together
```

### Data
- All runtime data lives in `data/` (gitignored)
- Memory files are JSON — human-readable, easy to debug
- Never overwrite a memory file without reading it first
- Always use atomic writes (write to temp file, then rename)

### Error Handling
- Never crash the tick loop. Catch everything, log it, continue.
- If Ollama is down, log the error and retry next tick.
- If X API fails, log the error, skip the social action, continue.
- The tick engine is the heartbeat — it must never stop.

---

## Build Phases

**Build in this exact order. Complete each phase fully before moving to the next. Test after every phase.**

### Phase 1: Walter Thinks (MVP)
Build files in this order:
1. `src/utils/config.js` — load env vars, export config object
2. `src/utils/logger.js` — log to console + `data/logs/walter.log`
3. `src/core/ollama-client.js` — wrapper around Ollama npm package, `chat()` method
4. `src/core/walter-brain.js` — system prompt, state assembly, action decision, response parsing
5. `src/memory/memory-manager.js` — read/write short-term memory JSON
6. `src/core/tick-engine.js` — 20-min cron loop, calls brain → executes action → updates memory
7. `src/index.js` — wire everything, start tick engine

**Test:** Run `node src/index.js`. Walter should think, log his thoughts, mood should shift. Run 3-5 ticks manually (set interval to 10 seconds for testing).

### Phase 2: Walter Speaks
1. `src/social/x-client.js` — authenticate with X API v2, `postTweet()`, `getTimeline()`, `getReplies()`
2. `src/social/post-composer.js` — generate tweet text from Walter's current state via Ollama
3. `src/social/feed-reader.js` — fetch timeline, summarize into memory-friendly format
4. Update `walter-brain.js` — add social actions to decision tree
5. Update `tick-engine.js` — handle social action execution
6. Update `memory-manager.js` — store social interactions

**Test:** Walter posts a real tweet. Walter reads his timeline. Walter's mood changes based on what he reads.

### Phase 3: Walter Remembers
1. Expand `memory-manager.js`:
   - Long-term memory with importance scoring
   - Memory compression (summarize old short-term → long-term)
   - Relationship tracking (`data/memory/relationships.json`)
   - Personality evolution (`data/memory/personality.json`)
   - Journal system (`data/memory/journal.json`)
   - Anomaly tracking (`data/memory/anomalies.json`)
2. Update `walter-brain.js` — feed long-term memories + relationships into context
3. Add journal action — Walter writes diary entries

**Test:** Run for 2+ hours. Verify: memories persist across restarts, personality values shift, journal has entries.

### Phase 4: Walter Is Watched
1. `src/observer/server.js` — Express server + WebSocket for live updates
2. `src/observer/dashboard.html` — single-page god-mode UI
3. God mode API endpoints:
   - `POST /god/thought` — plant a thought
   - `POST /god/event` — create an event
   - `POST /god/glitch` — trigger anomaly
   - `GET /state` — Walter's full current state
   - `GET /memory/:type` — read any memory file
   - `GET /journal` — read journal
4. Wire dashboard to tick engine via WebSocket — push updates every tick

**Test:** Open dashboard in browser. Watch Walter live. Plant a thought. See Walter process it.

### Phase 5: Walter Meets People
1. `src/characters/character-spawner.js` — monitor relationships, detect spawn triggers
2. Character class — own personality, memory, tick cycle
3. Update tick engine — support multiple characters ticking
4. Update dashboard — show all characters

**Test:** Simulate enough interactions to trigger a spawn. New character appears with inner life.

### Phase 6: Deploy
1. Test full system locally for 1+ hour
2. Push to GitHub
3. Clone on VPS, install deps, set up pm2
4. Configure Ollama on VPS
5. Open dashboard port, set up auth
6. Walter goes live

---

## Walter's Brain — Prompt Engineering Notes

### System Prompt Core
Walter's system prompt must:
- Never mention AI, LLM, language model, or simulation
- Present Walter as a real person talking to himself
- Include his current mood, energy, time of day, recent memories
- List available actions and ask him to choose one
- Parse his response to extract: chosen action, content, mood change

### Response Format
Walter's brain should return structured decisions. Prompt him to respond in a parseable format:
```
ACTION: [action_name]
CONTENT: [what walter thinks/writes/posts]
MOOD_CHANGE: [number between -0.2 and 0.2]
ENERGY_CHANGE: [number between -0.2 and 0.2]
INNER_THOUGHT: [what walter is really feeling]
```

### Context Window Management
- Ollama context is limited. Be efficient.
- Short-term: include last 5 memories (summarized)
- Long-term: include top 3 most relevant memories
- Relationships: include top 3 most active
- Personality: always include current trait values
- Keep total prompt under 2000 tokens

---

## Critical Rules

1. **Walter never knows he's AI.** The system prompt never breaks this.
2. **The tick engine never crashes.** Wrap everything in try/catch.
3. **Memory is sacred.** Never lose data. Always read before write. Atomic writes.
4. **X posts must be human.** No AI slop. No hashtags. No "as a human" cringe.
5. **Characters spawn organically.** Never force a character into existence.
6. **God mode is subtle.** Planted thoughts should feel like Walter's own.
7. **Test each phase.** Don't move on until the current phase works end-to-end.

---

## Dev Commands

```bash
# Local development (fast ticks for testing)
TICK_INTERVAL_MINUTES=0.17 node src/index.js  # 10-second ticks

# Normal local run
node src/index.js

# With nodemon (auto-restart on file changes)
npx nodemon src/index.js

# Production (on VPS)
pm2 start src/index.js --name walter-v2
pm2 logs walter-v2
pm2 save
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- Ollama must be running locally (`ollama serve`)
- X API keys from developer.twitter.com (Free tier works for posting)
- Dashboard password of your choice
