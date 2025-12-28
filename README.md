# Prayer Reminder Extension

Browser extension for Chrome, Brave, Edge, and other Chromium browsers.
Search for any mosque on Mawaqit, get prayer time notifications with adhan, and never miss a prayer.

## Features

- **Multi-mosque support:** Search and select any mosque registered on [Mawaqit](https://mawaqit.net)
- **Location-based search:** Optionally use your location to find nearby mosques (one-time permission)
- **Automatic updates:** Prayer times fetched daily from Mawaqit
- **Prayer notifications:** Desktop notification at each prayer time
- **15-minute reminder:** Follow-up notification reminding you to pray
- **Dual adhan audio:**
  - Fajr adhan (includes "As-salatu khayrun min an-nawm")
  - Regular adhan for Dhuhr, Asr, Maghrib, Isha
- **Smart skip:** If you weren't using the browser and more than 1 hour has passed since prayer time, the adhan is skipped (no late alarms)
- **Privacy-focused:** Location is optional and one-time use only

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the extension folder
5. Click the extension icon to search for your mosque

## Usage

1. **First run:** Search for your mosque by name or city
2. **Or use location:** Click "Use my location" to find nearby mosques
3. **Select mosque:** Click on a mosque from the search results
4. **Done!** You'll receive notifications and adhan at each prayer time

### Changing Mosque

Click the extension icon and use the "Change Mosque" button to select a different mosque.

## How It Works

- Prayer times are fetched from Mawaqit's platform
- Alarms are scheduled for each of the 5 daily prayers
- At prayer time: notification + adhan plays
- 15 minutes later: reminder notification (no adhan)
- If browser was closed and reopens more than 1 hour after prayer time, the adhan is skipped

## Permissions

| Permission | Purpose |
|------------|---------|
| `alarms` | Schedule prayer time notifications |
| `notifications` | Show prayer reminders |
| `storage` | Save selected mosque and prayer times |
| `offscreen` | Play adhan audio (required for Manifest V3) |

**Note:** When you click "Use my location", your browser will ask for location permission. This is a one-time browser prompt, not an extension permission. The extension does not store or track your location.

## Audio Sources

Adhan audio is streamed from [AlAdhan.com](https://aladhan.com):
- Fajr: `https://cdn.aladhan.com/audio/adhans/1/Fajr.mp3`
- Regular: `https://cdn.aladhan.com/audio/adhans/1/Adhan.mp3`

## Technical Details

- **Manifest Version:** 3
- **Service Worker:** background.js
- **API:** Mawaqit mosque search and prayer times
- **No tracking, no analytics, no data collection**

## License

MIT License - Feel free to use, modify, and distribute.
