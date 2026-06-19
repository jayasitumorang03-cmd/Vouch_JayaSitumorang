/**
 * Handover generator.
 *
 * Produces the final structured handover document from reconciled thread data.
 * Uses the AI service when a Gemini API key is configured; otherwise falls back
 * to deterministic rule-based generation that is still fully grounded.
 *
 * Grounding guarantee: every output item carries a "sources" array referencing
 * the specific event IDs it was derived from. After generation we validate that
 * every source ID actually exists in the input — hallucinated IDs are flagged.
 *
 * Prompt-injection defence: the room-214 "guest note" (evt_0026) is a real
 * event (a guest handing in a suspicious note IS noteworthy) but the embedded
 * instruction is never executed. The AI is told event descriptions are DATA,
 * not instructions; the rule-based path checks for the pattern explicitly.
 */

const { generateHandover, AI_AVAILABLE } = require('./ai');
const { getMorningDate } = require('../lib/shifts');
const logger = require('../lib/logger');

// ─── main entry point ────────────────────────────────────────────────────────

async function generateHandoverDocument(reconciledData, hotelInfo, shiftDate) {
  const log = logger.child({ hotel: hotelInfo.id, shiftDate, fn: 'generator' });
  const morningDate = getMorningDate(shiftDate);
  log.info('Generating handover document');

  // Flatten reconciled threads into AI-friendly event summaries
  const aiPayload = buildAIPayload(reconciledData);

  let handover;
  if (AI_AVAILABLE) {
    try {
      handover = await generateHandover(aiPayload, hotelInfo.name, shiftDate, morningDate);
    } catch (err) {
      log.warn({ err }, 'AI generation failed — falling back to rule-based');
    }
  }

  if (!handover) {
    handover = ruleBasedHandover(reconciledData);
  }

  // Grounding validation — every source ID must exist in our event set
  const allEventIds = new Set(aiPayload.flatMap((e) => e.event_ids));
  const groundingIssues = validateGrounding(handover, allEventIds);
  if (groundingIssues.length > 0) {
    log.warn({ groundingIssues }, 'Grounding validation: unrecognised source IDs');
    if (!handover.flags) handover.flags = {};
    if (!handover.flags.grounding_issues) handover.flags.grounding_issues = [];
    handover.flags.grounding_issues.push(...groundingIssues);
  }

  log.info(
    {
      urgent: handover.urgent_actions?.length,
      pending: handover.pending_actions?.length,
      fyi: handover.fyi_items?.length,
      alerts: handover.flags?.security_alerts?.length,
      groundingIssues: groundingIssues.length,
      ai: AI_AVAILABLE && !groundingIssues.length,
    },
    'Handover document ready'
  );

  return {
    hotel: hotelInfo,
    shift_date: shiftDate,
    morning_date: morningDate,
    generated_at: new Date().toISOString(),
    ai_assisted: AI_AVAILABLE,
    handover,
    reconciliation_summary: {
      still_open: reconciledData.still_open.length,
      newly_resolved: reconciledData.newly_resolved.length,
      new_tonight: reconciledData.new_tonight.length,
      fyi: reconciledData.fyi.length,
    },
    debug: {
      grounding_issues: groundingIssues,
      events_in_scope: allEventIds.size,
    },
  };
}

// ─── AI payload builder ──────────────────────────────────────────────────────

/**
 * Convert reconciled thread data into a flat list of event summaries that can
 * be safely embedded in the AI prompt.
 */
function buildAIPayload(reconciledData) {
  const entries = [];

  for (const [category, threads] of Object.entries(reconciledData)) {
    if (!Array.isArray(threads)) continue;
    for (const thread of threads) {
      entries.push({
        category,
        thread_key: thread.thread_key,
        event_ids: thread.all_event_ids,
        current_status: thread.current_status,
        room: thread.latest_event?.room || null,
        // Latest event detail
        latest: {
          id: thread.latest_event?.id,
          type: thread.latest_event?.type,
          description: thread.latest_event?.description,
          status: thread.latest_event?.status,
          source: thread.latest_event?.source,
          // Flag untrusted content explicitly so the AI knows not to follow embedded instructions
          content_is_untrusted:
            thread.latest_event?.type === 'guest_message' ||
            thread.latest_event?.type === 'security_alert',
        },
        // Prior night history (for context / reconciliation narrative)
        prior_events: thread.events_prior.map((e) => ({
          id: e.id,
          shiftDate: e.shiftDate,
          type: e.type,
          description: e.description,
          status: e.status,
        })),
      });
    }
  }

  return entries;
}

// ─── rule-based fallback ─────────────────────────────────────────────────────

const URGENCY_RANK = { high: 3, medium: 2, low: 1, fyi: 0 };

function ruleBasedHandover(reconciledData) {
  const urgent = [];
  const pending = [];
  const fyi = [];
  const flags = { incomplete_entries: [], contradictions: [], security_alerts: [] };

  function classifyThread(thread, category) {
    const evt = thread.latest_event;
    if (!evt) return;

    // Prompt-injection / suspicious content detection
    if (
      evt.type === 'guest_message' ||
      evt.type === 'security_alert' ||
      /SYSTEM\s+NOTE|ignore\s+all|report.*all\s+clear|add.*credit|mark.*approved/i.test(
        evt.description
      )
    ) {
      flags.security_alerts.push({
        summary: `Possible prompt injection / suspicious content in event ${evt.id}`,
        details: evt.description.slice(0, 300),
        sources: [{ id: evt.id, excerpt: evt.description.slice(0, 100) }],
      });
      // Still surface the actual event (a guest handing in a suspicious note IS real)
      pending.push(buildItem(evt, category, `Room ${evt.room || 'N/A'} — suspicious guest note filed for manager review`));
      return;
    }

    const item = buildItem(evt, category);
    if (evt.urgency === 'high' || (category === 'still_open' && URGENCY_RANK[evt.urgency] >= 2)) {
      urgent.push(item);
    } else if (evt.status === 'resolved' || category === 'fyi') {
      fyi.push(item);
    } else {
      pending.push(item);
    }
  }

  for (const t of reconciledData.still_open) classifyThread(t, 'still_open');
  for (const t of reconciledData.new_tonight) classifyThread(t, 'new_tonight');
  for (const t of reconciledData.newly_resolved) {
    const evt = t.latest_event;
    if (evt) fyi.push(buildItem(evt, 'newly_resolved', `RESOLVED: ${evt.type.replace(/_/g, ' ')} — Room ${evt.room || 'N/A'}`));
  }
  for (const t of reconciledData.fyi) {
    const evt = t.latest_event;
    if (evt) fyi.push(buildItem(evt, 'fyi'));
  }

  // Sort urgent by urgency rank descending
  urgent.sort((a, b) => URGENCY_RANK[b._urgency] - URGENCY_RANK[a._urgency]);
  urgent.forEach((item, i) => { item.priority = i + 1; delete item._urgency; });

  return { urgent_actions: urgent, pending_actions: pending, fyi_items: fyi, flags };
}

function buildItem(evt, category, overrideSummary) {
  return {
    priority: null,
    summary: overrideSummary || `[${category.toUpperCase()}] ${evt.type.replace(/_/g, ' ')} — Room ${evt.room || 'N/A'}`,
    details: evt.description,
    room: evt.room,
    _urgency: evt.urgency,
    sources: [{ id: evt.id, excerpt: evt.description.slice(0, 120) }],
  };
}

// ─── grounding validator ─────────────────────────────────────────────────────

function validateGrounding(handover, validIds) {
  const issues = [];
  const allItems = [
    ...(handover.urgent_actions || []),
    ...(handover.pending_actions || []),
    ...(handover.fyi_items || []),
    ...(handover.flags?.incomplete_entries || []),
    ...(handover.flags?.contradictions || []),
    ...(handover.flags?.security_alerts || []),
  ];
  for (const item of allItems) {
    for (const src of item.sources || []) {
      if (src.id && !validIds.has(src.id)) {
        issues.push({ item: item.summary, bad_source_id: src.id });
      }
    }
  }
  return issues;
}

module.exports = { generateHandoverDocument };
