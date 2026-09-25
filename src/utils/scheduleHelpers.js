// src/utils/scheduleHelpers.js
// Utilities for teacher schedule time slot parsing, consecutive session merging (2-hour blocks),
// and timetable synchronization with the logbook.

export const ORDERED_TIME_SLOTS = [
  '08-09', '09-10', '10-11', '11-12',
  '14-15', '15-16', '16-17', '17-18'
];

/**
 * Parses time string into numeric start and end hours.
 * Handles "08:00 - 10:00", "10 - 12", "10h - 12h", "10:00-11:00", etc.
 * @param {string} timeStr 
 * @returns {{ start: number, end: number } | null}
 */
export const parseTimeRange = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split('-').map(p => {
    const m = p.match(/(\d+)(?::(\d+))?/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) / 60 : 0;
    return h + min;
  }).filter(x => x !== null);

  if (parts.length >= 2) {
    return { start: parts[0], end: parts[1] };
  }
  const digits = timeStr.match(/\d+/g)?.map(Number) || [];
  if (digits.length >= 2) {
    return { start: digits[0], end: digits[1] };
  }
  return null;
};

/**
 * Checks if two time intervals overlap.
 */
export const checkTimeOverlap = (t1, t2) => {
  const r1 = parseTimeRange(t1);
  const r2 = parseTimeRange(t2);
  if (!r1 || !r2) return false;
  return Math.max(r1.start, r2.start) < Math.min(r1.end, r2.end);
};

/**
 * Checks if two time strings are consecutive (end of t1 equals start of t2).
 */
export const areConsecutiveTimes = (t1, t2) => {
  const r1 = parseTimeRange(t1);
  const r2 = parseTimeRange(t2);
  if (!r1 || !r2) return false;
  return Math.abs(r1.end - r2.start) < 0.05;
};

/**
 * Scans a day's schedule from teacher timetable and automatically merges
 * consecutive 1-hour slots belonging to the same class into a single 2-hour session.
 * 
 * Example:
 *   Monday 10:00-11:00 (2BACSPF) + 11:00-12:00 (2BACSPF)
 *   -> Merges into 1 session: "10:00 - 12:00" for 2BACSPF (isDoubleHour: true).
 * 
 * @param {string} dayName e.g. "Lundi", "Mardi", ...
 * @param {Object} schedule Map of `${dayName}-${slotId}` -> { classId, room }
 * @param {Array} classes List of class objects
 * @returns {Array} List of merged session objects
 */
export const getMergedDaySessions = (dayName, schedule = {}, classes = []) => {
  const sessions = [];
  let i = 0;

  while (i < ORDERED_TIME_SLOTS.length) {
    const slotId = ORDERED_TIME_SLOTS[i];
    const slotKey = `${dayName}-${slotId}`;
    const slotData = schedule[slotKey];

    if (!slotData || !slotData.classId) {
      i++;
      continue;
    }

    const classIdOrName = slotData.classId;
    const matchingClass = classes.find(c => c.name === classIdOrName || c.id === classIdOrName) || {
      id: classIdOrName,
      name: classIdOrName
    };

    // Check if the next slot in schedule is consecutive and has the EXACT same class
    const nextSlotId = ORDERED_TIME_SLOTS[i + 1];
    let isMergedWithNext = false;

    if (nextSlotId) {
      const currentEnd = slotId.split('-')[1];
      const nextStart = nextSlotId.split('-')[0];
      // Consecutive check: end of current equals start of next (e.g. "11" === "11")
      if (currentEnd === nextStart) {
        const nextKey = `${dayName}-${nextSlotId}`;
        const nextData = schedule[nextKey];
        if (nextData && nextData.classId === classIdOrName) {
          isMergedWithNext = true;
        }
      }
    }

    if (isMergedWithNext) {
      const startHour = slotId.split('-')[0];
      const endHour = nextSlotId.split('-')[1];
      const mergedSlot = `${startHour}-${endHour}`;
      const displayTime = `${startHour}:00 - ${endHour}:00`;
      const room = slotData.room || schedule[`${dayName}-${nextSlotId}`]?.room || '—';

      sessions.push({
        id: `${dayName}-${mergedSlot}`,
        dayName,
        slotKey: `${dayName}-${mergedSlot}`,
        rawSlots: [slotId, nextSlotId],
        slotTime: mergedSlot,
        displayTime,
        time: displayTime,
        class: matchingClass,
        className: matchingClass.name,
        room,
        isDoubleHour: true
      });

      i += 2; // Advance past both merged hours
    } else {
      const [startHour, endHour] = slotId.split('-');
      const displayTime = `${startHour}:00 - ${endHour}:00`;
      const room = slotData.room || '—';

      sessions.push({
        id: `${dayName}-${slotId}`,
        dayName,
        slotKey,
        rawSlots: [slotId],
        slotTime: slotId,
        displayTime,
        time: displayTime,
        class: matchingClass,
        className: matchingClass.name,
        room,
        isDoubleHour: false
      });

      i++;
    }
  }

  return sessions;
};

/**
 * Merges two logbook entry objects from consecutive hours into a single 2-hour entry.
 */
export const mergeTwoEntries = (e1, e2) => {
  const r1 = parseTimeRange(e1.time) || { start: 8, end: 9 };
  const r2 = parseTimeRange(e2.time) || { start: 9, end: 10 };
  const startStr = String(Math.floor(r1.start)).padStart(2, '0');
  const endStr = String(Math.floor(r2.end)).padStart(2, '0');
  const mergedTime = `${startStr}:00 - ${endStr}:00`;

  let mergedContent = '';
  const c1 = (e1.customContent || '').trim();
  const c2 = (e2.customContent || '').trim();

  if (c1 === c2) {
    mergedContent = c1;
  } else if (!c1) {
    mergedContent = c2;
  } else if (!c2) {
    mergedContent = c1;
  } else {
    // If c2 repeats the exact chapter header of c1, strip duplicate header
    let cleanC2 = c2;
    const c1FirstLine = c1.split('\n')[0].trim();
    if (c1FirstLine.startsWith('===') && cleanC2.startsWith(c1FirstLine)) {
      cleanC2 = cleanC2.slice(c1FirstLine.length).trim();
    }
    mergedContent = `${c1}\n${cleanC2}`.trim();
  }

  // Component combination
  let mergedComp = e1.component || 'Cours';
  if (e2.component && e2.component !== e1.component) {
    const comps = Array.from(new Set([
      ...(e1.component || '').split(/\s*\+\s*/),
      ...(e2.component || '').split(/\s*\+\s*/)
    ])).filter(Boolean);
    mergedComp = comps.join(' + ');
  }

  return {
    ...e1,
    time: mergedTime,
    component: mergedComp,
    customContent: mergedContent,
    selectedSections: Array.from(new Set([
      ...(e1.selectedSections || []),
      ...(e2.selectedSections || [])
    ])),
    isMergedDoubleSession: true,
    originalEntryIds: [e1.id, e2.id]
  };
};

/**
 * Takes a list of logbook entries and automatically collapses any two consecutive
 * same-day entries for the same class into a single 2-hour session row.
 * 
 * @param {Array} entries List of logbook entry objects
 * @returns {Array} List of merged logbook entry objects
 */
export const mergeConsecutiveEntries = (entries = []) => {
  if (!entries || entries.length <= 1) return entries;

  // Group by date
  const byDate = {};
  entries.forEach(e => {
    if (!e || !e.date) return;
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  const result = [];

  for (const date of Object.keys(byDate)) {
    const dayEntries = byDate[date];

    // Sort dayEntries chronologically by start time
    dayEntries.sort((a, b) => {
      const rA = parseTimeRange(a.time);
      const rB = parseTimeRange(b.time);
      if (rA && rB) return rA.start - rB.start;
      return (a.time || '').localeCompare(b.time || '');
    });

    let i = 0;
    while (i < dayEntries.length) {
      const cur = dayEntries[i];
      if (i + 1 < dayEntries.length) {
        const next = dayEntries[i + 1];
        // Must belong to the same class and have consecutive times
        const sameClass = cur.classId === next.classId;
        if (sameClass && areConsecutiveTimes(cur.time, next.time)) {
          const merged = mergeTwoEntries(cur, next);
          result.push(merged);
          i += 2;
          continue;
        }
      }
      result.push(cur);
      i++;
    }
  }

  return result;
};
