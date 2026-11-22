import * as S from './state.js';

const $ = (id) => document.getElementById(id);
const RING_C = 2 * Math.PI * 52;

let state = await S.load();
let windowId = null;

// ---------- context (popup / side panel / pop-out window) ----------
const isWindow = new URLSearchParams(location.search).get('mode') === 'window';
const isPopup = chrome.extension?.getViews?.({ type: 'popup' }).includes(window) ?? false;
document.body.classList.toggle('is-popup', isPopup);
$('btn-popout').hidden = isWindow;
$('btn-sidepanel').hidden = !isPopup || !chrome.sidePanel;
chrome.windows?.getCurrent().then((w) => (windowId = w.id));

$('btn-popout').addEventListener('click', async () => {
  await chrome.windows.create({ url: chrome.runtime.getURL('timer.html?mode=window'), type: 'popup', width: 400, height: 720 });
  if (isPopup) window.close();
});
$('btn-sidepanel').addEventListener('click', () => {
  // Must be called synchronously from the click to keep the user gesture.
  chrome.sidePanel.open({ windowId }).then(() => window.close());
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) state.settings = { ...S.DEFAULT_SETTINGS, ...changes.settings.newValue };
  if (changes.meeting) state.meeting = changes.meeting.newValue ?? S.reset();
  render();
});

const act = (fn, ...args) => S.updateMeeting((m, now) => fn(m, now, ...args));

// ================= SETUP =================
const clampTeam = (n) => Math.min(50, Math.max(1, Math.round(Number(n) || 1)));
const settingInputs = {
  'set-team': ['teamSize', (el) => clampTeam(el.value), (v) => v],
  'set-speaker': ['speakerSeconds', (el) => Math.max(15, Math.round(Number(el.value) * 60)), (v) => v / 60],
  'set-meeting': ['meetingMinutes', (el) => Math.max(1, Math.round(Number(el.value))), (v) => v],
  'set-warn': ['warnSeconds', (el) => Math.max(0, Math.round(Number(el.value))), (v) => v],
  'set-sound': ['sound', (el) => el.checked],
  'set-notify': ['notifications', (el) => el.checked],
  'set-auto': ['autoAdvance', (el) => el.checked],
};
const saveSetting = (key, value) => S.save({ settings: { ...state.settings, [key]: value } });
for (const [id, [key, read]] of Object.entries(settingInputs)) {
  $(id).addEventListener('change', (e) => saveSetting(key, read(e.target)));
}
$('team-minus').addEventListener('click', () => saveSetting('teamSize', clampTeam(state.settings.teamSize - 1)));
$('team-plus').addEventListener('click', () => saveSetting('teamSize', clampTeam(state.settings.teamSize + 1)));

$('btn-start').addEventListener('click', async () => {
  unlockAudio();
  await S.save({ meeting: S.start(state.settings) });
});

function renderSetup() {
  const { settings } = state;
  for (const [id, [key, , toInput]] of Object.entries(settingInputs)) {
    const input = $(id);
    if (document.activeElement === input) continue;
    if (input.type === 'checkbox') input.checked = settings[key];
    else input.value = toInput(settings[key]);
  }
  $('team-minus').disabled = settings.teamSize <= 1;
  $('team-plus').disabled = settings.teamSize >= 50;

  const planned = settings.teamSize * settings.speakerSeconds;
  const fits = planned <= settings.meetingMinutes * 60;
  $('setup-summary').textContent = `${settings.teamSize} × ${S.fmt(settings.speakerSeconds * 1000)} = ${S.fmt(planned * 1000)} of ${settings.meetingMinutes}:00`;
  $('setup-summary').style.color = fits ? '' : 'var(--over)';
}

// ================= MEETING =================
$('btn-pause').addEventListener('click', togglePause);
$('btn-next').addEventListener('click', () => act(S.next));
$('btn-prev').addEventListener('click', () => act(S.prev));
$('btn-later').addEventListener('click', () => act(S.later));
$('btn-end').addEventListener('click', () => act(S.finish));
$('btn-add-speaker').addEventListener('click', () => act(S.addSpeaker));
$('queue').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-index]');
  if (li) act(S.jump, Number(li.dataset.index));
});

function togglePause() {
  unlockAudio();
  act(state.meeting.status === 'paused' ? S.resume : S.pause);
}

let notesTimer;
$('notes').addEventListener('input', (e) => {
  clearTimeout(notesTimer);
  const value = e.target.value;
  notesTimer = setTimeout(() => S.updateMeeting((m) => ({ ...m, notes: value })), 400);
});

document.addEventListener('keydown', (e) => {
  if (!['running', 'paused'].includes(state.meeting.status)) return;
  if (e.target.matches('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { ' ': togglePause, ArrowRight: () => act(S.next), n: () => act(S.next), ArrowLeft: () => act(S.prev), p: () => act(S.prev), l: () => act(S.later) };
  const fn = map[e.key];
  if (fn) { e.preventDefault(); fn(); }
});

function renderMeetingStatic() {
  const m = state.meeting;
  $('btn-pause').textContent = m.status === 'paused' ? 'Resume' : 'Pause';
  $('btn-prev').disabled = m.index === 0;
  $('btn-later').disabled = m.index >= m.order.length - 1;
  $('btn-next').textContent = m.index >= m.order.length - 1 ? 'Finish' : 'Next';
  $('meeting-box').textContent = S.fmt(m.meetingSeconds * 1000);
  if (document.activeElement !== $('notes')) $('notes').value = m.notes ?? '';
}

function tick() {
  const m = state.meeting;
  if (m.status !== 'running' && m.status !== 'paused') return;
  const now = Date.now();
  const cur = S.current(m);
  const speakerMs = m.speakerSeconds * 1000;
  const meetingMs = m.meetingSeconds * 1000;
  const elapsed = cur ? S.speakerElapsed(m, cur.id, now) : 0;
  const left = speakerMs - elapsed;
  const warnMs = state.settings.warnSeconds * 1000;

  // Ring + speaker
  const ring = $('ring-wrap');
  ring.classList.toggle('paused', m.status === 'paused');
  ring.classList.toggle('over', left <= 0);
  ring.classList.toggle('warn', left > 0 && left <= warnMs);
  $('ring-fg').style.strokeDasharray = RING_C;
  $('ring-fg').style.strokeDashoffset = left <= 0 ? 0 : RING_C * (1 - left / speakerMs);
  $('speaker-name').textContent = cur?.name ?? '';
  $('speaker-time').textContent = left > 0 ? S.fmt(left, 'ceil') : `+${S.fmt(-left)}`;
  $('speaker-pos').textContent = m.status === 'paused' ? 'Paused' : `Turn ${m.index + 1} of ${m.order.length}`;

  // Meeting bar + forecast
  const total = S.meetingElapsed(m, now);
  $('meeting-elapsed').textContent = S.fmt(total);
  const bar = $('meeting-progress');
  bar.style.width = `${Math.min(100, (total / meetingMs) * 100)}%`;
  bar.style.background = total > meetingMs ? 'var(--over)' : total > meetingMs * 0.8 ? 'var(--warn)' : 'var(--accent)';
  const projected = S.projectedTotal(m, now);
  const fc = $('meeting-forecast');
  fc.className = projected > meetingMs ? 'forecast-over' : 'forecast-ok';
  fc.textContent = projected > meetingMs ? `≈ ${S.fmt(projected - meetingMs)} over` : 'on track';

  renderQueue(m, now, speakerMs);

  // Alerts (only on threshold crossings, so reopening the popup doesn't re-beep)
  if (m.status === 'running' && cur) {
    const key = `${m.startedAt}:${m.index}:${cur.id}`;
    if (warnMs > 0 && crossed(`${key}:warn`, left, warnMs)) beep(1, 660);
    if (crossed(`${key}:up`, left, 0)) {
      beep(2, 880);
      if (state.settings.autoAdvance) act(S.next, m.index);
    }
    if (crossed(`${m.startedAt}:meeting`, meetingMs - total, 0)) beep(3, 520);
  }
}

let queueSig = '';
function renderQueue(m, now, speakerMs) {
  const list = $('queue');
  // Rebuild only when the structure changes; otherwise update times in place (keeps clicks/hover stable).
  const sig = JSON.stringify([m.startedAt, m.order.map((p) => p.id), m.index, m.deferred]);
  if (sig !== queueSig) {
    queueSig = sig;
    list.replaceChildren(...m.order.map((p, i) => {
      const li = el('li', { className: i < m.index ? 'done' : i === m.index ? 'current' : 'upcoming' });
      li.dataset.index = i;
      if (i !== m.index) li.title = `Switch to ${p.name}`;
      li.append(el('span', { className: 'dot' }), el('span', { className: 'name', textContent: p.name }));
      if (m.deferred.includes(p.id) && i >= m.index) li.append(el('span', { className: 'tag', textContent: 'later' }));
      li.append(el('span', { className: 't' }));
      return li;
    }));
    list.children[m.index]?.scrollIntoView({ block: 'nearest' });
  }
  m.order.forEach((p, i) => {
    const li = list.children[i];
    const spent = S.speakerElapsed(m, p.id, now);
    li.classList.toggle('over', spent > speakerMs);
    li.lastChild.textContent = spent ? S.fmt(spent) : '';
  });
}

// ================= SUMMARY =================
$('btn-new').addEventListener('click', () => S.save({ meeting: S.reset() }));
$('btn-copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(summaryText());
  $('btn-copy').textContent = 'Copied ✓';
  setTimeout(() => ($('btn-copy').textContent = 'Copy summary'), 1500);
});

function renderSummary() {
  const m = state.meeting;
  const total = S.meetingElapsed(m);
  const box = m.meetingSeconds * 1000;
  const speakerMs = m.speakerSeconds * 1000;
  $('sum-total').textContent = S.fmt(total);
  const diff = total - box;
  $('sum-verdict').textContent = diff > 0
    ? `${S.fmt(diff)} over the ${S.fmt(box)} timebox`
    : `${S.fmt(-diff)} under the ${S.fmt(box)} timebox 🎉`;
  $('sum-verdict').style.color = diff > 0 ? 'var(--over)' : 'var(--ok-text)';

  const max = Math.max(speakerMs, ...m.order.map((p) => m.spent[p.id] ?? 0));
  $('sum-list').replaceChildren(...m.order.map((p) => {
    const spent = m.spent[p.id] ?? 0;
    const li = el('li', { className: spent > speakerMs ? 'over' : spent === 0 ? 'skipped' : '' });
    const bar = el('div', { className: 'bar' });
    bar.append(el('div', { style: `width:${(spent / max) * 100}%` }));
    li.append(
      el('span', { className: 'name', textContent: p.name }),
      el('span', { className: 't', textContent: spent ? `${S.fmt(spent)}${spent > speakerMs ? ` (+${S.fmt(spent - speakerMs)})` : ''}` : 'did not speak' }),
      bar,
    );
    return li;
  }));

  const notes = (m.notes ?? '').trim();
  $('sum-notes-wrap').hidden = !notes;
  $('sum-notes').textContent = notes;
}

function summaryText() {
  const m = state.meeting;
  const speakerMs = m.speakerSeconds * 1000;
  const date = new Date(m.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const lines = [`Daily – ${date} · ${S.fmt(S.meetingElapsed(m))} (timebox ${S.fmt(m.meetingSeconds * 1000)})`, ''];
  for (const p of m.order) {
    const spent = m.spent[p.id] ?? 0;
    lines.push(`• ${p.name}: ${spent ? S.fmt(spent) : '—'}${spent > speakerMs ? ` (+${S.fmt(spent - speakerMs)})` : ''}`);
  }
  const notes = (m.notes ?? '').trim();
  if (notes) lines.push('', 'Parking lot:', notes);
  return lines.join('\n');
}

// ================= RENDER LOOP =================
function render() {
  const status = state.meeting.status;
  const inMeeting = status === 'running' || status === 'paused';
  $('view-setup').hidden = status !== 'idle';
  $('view-meeting').hidden = !inMeeting;
  $('view-summary').hidden = status !== 'done';
  if (status === 'idle') renderSetup();
  if (inMeeting) { renderMeetingStatic(); tick(); }
  if (status === 'done') renderSummary();
}

render();
setInterval(tick, 250);

// ================= helpers =================
function el(tag, props = {}, data = {}) {
  const node = Object.assign(document.createElement(tag), props);
  if (props.ariaLabel) node.setAttribute('aria-label', props.ariaLabel);
  Object.assign(node.dataset, data);
  return node;
}

const lastValues = new Map();
/** True exactly once when `value` drops from above `threshold` to at/below it. */
function crossed(key, value, threshold) {
  const prev = lastValues.get(key);
  lastValues.set(key, value);
  return prev !== undefined && prev > threshold && value <= threshold;
}

let audioCtx;
function unlockAudio() {
  audioCtx ??= new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(times, freq) {
  if (!state.settings.sound) return;
  unlockAudio();
  const t0 = audioCtx.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    const t = t0 + i * 0.28;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}
