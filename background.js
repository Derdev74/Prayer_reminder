let PRAYER_TIMES = {};
let SELECTED_MOSQUE = null;

// Debounce timer to prevent race conditions
let fetchDebounceTimer = null;

// Maximum delay (in ms) after which adhan should not play (1 hour)
const MAX_ADHAN_DELAY_MS = 60 * 60 * 1000; // 1 hour

// Reminder delay after prayer time (15 minutes)
const REMINDER_DELAY_MS = 15 * 60 * 1000; // 15 minutes

// Fetch prayer times from Mawaqit API for selected mosque
async function fetchPrayerTimes() {
  // Debounce rapid calls
  if (fetchDebounceTimer) {
    clearTimeout(fetchDebounceTimer);
  }

  return new Promise((resolve) => {
    fetchDebounceTimer = setTimeout(async () => {
      try {
        // Load selected mosque from storage
        const stored = await chrome.storage.local.get(['selectedMosque', 'prayerTimes']);
        SELECTED_MOSQUE = stored.selectedMosque;

        if (!SELECTED_MOSQUE || !SELECTED_MOSQUE.slug) {
          console.log('No mosque selected. Please select a mosque first.');
          // Use cached times if available
          if (stored.prayerTimes && Object.keys(stored.prayerTimes).length === 5) {
            PRAYER_TIMES = stored.prayerTimes;
            scheduleAlarms();
          }
          resolve();
          return;
        }

        console.log(`Fetching prayer times for: ${SELECTED_MOSQUE.name}`);

        // Fetch from Mawaqit mosque page
        const url = `https://mawaqit.net/en/${SELECTED_MOSQUE.slug}`;
        const response = await fetch(url);
        const html = await response.text();

        // Extract times array: [Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha]
        const timesMatch = html.match(/"times":\s*\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)"\]/);

        if (timesMatch && timesMatch.length === 7) {
          PRAYER_TIMES = {
            Fajr: timesMatch[1],
            Dhuhr: timesMatch[3],  // Skip Sunrise at index 2
            Asr: timesMatch[4],
            Maghrib: timesMatch[5],
            Isha: timesMatch[6]
          };

          console.log('Successfully extracted prayer times:', PRAYER_TIMES);

          // Save to storage
          await chrome.storage.local.set({
            prayerTimes: PRAYER_TIMES,
            lastFetch: new Date().toISOString(),
            source: 'mawaqit-api'
          });

          scheduleAlarms();
        } else {
          throw new Error('Could not extract prayer times from Mawaqit page');
        }
      } catch (error) {
        console.error('Error fetching prayer times:', error);

        // Load from cache as fallback
        const stored = await chrome.storage.local.get('prayerTimes');
        if (stored.prayerTimes && Object.keys(stored.prayerTimes).length === 5) {
          PRAYER_TIMES = stored.prayerTimes;
          console.log('Using cached prayer times:', PRAYER_TIMES);
          scheduleAlarms();
        }
      }
      resolve();
    }, 300); // 300ms debounce
  });
}

// Schedule alarms for today's prayers
async function scheduleAlarms() {
  // Clear all existing alarms first
  await chrome.alarms.clearAll();

  const now = new Date();
  const scheduledTimes = {};

  for (const [prayer, time] of Object.entries(PRAYER_TIMES)) {
    if (!time) continue;

    const [hour, minute] = time.split(':').map(Number);
    const alarmDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0
    );

    // If the time has passed today, schedule for tomorrow
    if (alarmDate.getTime() <= now.getTime()) {
      alarmDate.setDate(alarmDate.getDate() + 1);
    }

    const alarmName = `prayer_${prayer}`;
    await chrome.alarms.create(alarmName, {
      when: alarmDate.getTime()
    });

    // Store the scheduled time so we can check lateness when alarm fires
    scheduledTimes[prayer] = alarmDate.getTime();

    console.log(`Scheduled ${prayer} alarm for ${alarmDate.toLocaleString()}`);
  }

  // Save scheduled times to storage for lateness check
  await chrome.storage.local.set({ scheduledPrayerTimes: scheduledTimes });

  // Schedule daily update at 12:01 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 1, 0, 0);

  await chrome.alarms.create('dailyUpdate', {
    when: tomorrow.getTime(),
    periodInMinutes: 1440 // 24 hours
  });
}

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);

  if (alarm.name === 'dailyUpdate') {
    // Fetch new prayer times daily
    await fetchPrayerTimes();
  } else if (alarm.name.startsWith('prayer_')) {
    // Extract prayer name
    const prayerName = alarm.name.replace('prayer_', '');

    // Get stored data
    const stored = await chrome.storage.local.get(['selectedMosque', 'scheduledPrayerTimes']);
    const mosqueName = stored.selectedMosque?.name || 'Your Mosque';
    const scheduledTime = stored.scheduledPrayerTimes?.[prayerName];

    // Check if alarm is too late (browser was suspended/closed)
    const now = Date.now();
    const delay = scheduledTime ? (now - scheduledTime) : 0;

    if (delay > MAX_ADHAN_DELAY_MS) {
      // More than 1 hour late - skip adhan and notification
      console.log(`Skipping ${prayerName} adhan - ${Math.round(delay / 60000)} minutes late (browser was inactive)`);
    } else {
      // Show notification
      chrome.notifications.create(`notification_${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: `${prayerName} Prayer Time`,
        message: `It's time for ${prayerName} prayer! (${mosqueName})`,
        priority: 2,
        requireInteraction: true
      });

      // Play adhan sound (passing prayer name for Fajr-specific adhan)
      await playAdhan(prayerName);

      // Schedule 15-minute reminder to go pray
      await chrome.alarms.create(`reminder_${prayerName}`, {
        when: Date.now() + REMINDER_DELAY_MS
      });
    }

    // Reschedule this specific prayer for tomorrow (always, even if skipped)
    const time = PRAYER_TIMES[prayerName];
    if (time) {
      const [hour, minute] = time.split(':').map(Number);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute, 0, 0);

      await chrome.alarms.create(alarm.name, {
        when: tomorrow.getTime()
      });

      // Update scheduled time in storage
      const updatedScheduled = stored.scheduledPrayerTimes || {};
      updatedScheduled[prayerName] = tomorrow.getTime();
      await chrome.storage.local.set({ scheduledPrayerTimes: updatedScheduled });
    }
  } else if (alarm.name.startsWith('reminder_')) {
    // 15-minute reminder to go pray
    const prayerName = alarm.name.replace('reminder_', '');

    // Get mosque name for notification
    const stored = await chrome.storage.local.get('selectedMosque');
    const mosqueName = stored.selectedMosque?.name || 'Your Mosque';

    // Show reminder notification (no adhan)
    chrome.notifications.create(`reminder_notification_${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icon.png',
      title: `${prayerName} Prayer Reminder`,
      message: `Don't forget to pray ${prayerName}! (${mosqueName})`,
      priority: 2,
      requireInteraction: false
    });

    console.log(`Sent 15-minute reminder for ${prayerName} prayer`);
  }
});

async function playAdhan(prayerName) {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    }).catch(() => []);

    if (existingContexts.length === 0) {
      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play adhan audio for prayer notification'
      });

      // Wait a bit for document to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send message to offscreen document to play audio with prayer name
    await chrome.runtime.sendMessage({
      type: 'playAdhan',
      prayerName: prayerName
    }).catch(err => {
      console.log('Message to offscreen may have failed:', err);
    });

    // Close offscreen document after 4 minutes (adhan is typically 3-4 minutes)
    setTimeout(async () => {
      try {
        await chrome.offscreen.closeDocument();
      } catch (e) {
        // Document might already be closed
      }
    }, 240000);

  } catch (error) {
    console.error('Error playing adhan:', error);
  }
}

// Initialize on install or browser startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  await fetchPrayerTimes();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started, fetching prayer times');
  await fetchPrayerTimes();
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getTimes') {
    sendResponse({ times: PRAYER_TIMES, mosque: SELECTED_MOSQUE });
    return true;
  }

  if (request.type === 'fetchNow') {
    fetchPrayerTimes().then(() => {
      sendResponse({ status: 'ok', times: PRAYER_TIMES });
    });
    return true;
  }

  if (request.type === 'selectMosque' && request.mosque) {
    SELECTED_MOSQUE = request.mosque;
    chrome.storage.local.set({
      selectedMosque: request.mosque,
      prayerTimes: request.mosque.prayerTimes || {}
    }).then(() => {
      PRAYER_TIMES = request.mosque.prayerTimes || {};
      scheduleAlarms();
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  if (request.type === 'searchMosques' && request.query) {
    searchMosques(request.query).then(mosques => {
      sendResponse({ status: 'ok', mosques });
    }).catch(error => {
      sendResponse({ status: 'error', error: error.message });
    });
    return true;
  }

  if (request.type === 'searchByLocation' && request.lat && request.lon) {
    searchMosquesByLocation(request.lat, request.lon).then(mosques => {
      sendResponse({ status: 'ok', mosques });
    }).catch(error => {
      sendResponse({ status: 'error', error: error.message });
    });
    return true;
  }
});

// Mosque search functions (inline to avoid import issues in service worker)
async function searchMosques(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const response = await fetch(
    `https://mawaqit.net/api/2.0/mosque/search?word=${encodeURIComponent(query.trim())}`
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const mosques = await response.json();
  return mosques.map(formatMosqueData);
}

async function searchMosquesByLocation(lat, lon) {
  const response = await fetch(
    `https://mawaqit.net/api/2.0/mosque/search?lat=${lat}&lon=${lon}`
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const mosques = await response.json();
  return mosques.map(formatMosqueData);
}

function formatMosqueData(mosque) {
  // Times array: [Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha]
  const times = mosque.times || [];

  return {
    uuid: mosque.uuid,
    name: mosque.name,
    slug: mosque.slug,
    address: mosque.localisation || '',
    latitude: mosque.latitude,
    longitude: mosque.longitude,
    proximity: mosque.proximity || null,
    prayerTimes: {
      Fajr: times[0] || '',
      Dhuhr: times[2] || '',
      Asr: times[3] || '',
      Maghrib: times[4] || '',
      Isha: times[5] || ''
    }
  };
}
