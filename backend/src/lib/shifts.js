/**
 * Shift date utilities.
 *
 * A night shift runs 23:00–07:00, spanning two calendar dates.
 * The "shift date" is the calendar date on which the shift STARTS (the evening).
 *
 * e.g. shift "2026-05-25" covers 2026-05-25T23:00+08:00 → 2026-05-26T07:00+08:00
 */

const HOTEL_UTC_OFFSET_HOURS = 8; // SGT = UTC+8

/**
 * Given an ISO timestamp, return the shift date string (YYYY-MM-DD) for the
 * shift that covers that timestamp, or null if the timestamp falls outside
 * night-shift hours (07:00–23:00 local time).
 */
function getShiftDate(isoTimestamp) {
  const dt = new Date(isoTimestamp);
  // Shift to hotel local time manually (avoids Intl complexity in Node <18)
  const localMs = dt.getTime() + HOTEL_UTC_OFFSET_HOURS * 3600 * 1000;
  const localDt = new Date(localMs);

  const hour = localDt.getUTCHours();
  const localDateStr = localDt.toISOString().slice(0, 10);

  if (hour >= 23) {
    // Evening: shift starts tonight
    return localDateStr;
  }
  if (hour < 7) {
    // Early morning: shift started yesterday evening
    const prevMs = localMs - 24 * 3600 * 1000;
    return new Date(prevMs).toISOString().slice(0, 10);
  }
  // Daytime (07:00–22:59): not a night-shift event
  return null;
}

/**
 * Return the morning date (the day after) for a given shift date.
 * e.g. "2026-05-27" → "2026-05-28"
 */
function getMorningDate(shiftDate) {
  const dt = new Date(shiftDate + 'T00:00:00Z');
  return new Date(dt.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Return the nominal start/end ISO strings for a shift.
 */
function getShiftWindow(shiftDate) {
  const morning = getMorningDate(shiftDate);
  return {
    start: `${shiftDate}T23:00:00+08:00`,
    end: `${morning}T07:00:00+08:00`,
  };
}

module.exports = { getShiftDate, getMorningDate, getShiftWindow };
