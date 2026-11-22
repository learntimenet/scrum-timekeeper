# Chrome Web Store listing

## Store listing tab

**Name** (from manifest, max 75 chars)

```
Daily Timekeeper
```

**Summary** (from manifest `description`, max 132 chars)

```
Keep scrum dailies on time: per-person countdown, meeting timebox, speaker queue, parking lot and a shareable summary.
```

**Category:** Workflow & Planning (or Productivity)

**Description** (plain text, paste as is)

```
Keep your daily stand-up short and fair, without anyone having to watch the clock.

Daily Timekeeper gives every person the same timebox, shows the whole team how the meeting is tracking, and wraps up with a summary you can paste into Slack or Teams.

SET UP IN SECONDS
• Enter how many people are in today's daily. No names or sign-up needed.
• Choose the time per person and the meeting timebox.
• See straight away whether the plan fits, for example "1:00 buffer" or "2:00 over".

DURING THE DAILY
• A large countdown ring for the current speaker turns coral near the end and red once they run over, then counts the overtime.
• A meeting progress bar with a live forecast: "On track" or "≈ 1:30 over".
• One-click controls: Pause, Next, Back and Later. Later moves someone who isn't ready to the end of the queue.
• The speaker row shows who has spoken, who ran over and who is next. Click any speaker to switch to them.
• Add a speaker mid-meeting when someone joins late.
• A parking lot for topics to take offline after the daily.
• Keyboard shortcuts: Space to pause, ← → to move between speakers, L for later.

ALERTS
• A gentle beep at the warning point and when time is up.
• Optional desktop notifications, even when the popup is closed.
• Optional auto-advance to the next speaker when time is up.

AFTER THE DAILY
• Total time against the timebox, average time per person and number of overruns.
• Time per speaker with overruns highlighted.
• Copy summary: a clean text recap, including the parking lot, ready to paste into your team channel.

WORKS THE WAY YOU RUN MEETINGS
• Open it as a popup, in Chrome's side panel, or as a separate window that stays next to your video call.
• The timer keeps running correctly when you close the popup.
• Light and dark themes follow your system setting.

PRIVATE BY DESIGN
• No account, no tracking, no ads.
• Settings and meeting data stay in your browser's local storage.
• The extension doesn't read or change any websites you visit.

Made by Learn Time.
```

## Privacy practices tab

**Single purpose**

```
Daily Timekeeper is a meeting timer for scrum daily stand-ups. It times each speaker and the overall meeting, and produces a summary at the end.
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Saves the user's timer settings (team size, time per person, timebox, alert preferences) and the state of the current meeting locally, so the timer keeps running when the popup is closed. |
| `alarms` | Schedules the "time is up" events for the current speaker and the meeting timebox, so alerts fire even when no extension page is open. |
| `notifications` | Shows an optional desktop notification when a speaker's time or the meeting timebox runs out. Users can turn this off in settings. |
| `sidePanel` | Lets the user open the timer in Chrome's side panel so it stays visible during the meeting. |

**Remote code:** No, I am not using remote code. All scripts are packaged with the extension.

**Data usage:** The extension does not collect or transmit any user data. Tick no data categories, then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** Optional, because no user data is collected. If you want one, a short page saying "Daily Timekeeper stores its settings and meeting data only in your browser's local storage and does not collect, transmit or share any data" is enough.

## Assets still needed

- Store icon: 128×128 PNG (`icons/icon128.png`)
- At least 1 screenshot, 1280×800 or 640×400 (setup, meeting and summary screens work well)
- Optional small promo tile: 440×280
