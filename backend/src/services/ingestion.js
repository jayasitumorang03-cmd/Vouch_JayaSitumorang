/**
 * Ingestion service.
 *
 * Normalises events from two formats into a common NormalizedEvent shape:
 *   - Structured JSON events (events.json)
 *   - AI/pre-parsed free-text log items (night-logs-parsed.json)
 *
 * Every NormalizedEvent keeps a reference to its raw source so that
 * every handover statement can be traced back to input data.
 */

const { getShiftDate } = require('../lib/shifts');

// ─── urgency derivation ──────────────────────────────────────────────────────

const HIGH_URGENCY_PATTERNS = [
  /safe/i,
  /passport/i,
  /emergency/i,
  /ambulance/i,
  /fire/i,
  /flight/i,
  /cannot\s+leave/i,
  /won't\s+be\s+able/i,
];

function deriveUrgency(type, status, description) {
  if (status === 'resolved') return 'fyi';
  const desc = description || '';
  if (HIGH_URGENCY_PATTERNS.some((re) => re.test(desc))) return 'high';
  if (['compliance', 'deposit_issue', 'damage_report', 'incident'].includes(type)) return 'medium';
  if (['maintenance', 'facilities', 'check_in_issue', 'no_show'].includes(type)) return 'medium';
  return 'low';
}

// ─── normalise structured event ─────────────────────────────────────────────

/**
 * Normalise a single structured JSON event into the internal format.
 * Returns null for events that cannot be assigned to a night shift.
 */
function normalizeJsonEvent(event) {
  const shiftDate = event.timestamp ? getShiftDate(event.timestamp) : null;
  return {
    id: event.id,
    source: 'structured',
    shiftDate,
    timestamp: event.timestamp || null,
    room: event.room ? String(event.room) : null,
    guest: event.guest || null,
    type: event.type,
    description: event.description || '',
    status: event.status || 'unresolved',
    urgency: deriveUrgency(event.type, event.status, event.description),
    raw: event,
  };
}

// ─── normalise free-text log item ────────────────────────────────────────────

/**
 * Normalise a parsed free-text log item into the internal format.
 */
function normalizeFreeTextItem(item, shiftDate) {
  return {
    id: item.id,
    source: 'free_text',
    shiftDate,
    timestamp: null, // Free-text logs have no machine-precise timestamps
    room: item.room ? String(item.room) : null,
    guest: item.guest || null,
    type: item.type,
    description: item.description || '',
    originalText: item.original_text || null,
    originalLanguage: item.original_language || 'en',
    status: item.status || 'unresolved',
    urgency: item.urgency || deriveUrgency(item.type, item.status, item.description),
    sourceText: item.source_text || null, // The exact log excerpt supporting this item
    raw: item,
  };
}

// ─── main ingestion entry point ──────────────────────────────────────────────

/**
 * Combine structured events and free-text log items into one normalised array.
 *
 * @param {object[]} structuredEvents  - Raw events from events.json
 * @param {object|null} parsedNightLog - Output of parseNightLog() or the pre-parsed JSON
 * @param {string} nightLogShiftDate   - Shift date for the free-text log (e.g. "2026-05-27")
 * @returns {NormalizedEvent[]}
 */
function ingestAll(structuredEvents, parsedNightLog, nightLogShiftDate) {
  const result = [];

  for (const event of structuredEvents || []) {
    const ne = normalizeJsonEvent(event);
    // Keep events even if outside night hours (shiftDate=null) for completeness;
    // reconciliation will handle filtering.
    result.push(ne);
  }

  if (parsedNightLog && Array.isArray(parsedNightLog.items)) {
    for (const item of parsedNightLog.items) {
      result.push(normalizeFreeTextItem(item, nightLogShiftDate));
    }
  }

  return result;
}

module.exports = { ingestAll, normalizeJsonEvent, normalizeFreeTextItem };
