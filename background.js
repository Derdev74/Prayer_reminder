let PRAYER_TIMES = {};

// Fetch prayer times from Mawaqit (official CCML source)
async function fetchPrayerTimes() {
  try {
    console.log('Fetching prayer times from Mawaqit for CCML Lausanne...');

    // Fetch from Mawaqit - official CCML prayer times platform
    const url = "https://mawaqit.net/en/ccml";
    const response = await fetch(url);
    const html = await response.text();

    console.log('Successfully fetched Mawaqit page');

    // Extract the times array from the confData JSON
    // Format: "times":["06:08","13:25","16:23","18:58","20:20"]
    // Order: Fajr, Dhuhr, Asr, Maghrib, Isha
    const timesMatch = html.match(/"times":\s*\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)"\]/);

    if (timesMatch && timesMatch.length === 6) {
      PRAYER_TIMES = {
        Fajr: timesMatch[1],
        Dhuhr: timesMatch[2],
        Asr: timesMatch[3],
        Maghrib: timesMatch[4],
        Isha: timesMatch[5]
      };

      console.log('✓ Successfully extracted prayer times from Mawaqit:', PRAYER_TIMES);

      // Save to storage
      await chrome.storage.local.set({
        prayerTimes: PRAYER_TIMES,
        lastFetch: new Date().toISOString(),
        source: 'mawaqit'
      });

      scheduleAlarms();
    } else {
      console.error('Could not extract prayer times from Mawaqit page');
      throw new Error('Failed to parse prayer times');
    }

  } catch (error) {
    console.error('Error fetching prayer times from Mawaqit:', error);

    // Load from storage or use defaults
    const stored = await chrome.storage.local.get('prayerTimes');
    if (stored.prayerTimes && Object.keys(stored.prayerTimes).length === 5) {
      PRAYER_TIMES = stored.prayerTimes;
      console.log('Using cached prayer times:', PRAYER_TIMES);
    } else {
      PRAYER_TIMES = getDefaultPrayerTimes();
      console.log('Using default prayer times:', PRAYER_TIMES);
    }
    scheduleAlarms();
  }
}

// Get default prayer times based on season
function getDefaultPrayerTimes() {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  
  // Winter times (November - February)
  if (month >= 10 || month <= 1) {
    return {
      Fajr: "06:30",
      Dhuhr: "12:30",
      Asr: "14:30",
      Maghrib: "17:00",
      Isha: "19:00"
    };
  }
  // Summer times (May - August)
  else if (month >= 4 && month <= 7) {
    return {
      Fajr: "04:00",
      Dhuhr: "13:30",
      Asr: "17:30",
      Maghrib: "21:00",
      Isha: "23:00"
    };
  }
  // Spring/Fall times
  else {
    return {
      Fajr: "05:30",
      Dhuhr: "13:00",
      Asr: "16:00",
      Maghrib: "19:00",
      Isha: "20:30"
    };
  }
}

// Schedule alarms for today's prayers
async function scheduleAlarms() {
  // Clear all existing alarms first
  await chrome.alarms.clearAll();
  
  const now = new Date();
  
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
    
    console.log(`Scheduled ${prayer} alarm for ${alarmDate.toLocaleString()}`);
  }
  
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
    
    // Show notification
    chrome.notifications.create(`notification_${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icon.png',
      title: `${prayerName} Prayer Time`,
      message: `It's time for ${prayerName} prayer! (CCML Lausanne)`,
      priority: 2,
      requireInteraction: true
    });
    
    // Play adhan sound using offscreen document (for Manifest V3)
    await playAdhan();
    
    // Reschedule this specific prayer for tomorrow
    const time = PRAYER_TIMES[prayerName];
    if (time) {
      const [hour, minute] = time.split(':').map(Number);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute, 0, 0);
      
      await chrome.alarms.create(alarm.name, {
        when: tomorrow.getTime()
      });
    }
  }
});

async function playAdhan() {
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
    
    // Send message to offscreen document to play audio
    // Note: We need to broadcast to all runtime contexts since offscreen is a separate context
    await chrome.runtime.sendMessage({
      type: 'playAdhan',
      audioFile: 'adhan.mp3'
    }).catch(err => {
      console.log('Message to offscreen may have failed, trying alternative:', err);
    });
    
    // Close offscreen document after 3 minutes
    setTimeout(async () => {
      try {
        await chrome.offscreen.closeDocument();
      } catch (e) {
        // Document might already be closed
      }
    }, 180000);
    
  } catch (error) {
    console.error('Error playing adhan:', error);
    
    // Fallback: Try direct audio playback in service worker (may not work in all browsers)
    try {
      const audio = new Audio(chrome.runtime.getURL('adhan.mp3'));
      audio.volume = 0.5;
      await audio.play();
    } catch (fallbackError) {
      console.error('Fallback audio also failed:', fallbackError);
    }
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
  if (request.type === 'saveTimes' && request.times) {
    PRAYER_TIMES = request.times;
    chrome.storage.local.set({ prayerTimes: PRAYER_TIMES })
      .then(() => {
        scheduleAlarms();
        sendResponse({ status: 'ok' });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.type === 'getTimes') {
    sendResponse({ times: PRAYER_TIMES });
    return true;
  }
  
  if (request.type === 'fetchNow') {
    fetchPrayerTimes().then(() => {
      sendResponse({ status: 'ok', times: PRAYER_TIMES });
    });
    return true;
  }
  
  // ADD THIS NEW HANDLER HERE:
  if (request.type === 'setFetchedTimes' && request.times) {
    PRAYER_TIMES = request.times;
    chrome.storage.local.set({ 
      prayerTimes: PRAYER_TIMES,
      lastFetch: new Date().toISOString(),
      source: 'content-script'
    }).then(() => {
      scheduleAlarms();
      sendResponse({ status: 'ok' });
    });
    return true;
  }
});