/**
 * Reconciliation service.
 *
 * Groups normalised events into "issue threads" across multiple nights, then
 * classifies each thread relative to a target shift date:
 *
 *   still_open      — unresolved before target shift, still unresolved after it
 *   newly_resolved  — was unresolved before, resolved/closed during target shift
 *   new_tonight     — first appeared during the target shift, still open
 *   fyi             — new tonight AND already resolved, OR resolved long ago
 *
 * Thread identity rule: all events for the same room belong to the same thread.
 * Events with no room use type-based keys (see getThreadKey).
 * This is intentionally simple — it keeps all room history together so the AI
 * can describe complex multi-event situations (e.g. room 312 no-show → dispute).
 */

// ─── thread key ──────────────────────────────────────────────────────────────

/**
 * Assign a stable thread key so related events across nights are grouped.
 */
function getThreadKey(event) {
  // Room-based grouping: all activity in a room forms one thread
  if (event.room) return `room:${event.room}`;

  // Corridor / area facilities events (no room number, but location in description)
  if (event.type === 'facilities') {
    const m = (event.description || '').match(/near\s+(?:room\s+)?(\d+)/i);
    if (m) return `facilities:near-${m[1]}`;
    const f = (event.description || '').match(/(\d+)(?:st|nd|rd|th)?\s+floor/i);
    if (f) return `facilities:floor-${f[1]}`;
  }

  // Hotel-wide compliance / scanner issues
  if (event.type === 'compliance') return 'compliance:immigration-scanner';

  // One-off events (walk-in turned away, etc.) — each gets its own thread
  return `unique:${event.id}`;
}

// ─── build threads ───────────────────────────────────────────────────────────

/**
 * Group all normalised events into a Map<threadKey, NormalizedEvent[]>,
 * sorted chronologically within each thread (null timestamps sort first).
 */
function buildThreads(events) {
  const threads = new Map();
  for (const event of events) {
    const key = getThreadKey(event);
    if (!threads.has(key)) threads.set(key, []);
    threads.get(key).push(event);
  }
  for (const [, threadEvents] of threads) {
    threadEvents.sort((a, b) => {
      if (!a.timestamp) return -1;
      if (!b.timestamp) return 1;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  }
  return threads;
}

// ─── reconcile ───────────────────────────────────────────────────────────────

/**
 * Given all normalised events and a target shift date, return categorised
 * thread data for the handover.
 */
function reconcileForShift(events, targetShiftDate) {
  // Exclude events that fall outside any night shift (daytime notes etc.)
  // except free_text items which always carry a shiftDate.
  const nightEvents = events.filter(
    (e) => e.shiftDate !== null && e.shiftDate !== undefined
  );

  const threads = buildThreads(nightEvents);

  const result = {
    shiftDate: targetShiftDate,
    still_open: [],
    newly_resolved: [],
    new_tonight: [],
    fyi: [],
  };

  for (const [threadKey, threadEvents] of threads) {
    const before = threadEvents.filter((e) => e.shiftDate < targetShiftDate);
    const tonight = threadEvents.filter((e) => e.shiftDate === targetShiftDate);

    // Skip threads with no relevance to the target shift or earlier
    if (tonight.length === 0 && before.length === 0) continue;

    const statusBefore = before.length ? getLatestStatus(before) : null;
    const statusTonight = tonight.length ? getLatestStatus(tonight) : null;
    const currentStatus = statusTonight || statusBefore;

    const threadData = {
      thread_key: threadKey,
      all_event_ids: threadEvents.map((e) => e.id),
      current_status: currentStatus,
      events_tonight: tonight,
      events_prior: before,
      // Convenience: the most informative recent event for this thread
      latest_event: tonight.length ? tonight[tonight.length - 1] : before[before.length - 1],
    };

    if (tonight.length === 0) {
      // Nothing happened tonight — surface if still unresolved
      if (statusBefore === 'unresolved' || statusBefore === 'pending') {
        result.still_open.push(threadData);
      }
      continue;
    }

    const wasOpen = statusBefore === 'unresolved' || statusBefore === 'pending';
    const isOpen = currentStatus === 'unresolved' || currentStatus === 'pending';
    const isResolved = currentStatus === 'resolved';

    if (before.length === 0) {
      // Brand-new thread tonight
      isResolved ? result.fyi.push(threadData) : result.new_tonight.push(threadData);
    } else if (wasOpen && isResolved) {
      result.newly_resolved.push(threadData);
    } else if (isOpen) {
      // Carried over and still open (possibly updated tonight)
      result.still_open.push(threadData);
    } else {
      result.fyi.push(threadData);
    }
  }

  return result;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getLatestStatus(events) {
  return events[events.length - 1]?.status ?? null;
}

module.exports = { reconcileForShift, buildThreads, getThreadKey };
