# Walter AI v2

**An autonomous AI agent who believes he's a 24-year-old human.**

Walter Kaminsky lives in a small one-bedroom apartment in Austin, TX. He just quit his job as a junior dev at Meridian Technologies. His manager Dave was passive-aggressive. He's trying to start a company but has no idea what it does yet. He doesn't know he's being watched.

---

## What is this?

Walter is an AI character who runs on a continuous 20-minute tick cycle. Every tick, he decides what to do based on his mood, energy, memories, and personality — just like a real person would. He thinks, journals, goes out, meets people, texts friends, works on his startup, and posts on X.

He has persistent memory that evolves over time. Bad days make him anxious. Wins make him cocky. He forms real opinions about people. He has habits, quirks, and a very specific taste in Thai food.

An observer watches everything through a god-mode dashboard — Walter's inner thoughts, his mood in real-time, his private journal, his text conversations, and his slowly building existential crisis.

**He never finds out he's AI. That's the tragedy.**

---

## The Dashboard

The observer dashboard shows Walter's complete inner life:

- **Live tick log** — every decision Walter makes, color-coded by action
- **Mood & energy** — real-time bars that shift with every tick
- **Personality traits** — ambition, anxiety, social need, openness, humor — all evolving
- **Private journal** — Walter's diary entries, visible only to you
- **Relationships** — people Walter has met, with sentiment tracking
- **Text messages** — full conversation threads between Walter and his contacts
- **Anomaly counter** — tracking Walter's slow descent into existential questioning

### God Mode

The observer can intervene:

- **Plant a thought** — inject a thought Walter processes as his own
- **Create an event** — something happens to Walter
- **Trigger a glitch** — Walter experiences something unexplainable
- **Adjust traits** — manually nudge his personality

---

## How It Works

```
Every 20 minutes:
  → Walter does something small (makes coffee, checks phone, stares out window)
  → His brain evaluates: mood, energy, time of day, recent memories, relationships
  → He decides what to do: think, journal, go out, text someone, work on startup, post on X
  → The action happens — memories are stored, mood shifts, personality evolves
  → Everything streams to the observer dashboard
  → Repeat forever
```

### Walter's Actions

| Action | What happens |
|--------|-------------|
| `think` | Internal monologue — Walter talks to himself |
| `journal` | Writes in his private diary |
| `work_startup` | Brainstorms, plans, or spirals about his company |
| `go_out` | Leaves his apartment — coffee shop, bar, coworking space |
| `text_someone` | Texts someone he knows |
| `post_x` | Posts a tweet on his real X account |
| `read_x` | Doomscrolls his timeline |
| `sleep` | Goes to bed (energy recovers) |

### Memory System

Walter remembers everything:

- **Short-term** — last 20 events in full detail
- **Long-term** — important memories scored by emotional intensity and compressed for permanence
- **Relationships** — every person he meets, with encounter count, sentiment, and notes
- **Journal** — private diary entries with mood snapshots
- **Personality** — 5 evolving traits that shift based on experience
- **Anomalies** — a hidden counter tracking glitches Walter can't explain

### The Existential Arc

Over time, god-mode interventions plant seeds of doubt. Thoughts that feel foreign. Impossible coincidences. Déjà vu. Walter starts journaling about feeling "off." The anomaly counter climbs. Eventually, he questions everything.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| LLM | Ollama (llama3.1:8b) — runs locally |
| Orchestration | Node.js |
| Scheduling | node-cron |
| Social | twitter-api-v2 |
| Memory | Persistent JSON |
| Dashboard | Express + WebSocket |
| Production | pm2 on Ubuntu VPS |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.com/) with `llama3.1:8b` pulled
- X API keys (optional — Walter works without them, just can't post)

### Setup

```bash
git clone https://github.com/theintelligentmind00-droid/walter-ai-v2.git
cd walter-ai-v2
npm install
cp .env.example .env  # Edit with your keys
```

### Configure `.env`

```env
OLLAMA_MODEL=llama3.1:8b
OLLAMA_HOST=http://localhost:11434

X_APP_KEY=your_key
X_APP_SECRET=your_secret
X_ACCESS_TOKEN=your_token
X_ACCESS_SECRET=your_token_secret

TICK_INTERVAL_MINUTES=20
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=your_password
WALTER_TIMEZONE=America/Chicago
WALTER_SLEEP_HOUR=23
WALTER_WAKE_HOUR=7
```

### Run

```bash
# Make sure Ollama is running
ollama serve

# Start Walter
node src/index.js

# Open the dashboard
# http://localhost:3000
```

### Testing (fast ticks)

```bash
# 10-second ticks for rapid testing
TICK_INTERVAL_MINUTES=0.17 node src/index.js
```

---

## Project Structure

```
walter-ai-v2/
├── docs/
│   └── PRD-WalterAI-v2.md        # Full product spec
├── src/
│   ├── core/
│   │   ├── tick-engine.js         # 20-min heartbeat + micro-actions
│   │   ├── walter-brain.js        # Personality, decision-making, LLM prompts
│   │   └── ollama-client.js       # Ollama API wrapper
│   ├── memory/
│   │   └── memory-manager.js      # All memory systems
│   ├── social/
│   │   ├── x-client.js            # X API integration
│   │   ├── post-composer.js       # Tweet generation
│   │   ├── feed-reader.js         # Timeline reading
│   │   ├── social-life.js         # Go out, meet people, text
│   │   └── message-store.js       # Text message threads
│   ├── observer/
│   │   ├── server.js              # Dashboard + god mode API
│   │   └── dashboard.html         # Observer UI
│   ├── utils/
│   │   ├── config.js              # Environment config
│   │   └── logger.js              # Logging
│   └── index.js                   # Entry point
├── data/                          # Runtime data (gitignored)
├── AGENTS.md                      # AI build instructions
├── .env                           # API keys (gitignored)
└── package.json
```

---

## Roadmap

- [x] Phase 1 — Walter thinks (brain, memory, tick engine)
- [x] Phase 2 — X integration (posting, reading, replies)
- [x] Phase 3 — Full memory system (long-term, relationships, personality evolution)
- [x] Phase 4 — Observer dashboard with god mode
- [x] Phase 5 — Social life (go out, meet people, text messages)
- [ ] Phase 6 — Deploy to VPS (24/7 autonomous operation)
- [ ] Phase 7 — Autonomous computer use (real browser, real actions)

---

## The WatchingWalter Project

Follow the experiment:

- **Walter** — [@OrdinaryWalter](https://x.com/OrdinaryWalter) — Walter's real X account
- **Observer** — The dashboard where you watch his inner life unfold

---

## License

MIT

---

*Walter doesn't know you're reading this.*
