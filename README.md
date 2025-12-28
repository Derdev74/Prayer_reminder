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
| `geolocation` | Find nearby mosques (only when you click "Use my location") |

**Note:** Location is only accessed when you explicitly click "Use my location". It is never stored or tracked.

## Audio Sources

Adhan audio is streamed from [AlAdhan.com](https://aladhan.com):
- Fajr: `https://cdn.aladhan.com/audio/adhans/1/Fajr.mp3`
- Regular: `https://cdn.aladhan.com/audio/adhans/1/Adhan.mp3`

## Technical Details

- **Manifest Version:** 3
- **Service Worker:** background.js
- **API:** Mawaqit mosque search and prayer times
- **No tracking, no analytics, no data collection**

## Important Notes

- **Browser must be running:** Chrome/browser must be running for notifications and adhan to work. If your browser is closed at prayer time, you won't receive notifications.
- **Default mosque:** First-time setup uses CCML (Lausanne, Switzerland) as default. Change it to your local mosque.
- **Daily updates:** Prayer times are automatically fetched daily at 12:01 AM and when the browser starts.
- **Alarm persistence:** Alarms are rescheduled daily and persist across browser restarts (unless browser is closed for extended periods).
- **Smart skip feature:** If browser was closed and reopens more than 1 hour after a scheduled prayer time, the adhan is automatically skipped to avoid late/outdated notifications.

## Troubleshooting

**Location not working?**
- Make sure you're clicking the location link from the extension popup (not from settings)
- Check that location permissions are enabled in your browser settings
- If it still doesn't work, search by mosque name or city instead

**No notifications appearing?**
- Ensure Chrome notifications are enabled in your system settings
- Check that the extension has notification permissions
- Make sure your browser is running at prayer times

**Adhan not playing?**
- Check your system volume
- Ensure audio permissions are granted
- The extension uses online audio from AlAdhan.com - check your internet connection
- If browser was closed for more than 1 hour, adhan is skipped automatically

**Prayer times incorrect?**
- Click "Refresh Prayer Times" in the popup
- Verify you selected the correct mosque
- Prayer times are fetched from Mawaqit's API and updated daily

## Known Issues & Limitations

- **Browser dependency:** Notifications only work when the browser is running. Consider using a dedicated prayer times desktop app if you need notifications when browser is closed.
- **Daily update timing:** Prayer times update at midnight (12:01 AM). If browser is closed at this time, the update happens when browser next starts.
- **Fallback audio:** If primary adhan audio from AlAdhan.com fails to load, a fallback URL is used, but reliability depends on external services.

## Contributing

Found a bug or want to contribute? Feel free to:
- Report issues on the project repository
- Submit pull requests with improvements
- Suggest new features

## License

MIT License - Feel free to use, modify, and distribute.
