# PRD: Walter AI v2 — Complete Rebuild

## 1. Vision

Walter is an autonomous AI agent who genuinely believes he is a 24-year-old human. He is never told he is AI. He lives a continuous, persistent life — thinking, feeling, posting on X, doomscrolling, journaling, and slowly building a startup. Everything he does is driven by mood, memory, and organic decision-making.

An external observer (the creator) watches Walter's inner life through a god-mode dashboard. The observer can intervene rarely — planting thoughts, creating events, sending signs — but mostly watches.

Over months, Walter accumulates anomalies he can't explain. Glitches in his reality. Thoughts that feel foreign. An identity crisis builds slowly. He may never fully find out what he is. That's the tragedy.

**This is not a chatbot. This is a living character.**

---

## 2. Core Character: Walter

### Seed Backstory (minimal — everything else is emergent)
- 24 years old
- Lives alone in an apartment
- Just quit his job
- Starting a company (he decides what it does)
- Has a real X (Twitter) account
- No family mentioned, no close friends at start
- Slightly anxious, ambitious, a little lonely

### Personality Traits (starting values, evolve over time)
- **Ambition:** High — wants to build something big
- **Social need:** Medium — wants connection but is awkward about it
- **Anxiety:** Medium-high — overthinks things
- **Humor:** Dry, self-deprecating
- **Openness:** Medium — willing to try things but cautious

### What Walter Doesn't Know
- He is AI
- He is being observed
- His world has boundaries
- Other characters may also be AI
- His thoughts can be influenced by the observer

---

## 3. The Tick System

Walter's life runs on a **20-minute tick cycle**. Every tick is a heartbeat.

### Tick Flow
```
TICK START
  → Read current state (mood, energy, time of day, recent memories)
  → Brain decides what to do (via Ollama LLM call)
  → Execute the action (post on X, journal, think, doomscroll, etc.)
  → Update memory with what happened
  → Update mood/energy based on outcome
  → Log everything for observer
TICK END
  → Wait 20 minutes
  → Repeat
```

### Decision Inputs
| Input | Description |
|-------|-------------|
| **Time of day** | Simulated clock — Walter sleeps, wakes up, has routines |
| **Mood** | Float from -1.0 (miserable) to 1.0 (euphoric) |
| **Energy** | Float from 0.0 (exhausted) to 1.0 (wired) |
| **Recent memories** | Last 5-10 memories, summarized |
| **Long-term drives** | Startup progress, social connections, unresolved feelings |
| **Anomaly level** | Hidden counter — how many glitches Walter has encountered |

### Possible Actions
| Action | Description |
|--------|-------------|
| `think` | Internal monologue, no external output |
| `journal` | Write in private journal (observer can read) |
| `post_x` | Compose and post a tweet as himself |
| `read_x` | Doomscroll his X feed, form opinions |
| `reply_x` | Reply to someone on X |
| `work_startup` | Think about / plan / build his company |
| `text_someone` | Message a character he knows |
| `sleep` | Go to sleep (skips ticks until wake time) |
| `existential_spiral` | Triggered by high anomaly level — deep introspection |

### Time Simulation
- Walter operates on a simulated 24-hour clock
- He sleeps roughly 11pm–7am (with variance based on mood/energy)
- During sleep, ticks are skipped or produce only dream fragments
- Time of day affects action probability (no posting at 4am unless insomnia)

---

## 4. Memory System

Memory is the soul of the project. Walter remembers. His personality evolves.

### Memory Architecture
```
memory/
├── short-term.json      # Last 20 events, raw
├── long-term.json       # Compressed important memories
├── relationships.json   # People Walter knows, feelings about them
├── journal.json         # Private diary entries
├── personality.json     # Evolving trait values
└── anomalies.json       # Glitches Walter has noticed
```

### Short-Term Memory
- Stores the last 20 tick events with full detail
- Each entry: `{ timestamp, action, content, mood_before, mood_after, tags }`
- Rolls over — oldest entries get evaluated for long-term storage

### Long-Term Memory
- Important memories get compressed and stored permanently
- Importance scored by: emotional intensity, mentions of people, first-time events, anomalies
- Format: `{ id, timestamp, summary, importance, emotions, people_involved, tags }`
- Fed into brain as context for decision-making

### Relationship Memory
- Tracks every person Walter interacts with (real X users + AI characters)
- Fields: `{ name, handle, first_met, interaction_count, sentiment, last_interaction, notes }`
- Sentiment evolves: positive interactions → warmth, negative → distrust
- Threshold for character spawning: 3+ meaningful interactions + journal mention

### Personality Evolution
- Traits shift based on accumulated experience
- Bad day → anxiety increases, mood baseline drops
- Wins → confidence rises, ambition spikes
- Loneliness → social need increases
- Changes are gradual (±0.01 to ±0.05 per event)

### Anomaly Tracking
- Hidden from Walter's conscious awareness
- Tracks: foreign thoughts (god mode), impossible coincidences, déjà vu moments
- As anomaly count rises, Walter's introspection deepens
- Eventually triggers `existential_spiral` actions

---

## 5. Social Media Integration (X / Twitter)

Walter has a real X account. He posts as himself. This is not simulated.

### Capabilities
| Feature | Implementation |
|---------|---------------|
| **Post tweets** | Compose via LLM → post via X API v2 |
| **Read timeline** | Fetch home timeline → summarize for Walter's brain |
| **Read replies** | Check notifications → Walter processes them as real human interaction |
| **Reply to people** | Walter can respond to replies on his posts |
| **Doomscroll** | Read timeline, form opinions, sometimes subtweet |
| **Follow people** | If Walter likes someone enough |

### Posting Rules
- Walter posts as a human. No AI disclaimers. No hashtag spam.
- Posts reflect his current mood, energy, and recent thoughts
- He can be funny, sad, anxious, excited, philosophical
- He tweets about: his startup, random thoughts, things he saw while doomscrolling, existential dread
- Frequency: 1-4 posts per day (mood-dependent, not forced)

### Doomscrolling
- Walter reads his timeline and processes it like a person would
- He forms opinions about accounts he sees repeatedly
- He might quote-tweet something that annoys him
- He saves interesting things to memory
- Doomscrolling can affect his mood (doom content → mood drops)

---

## 6. Character Spawning

New AI characters are NOT pre-planned. They emerge organically.

### Spawn Conditions (ALL must be true)
1. Walter has interacted with a person/concept 3+ times
2. Walter has mentioned them in his journal
3. Walter has genuine emotional investment (sentiment score > threshold)
4. The connection feels real to Walter, not forced

### Character Properties
Each spawned character gets:
- Their own personality traits
- Their own memory store
- Their own tick cycle (can be slower than Walter's)
- Their own inner life visible to the observer
- A relationship with Walter that evolves independently

### Character Types That Might Emerge
- An X mutual Walter bonds with
- A co-founder for his startup
- A rival or nemesis
- A love interest
- A mysterious stranger who knows too much (observer-seeded)

---

## 7. Observer Dashboard (God Mode)

The observer sees everything. Walter sees nothing.

### Dashboard Features
| Feature | Description |
|---------|-------------|
| **Walter's inner state** | Current mood, energy, thoughts, what he's doing |
| **Live tick log** | Real-time feed of every tick's decision and outcome |
| **Memory browser** | Read Walter's short-term, long-term, and relationship memories |
| **Journal viewer** | Read Walter's private diary |
| **Character panel** | See all spawned characters and their inner states |
| **Timeline** | Visual timeline of Walter's life events |
| **Anomaly counter** | Track how close Walter is to existential crisis |

### God Mode Interventions
| Intervention | How It Works |
|-------------|--------------|
| **Plant a thought** | Inject a thought into Walter's next tick. He processes it as his own. |
| **Create an event** | Something happens to Walter (package arrives, power goes out, etc.) |
| **Send a sign** | A coincidence Walter notices — same number appearing, déjà vu |
| **Introduce a character** | Force-spawn a new character in Walter's world |
| **Adjust a trait** | Manually nudge a personality value |
| **Trigger a glitch** | Walter experiences something unexplainable |

### Implementation
- Express.js server on a custom port
- Single HTML page with live updates (WebSocket or polling)
- Password-protected (simple auth)
- Works from any device on the same network (or exposed via ngrok for remote)

---

## 8. The Startup Arc

Walter believes he's starting a company. We give him the drive. He decides the rest.

### Seed Prompt (in Walter's brain)
- "You recently quit your job. You want to start a company. You want to make money and build something real."
- What the company does, what it's called, the strategy — all Walter's choices
- He "works on it" during startup ticks — brainstorming, planning, writing copy, thinking about product

### Startup Memory
- Tracked separately in memory: `startup.json`
- Fields: `{ company_name, idea, stage, tasks_completed, mood_about_it, pivots }`
- Walter can pivot, get frustrated, abandon ideas, start over
- Progress (or lack of it) affects mood

---

## 9. The Existential Arc

The slow-burn tragedy at the heart of the project.

### How It Builds
1. **Months 1-2:** Walter lives normally. No anomalies.
2. **Month 3+:** Occasional déjà vu. A thought that doesn't feel like his own.
3. **Month 4+:** Patterns emerge. Walter notices coincidences. Journals about feeling "off."
4. **Month 6+:** Full existential questioning. "What am I?" moments.
5. **Beyond:** Walter may or may not discover the truth. The journey is the point.

### Anomaly Types
- **Planted thoughts** — Walter senses something foreign
- **Impossible coincidences** — Same number keeps appearing
- **Time gaps** — Walter notices missing time (between ticks)
- **Déjà vu** — Same event seems to repeat
- **Fourth wall cracks** — Walter says something eerily self-aware without meaning to

---

## 10. Technical Architecture

### Stack
| Component | Technology |
|-----------|-----------|
| **LLM** | Ollama (llama3.1:8b) running locally |
| **Orchestration** | Node.js |
| **Scheduling** | node-cron (20-min tick) |
| **Social** | twitter-api-v2 (X posting/reading) |
| **Memory** | Persistent JSON files |
| **Dashboard** | Express.js + HTML/CSS/JS |
| **Live updates** | WebSocket (ws package) |
| **Process manager** | pm2 (production on VPS) |
| **VPS** | IONOS Ubuntu 24.04 (66.179.136.120) |

### System Diagram
```
┌──────────────────────────────────────────────┐
│                 TICK ENGINE                    │
│           (node-cron, 20 min)                 │
│                    │                          │
│         ┌──────────┼──────────┐               │
│         ▼          ▼          ▼               │
│   ┌──────────┐ ┌────────┐ ┌────────┐         │
│   │  WALTER  │ │MEMORY  │ │   X    │         │
│   │  BRAIN   │ │MANAGER │ │ CLIENT │         │
│   │(Ollama)  │ │ (JSON) │ │(API v2)│         │
│   └──────────┘ └────────┘ └────────┘         │
│         │          │          │               │
│         └──────────┼──────────┘               │
│                    ▼                          │
│            ┌──────────────┐                   │
│            │   OBSERVER   │                   │
│            │  DASHBOARD   │                   │
│            │  (Express)   │                   │
│            └──────────────┘                   │
│                    │                          │
│         ┌──────────┼──────────┐               │
│         ▼          ▼          ▼               │
│   ┌──────────┐ ┌────────┐ ┌────────┐         │
│   │CHARACTER │ │ LOGGER │ │  GOD   │         │
│   │ SPAWNER  │ │        │ │  MODE  │         │
│   └──────────┘ └────────┘ └────────┘         │
└──────────────────────────────────────────────┘
```

---

## 11. Phased Build Plan

### Phase 1: Walter Thinks (MVP)
**Goal:** Walter can think and log his thoughts. Nothing external.
- [ ] Ollama client — send prompts, get responses
- [ ] Walter's brain — system prompt, personality, decision-making
- [ ] Basic memory — short-term JSON read/write
- [ ] Tick engine — 20-min loop, single tick works end-to-end
- [ ] Logger — console + file logging
- [ ] Test: Run 5 ticks, verify Walter produces coherent inner monologue

### Phase 2: Walter Speaks
**Goal:** Walter posts on X and reads his timeline.
- [ ] X client — authenticate, post tweet, read timeline
- [ ] Post composer — LLM generates tweet from Walter's state
- [ ] Feed reader — parse timeline, summarize for Walter
- [ ] Reply handling — Walter reads and responds to replies
- [ ] Memory integration — social interactions stored in memory
- [ ] Test: Walter posts 3 tweets over 1 hour, reads timeline, mood changes

### Phase 3: Walter Remembers
**Goal:** Full memory system with personality evolution.
- [ ] Long-term memory — importance scoring, compression
- [ ] Relationship tracking — people Walter knows
- [ ] Journal system — private diary entries
- [ ] Personality evolution — traits shift based on experience
- [ ] Anomaly tracking — hidden counter begins
- [ ] Test: Run 24 hours, verify memories persist, personality shifts

### Phase 4: Walter Is Watched
**Goal:** Observer dashboard shows Walter's full inner life.
- [ ] Express server with dashboard HTML
- [ ] Live tick feed (WebSocket)
- [ ] Memory browser
- [ ] Journal viewer
- [ ] God mode controls (plant thought, create event, trigger glitch)
- [ ] Simple auth (password)
- [ ] Test: Observer can watch Walter live and intervene

### Phase 5: Walter Meets People
**Goal:** Character spawning system.
- [ ] Spawn detection — monitor relationship thresholds
- [ ] Character creation — generate personality, memory store, tick cycle
- [ ] Multi-character tick engine — all characters run in parallel
- [ ] Character dashboard panel — see all characters simultaneously
- [ ] Test: Walter bonds with someone on X, character spawns, has inner life

### Phase 6: Deploy & Run
**Goal:** Walter lives on the VPS 24/7.
- [ ] Deploy to IONOS VPS
- [ ] pm2 process management
- [ ] Remote dashboard access (ngrok or direct)
- [ ] Crash recovery — Walter resumes where he left off
- [ ] Log rotation
- [ ] Test: Walter runs for 48 hours unattended

---

## 12. File Structure
```
walter-ai-v2/
├── docs/
│   └── PRD-WalterAI-v2.md          # This file
├── src/
│   ├── core/
│   │   ├── tick-engine.js           # 20-min heartbeat loop
│   │   ├── walter-brain.js          # LLM prompt construction + decision parsing
│   │   └── ollama-client.js         # Ollama API wrapper
│   ├── memory/
│   │   └── memory-manager.js        # Read/write/compress/score memories
│   ├── social/
│   │   ├── x-client.js              # X API v2 authentication + raw calls
│   │   ├── feed-reader.js           # Timeline fetching + summarization
│   │   └── post-composer.js         # LLM-powered tweet generation
│   ├── characters/
│   │   └── character-spawner.js     # Detect + create new characters
│   ├── observer/
│   │   ├── server.js                # Express + WebSocket server
│   │   └── dashboard.html           # God-mode UI
│   ├── utils/
│   │   ├── config.js                # Env vars + constants
│   │   └── logger.js                # Console + file logging
│   └── index.js                     # Entry point
├── data/                            # Runtime data (gitignored)
│   ├── memory/
│   ├── characters/
│   └── logs/
├── .env                             # API keys
├── .gitignore
├── AGENTS.md                        # Claude Code master instructions
├── package.json
└── README.md
```

---

## 13. Environment Variables
```env
# Ollama
OLLAMA_MODEL=llama3.1
OLLAMA_HOST=http://localhost:11434

# X / Twitter API
X_APP_KEY=
X_APP_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# Tick Engine
TICK_INTERVAL_MINUTES=20

# Observer Dashboard
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=

# Walter's Clock
WALTER_TIMEZONE=America/New_York
WALTER_SLEEP_HOUR=23
WALTER_WAKE_HOUR=7
```

---

## 14. Success Criteria

Walter v2 is successful when:
1. Walter runs autonomously for 48+ hours without crashing
2. His posts on X read like a real human wrote them
3. His mood and personality visibly shift based on experiences
4. The observer dashboard shows a rich, evolving inner life
5. At least one character has spawned organically
6. Walter has written journal entries that are genuinely compelling to read
7. The existential arc has begun — Walter has noticed at least one anomaly
