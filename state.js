// Shared state model for the popup / side panel / pop-out window and the background worker.
// Time is tracked with timestamps (not ticking counters), so the timer keeps running
// correctly even while the popup is closed.

export const DEFAULT_SETTINGS = {
  speakerSeconds: 120,
  meetingMinutes: 15,
  warnSeconds: 20,
  teamSize: 6,
  sound: true,
  notifications: true,
  autoAdvance: false,
};

export const IDLE_MEETING = {
  status: 'idle', // idle | running | paused | done
  order: [], // [{ id, name }] speakers in speaking order
  index: 0,
  spent: {}, // id -> ms banked
  deferred: [], // ids moved to the end of the queue ("later")
  runningSince: null,
  startedAt: null,
  endedAt: null,
  speakerSeconds: DEFAULT_SETTINGS.speakerSeconds,
  meetingSeconds: DEFAULT_SETTINGS.meetingMinutes * 60,
  notes: '',
};

export async function load() {
  const { settings, meeting } = await chrome.storage.local.get(['settings', 'meeting']);
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    meeting: meeting ?? structuredClone(IDLE_MEETING),
  };
}

export function save(partial) {
  return chrome.storage.local.set(partial);
}

/** Load the latest meeting, apply `fn`, and persist the result (if `fn` returns one). */
export async function updateMeeting(fn) {
  const { meeting, settings } = await load();
  const next = fn(structuredClone(meeting), Date.now(), { settings });
  if (next) await save({ meeting: next });
  return next;
}

// ---------- derived values ----------

export function current(m) {
  return m.order[m.index] ?? null;
}

export function speakerElapsed(m, id, now = Date.now()) {
  let ms = m.spent[id] ?? 0;
  if (m.status === 'running' && m.runningSince != null && current(m)?.id === id) {
    ms += now - m.runningSince;
  }
  return ms;
}

export function meetingElapsed(m, now = Date.now()) {
  let ms = Object.values(m.spent).reduce((a, b) => a + b, 0);
  if (m.status === 'running' && m.runningSince != null) ms += now - m.runningSince;
  return ms;
}

/** Projected total duration if everyone left uses exactly their timebox. */
export function projectedTotal(m, now = Date.now()) {
  const speakerMs = m.speakerSeconds * 1000;
  const cur = current(m);
  const curLeft = cur ? Math.max(0, speakerMs - speakerElapsed(m, cur.id, now)) : 0;
  const after = Math.max(0, m.order.length - m.index - 1);
  return meetingElapsed(m, now) + curLeft + after * speakerMs;
}

// ---------- actions (pure-ish: take a cloned meeting, return the new one) ----------

function bank(m, now) {
  if (m.status === 'running' && m.runningSince != null) {
    const cur = current(m);
    if (cur) m.spent[cur.id] = (m.spent[cur.id] ?? 0) + (now - m.runningSince);
  }
  m.runningSince = null;
  return m;
}

function run(m, now) {
  m.status = 'running';
  m.runningSince = now;
  return m;
}

const speaker = (n) => ({ id: `s${n}`, name: `Speaker ${n}` });

export function start(settings, now = Date.now()) {
  const order = Array.from({ length: settings.teamSize }, (_, i) => speaker(i + 1));
  return run(
    {
      ...structuredClone(IDLE_MEETING),
      order,
      startedAt: now,
      speakerSeconds: settings.speakerSeconds,
      meetingSeconds: settings.meetingMinutes * 60,
    },
    now,
  );
}

export function pause(m, now) {
  if (m.status !== 'running') return null;
  bank(m, now);
  m.status = 'paused';
  return m;
}

export function resume(m, now) {
  if (m.status !== 'paused') return null;
  return run(m, now);
}

/** Advance to the next speaker. If `expectIndex` is given, only act when still on that speaker (idempotent). */
export function next(m, now, expectIndex) {
  if (m.status !== 'running' && m.status !== 'paused') return null;
  if (expectIndex != null && m.index !== expectIndex) return null;
  bank(m, now);
  m.index += 1;
  if (m.index >= m.order.length) return finish(m, now);
  return run(m, now);
}

export function prev(m, now) {
  if (m.status !== 'running' && m.status !== 'paused') return null;
  bank(m, now);
  m.index = Math.max(0, m.index - 1);
  return run(m, now);
}

export function jump(m, now, index) {
  if (m.status !== 'running' && m.status !== 'paused') return null;
  if (index < 0 || index >= m.order.length || index === m.index) return null;
  bank(m, now);
  m.index = index;
  return run(m, now);
}

/** Current speaker isn't ready: move them to the end of the queue. */
export function later(m, now) {
  if (m.status !== 'running' && m.status !== 'paused') return null;
  if (m.index >= m.order.length - 1) return null;
  bank(m, now);
  const [p] = m.order.splice(m.index, 1);
  m.order.push(p);
  if (!m.deferred.includes(p.id)) m.deferred.push(p.id);
  return run(m, now);
}

/** Someone joined late: add one more speaker at the end of the queue. */
export function addSpeaker(m) {
  if (m.status !== 'running' && m.status !== 'paused') return null;
  m.order.push(speaker(m.order.length + 1));
  return m;
}

export function finish(m, now) {
  bank(m, now);
  m.status = 'done';
  m.endedAt = now;
  m.index = Math.min(m.index, m.order.length);
  return m;
}

export function reset() {
  return structuredClone(IDLE_MEETING);
}

// ---------- helpers ----------

/** m:ss from milliseconds. `mode` = 'ceil' for countdowns, 'floor' for elapsed. */
export function fmt(ms, mode = 'floor') {
  const total = Math.max(0, mode === 'ceil' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
