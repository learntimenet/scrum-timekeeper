// Background worker: keeps the toolbar badge in sync, fires desktop notifications
// and (optionally) auto-advances speakers even when no extension page is open.
import { load, save, current, speakerElapsed, meetingElapsed, next } from './state.js';

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.meeting || changes.settings)) schedule();
});

async function schedule() {
  await chrome.alarms.clearAll();
  const { meeting: m } = await load();
  updateBadge(m);
  if (m.status !== 'running') return;

  const now = Date.now();
  const cur = current(m);
  if (cur) {
    const left = m.speakerSeconds * 1000 - speakerElapsed(m, cur.id, now);
    if (left > 0) chrome.alarms.create(`speaker:${m.index}:${cur.id}`, { when: now + left });
  }
  const meetingLeft = m.meetingSeconds * 1000 - meetingElapsed(m, now);
  if (meetingLeft > 0) chrome.alarms.create(`meeting:${m.startedAt}`, { when: now + meetingLeft });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const { meeting: m, settings } = await load();
  if (m.status !== 'running') return;
  const [kind, a, b] = alarm.name.split(':');

  if (kind === 'speaker') {
    const index = Number(a);
    const cur = current(m);
    if (m.index !== index || cur?.id !== b) return; // stale alarm
    const upNext = m.order[index + 1];
    notify(settings, `speaker-${m.startedAt}-${index}`, `Time's up, ${cur.name}!`,
      upNext ? `Up next: ${upNext.name}` : 'That was the last speaker.');
    if (settings.autoAdvance) {
      const updated = next(structuredClone(m), Date.now(), index);
      if (updated) await save({ meeting: updated });
    }
  } else if (kind === 'meeting') {
    if (String(m.startedAt) !== a) return;
    notify(settings, `meeting-${m.startedAt}`, 'Daily timebox reached',
      `${m.order.length - m.index - 1} speaker(s) still to go after ${current(m)?.name ?? '—'}.`);
  }
});

function notify(settings, id, title, message) {
  if (!settings.notifications) return;
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 2,
  });
}

function updateBadge(m) {
  if (m.status === 'running' || m.status === 'paused') {
    chrome.action.setBadgeText({ text: m.status === 'paused' ? 'II' : `${m.index + 1}/${m.order.length}` });
    chrome.action.setBadgeBackgroundColor({ color: m.status === 'paused' ? '#4b5a6c' : '#752be8' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
