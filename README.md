# Vouch Night-Handover Service

Generates action-first morning handover briefs for hotel front-desk managers.  
Ingests structured JSON events + free-text logs (including non-English entries), reconciles issues across nights, and produces a grounded summary with full source citations.

See [`BRIEF.md`](BRIEF.md) for the task description and [`DECISIONS.md`](DECISIONS.md) for design rationale.

---

## Quick start

### 1 — Backend

```bash
cd backend
cp .env.example .env          # optionally add GEMINI_API_KEY for AI mode
npm install
npm start                     # runs on http://localhost:3001
```

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev                   # runs on http://localhost:3000
```

Open **http://localhost:3000**, select a shift night, and click **Generate handover**.

---

## API

### Health check
```bash
curl http://localhost:3001/api/health
```

### List available demo shifts
```bash
curl http://localhost:3001/api/handover/shifts
```

### Generate demo handover (sample data, no API key needed)
```bash
# Morning of 2026-05-30 — the most event-rich handover
curl http://localhost:3001/api/handover/demo/2026-05-29

# Morning of 2026-05-28 — covers the free-text night log
curl http://localhost:3001/api/handover/demo/2026-05-27
```

### Generate handover from custom data
```bash
curl -X POST http://localhost:3001/api/handover \
  -H "Content-Type: application/json" \
  -d '{
    "hotel": { "id": "my-hotel", "name": "My Hotel" },
    "shiftDate": "2026-05-29",
    "events": [
      {
        "id": "evt_001",
        "timestamp": "2026-05-30T01:00:00+08:00",
        "type": "maintenance",
        "room": "301",
        "guest": "Jane Doe",
        "description": "Air-con not working. Guest moved to 305.",
        "status": "unresolved"
      }
    ],
    "nightLog": "Quiet night overall. One late check-in for room 210.",
    "nightLogShiftDate": "2026-05-29"
  }'
```

---

## AI mode

The service runs **without any API key** using rule-based generation and the pre-parsed night log.

To enable AI-powered natural language generation (recommended for custom inputs and multi-language logs):

1. Get a free Gemini API key at https://aistudio.google.com/app/apikey
2. Set `GEMINI_API_KEY=your_key` in `backend/.env`

---

## Key design choices

- **Grounding:** every handover item includes `sources: [{id, excerpt}]` tracing back to input events. A post-generation validator flags any hallucinated source IDs.
- **Prompt-injection defence:** `evt_0026` contains a guest note that attempts to hijack the handover. The system detects and flags it as a `security_alert` without following the embedded instruction.
- **Free-text log:** `data/night-logs-parsed.json` is a committed pre-parse of `night-logs.md` (including translations of the two Chinese entries). No API key is needed to run the demo.
- **Reconciliation:** events are grouped by room number into issue threads, then classified per shift as `still_open / newly_resolved / new_tonight / fyi`.

See [`DECISIONS.md`](DECISIONS.md) and [`AGENTS.md`](AGENTS.md) for full detail.

---

## Project structure

```
backend/          Node.js + Express service
  src/
    lib/          logger.js, shifts.js
    services/     ai.js, ingestion.js, reconciliation.js, generator.js
    routes/       handover.js
frontend/         Next.js app (Tailwind CSS)
  app/            page.js, layout.js
  components/     HandoverView.jsx
data/
  events.json             Structured events (Mon–Sat)
  night-logs.md           Free-text log (Wed night, partly in Chinese)
  night-logs-parsed.json  Pre-parsed version (committed)
AGENTS.md         Rules for AI agents working on this codebase
DECISIONS.md      Design rationale
BRIEF.md          Original task description
```
