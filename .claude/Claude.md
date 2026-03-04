# Project: Prayer Reminder Extension

## 🎯 Context & Intent
A Chrome/Chromium extension that fetches prayer times from the Mawaqit API and triggers notifications + Adhan audio. 
**Key Constraint:** Uses Manifest V3, which requires a Service Worker (`background.js`) and an Offscreen Document (`offscreen.js`) for audio playback.

## 🛠 Tech Stack
- **Extension:** Manifest V3
- **Logic:** Vanilla JavaScript (ES6+)
- **API:** Mawaqit (v2.0) for mosque search and prayer times
- **Audio:** Streams from AlAdhan.com (Fajr vs. Regular variants)
- **Storage:** `chrome.storage.local` for persistence

---

## 🧐 Review & Improvement Guidelines
1. **MV3 Lifecycle:** Ensure the Service Worker (`background.js`) remains stateless. Do not rely on global variables for long-term state; always pull from `chrome.storage.local`.
2. **Audio Reliability:** The Offscreen Document must be created only when needed and closed after playback. Check for existing contexts before creating a new one.
3. **Alarm Precision:** `chrome.alarms` can be delayed by the browser. Maintain the "Smart Skip" logic (MAX_ADHAN_DELAY_MS) to prevent late adhans.
4. **Error Handling:** Always provide fallbacks for network-dependent tasks (API fetches and audio streaming).

---

## 🐍 Coding Standards (JS)
- **Functions:** Use `async/await` over promise chaining for readability.
- **Naming:** `camelCase` for variables/functions; `SCREAMING_SNAKE_CASE` for constants (e.g., `MAX_ADHAN_DELAY_MS`).
- **DOM:** In `popup.js`, use `DOMContentLoaded` and strictly escape HTML when rendering search results to prevent XSS.
- **Structure:** - `background.js`: Orchestration, Alarms, API interaction.
    - `offscreen.js`: Audio playback only.
    - `popup.js`: UI logic and user input.

---

## 📂 Key File Navigation
- `manifest.json`: Permissions (`alarms`, `notifications`, `offscreen`, `storage`, `geolocation`) and host permissions for `mawaqit.net`.
- `background.js`: The "brain" — manages alarms and coordinates the offscreen audio.
- `offscreen.html/js`: The audio sandbox required by Manifest V3.
- `popup.html/js`: The user interface for mosque selection and time display.

---

## 🛠 Verification Commands
- **Manual Test:** 1. Load unpacked in `chrome://extensions`.
  2. Use "Refresh Prayer Times" to verify API connectivity.
  3. Use `chrome.alarms.getAll()` in the Service Worker console to verify scheduling.
- **Linting:** (Suggested) `eslint . --ext .js`

---

## 🤖 Interaction Workflow
- **State Check:** When modifying `background.js`, verify that variables like `PRAYER_TIMES` are correctly re-hydrated from storage on startup.
- **Permission Awareness:** If adding features (e.g., "Auto-refresh on location change"), suggest the necessary `manifest.json` updates.
- **Thoughtfulness:** Wrap architectural refactors in `<thought>` tags to explain how the change affects the extension's background lifecycle.