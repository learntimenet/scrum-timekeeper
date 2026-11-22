# Daily Timekeeper

A browser extension (Chrome / Edge, Manifest V3) that keeps time during scrum dailies.

## Features

- **Team size only:** set how many people are in today's daily. No names needed: speakers appear as "Speaker 1", "Speaker 2" and so on. Use **+ Add speaker** during the meeting if someone joins late.
- Styled with the **learntime.net** palette (paper, ink, Learn Time purple, coral, teal), with light and dark themes.
- **Time per person** with a countdown ring that turns amber near the end and red when someone runs over. It then counts up the overtime (`+0:12`).
- **Meeting timebox** shown as a progress bar, with a live forecast: "on track" or "≈ 1:30 over".
- **Controls:** Pause/Resume, Next, Back, and **Later** (moves someone who isn't ready to the end of the queue). Click any name in the queue to switch to that person.
- **Keyboard:** `Space` pause, `→`/`N` next, `←`/`P` back, `L` later.
- **Alerts:** a beep at the warning point and at time-up, plus optional desktop notifications. Notifications still fire when the popup is closed.
- **Auto-advance** (optional): moves to the next speaker automatically when time is up.
- **Parking lot** notes for topics to take offline.
- **Summary** with each person's time, overruns and the parking lot, plus a **Copy summary** button for pasting into Slack or Teams.
- Opens as a popup, in the **side panel**, or as a **pop-out window** that stays on top of your call.

The timer is based on timestamps, so it keeps running correctly when the popup is closed.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Pin the extension. For dailies, the side panel or pop-out works best because a popup closes when you click elsewhere.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest |
| `state.js` | State model and actions (start, next, later, and so on). Shared by the UI and the background worker. |
| `timer.html/css/js` | UI used by the popup, side panel and pop-out window |
| `background.js` | Toolbar badge (`2/7`, `II` when paused), alarms, notifications, auto-advance |
| `icons/` | Extension icons |

## Notes

- Chrome alarms have a 30-second minimum. If the UI is closed and less than 30 s is left after a resume, the background notification can arrive a few seconds late. With the UI open, alerts are exact.
- Sounds play only while an extension page (popup, side panel or window) is open.
