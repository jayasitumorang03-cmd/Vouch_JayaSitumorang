/**
 * Handover routes.
 *
 * GET  /api/handover/shifts            — list available shifts in the sample data
 * GET  /api/handover/demo/:shiftDate   — generate handover from bundled sample data
 * POST /api/handover                   — generate handover from caller-supplied data
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const logger = require('../lib/logger');
const { getShiftDate } = require('../lib/shifts');
const { ingestAll } = require('../services/ingestion');
const { reconcileForShift } = require('../services/reconciliation');
const { generateHandoverDocument } = require('../services/generator');
const { parseNightLog } = require('../services/ai');

// ─── sample data (loaded once) ───────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');

function loadJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8'));
}

let _eventsData = null;
let _parsedNightLog = null;
const NIGHT_LOG_SHIFT_DATE = '2026-05-27';

function getEventsData() {
  if (!_eventsData) _eventsData = loadJSON('events.json');
  return _eventsData;
}

function getParsedNightLog() {
  if (_parsedNightLog === null) {
    const p = path.join(DATA_DIR, 'night-logs-parsed.json');
    _parsedNightLog = fs.existsSync(p) ? loadJSON('night-logs-parsed.json') : undefined;
  }
  return _parsedNightLog;
}

// ─── GET /shifts ─────────────────────────────────────────────────────────────

router.get('/shifts', (req, res) => {
  try {
    const data = getEventsData();
    const shifts = new Set();
    for (const evt of data.events) {
      const sd = getShiftDate(evt.timestamp);
      if (sd) shifts.add(sd);
    }
    shifts.add(NIGHT_LOG_SHIFT_DATE);

    res.json({
      hotel: data.hotel,
      available_shifts: [...shifts].sort(),
      night_log_shift: NIGHT_LOG_SHIFT_DATE,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list shifts');
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /demo/:shiftDate ────────────────────────────────────────────────────

router.get('/demo/:shiftDate', async (req, res) => {
  const { shiftDate } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) {
    return res.status(400).json({ error: 'Invalid date format — use YYYY-MM-DD' });
  }

  const log = logger.child({ hotel: 'lumen-sg', shiftDate, endpoint: 'demo' });
  log.info('Demo handover requested');

  try {
    const data = getEventsData();
    const nightLog = getParsedNightLog();

    const events = ingestAll(data.events, nightLog, NIGHT_LOG_SHIFT_DATE);
    const reconciled = reconcileForShift(events, shiftDate);
    const doc = await generateHandoverDocument(reconciled, data.hotel, shiftDate);

    log.info(
      { urgent: doc.handover.urgent_actions?.length, pending: doc.handover.pending_actions?.length },
      'Demo handover complete'
    );
    res.json(doc);
  } catch (err) {
    logger.error({ err, shiftDate }, 'Demo handover failed');
    res.status(500).json({ error: 'Failed to generate handover', details: err.message });
  }
});

// ─── POST / ──────────────────────────────────────────────────────────────────

/**
 * Body shape:
 * {
 *   hotel: { id, name, timezone? },
 *   events: [...],          // structured events array
 *   nightLog?: "...",        // raw free-text log string (optional)
 *   nightLogShiftDate?: "YYYY-MM-DD",
 *   shiftDate: "YYYY-MM-DD" // target shift to generate handover FOR
 * }
 */
router.post('/', async (req, res) => {
  const { hotel, events, nightLog, nightLogShiftDate, shiftDate } = req.body;

  if (!shiftDate || !events) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['shiftDate', 'events'],
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) {
    return res.status(400).json({ error: 'Invalid shiftDate format — use YYYY-MM-DD' });
  }

  const hotelInfo = hotel || { id: 'unknown', name: 'Hotel' };
  const log = logger.child({ hotel: hotelInfo.id, shiftDate, endpoint: 'post' });
  log.info({ eventCount: events.length, hasNightLog: !!nightLog }, 'Custom handover requested');

  try {
    let parsedLog = null;
    if (nightLog && nightLogShiftDate) {
      parsedLog = await parseNightLog(nightLog, hotelInfo.name, nightLogShiftDate);
    }

    const normalised = ingestAll(events, parsedLog, nightLogShiftDate);
    const reconciled = reconcileForShift(normalised, shiftDate);
    const doc = await generateHandoverDocument(reconciled, hotelInfo, shiftDate);

    log.info('Custom handover complete');
    res.json(doc);
  } catch (err) {
    logger.error({ err, shiftDate }, 'Custom handover failed');
    res.status(500).json({ error: 'Failed to generate handover', details: err.message });
  }
});

module.exports = router;
