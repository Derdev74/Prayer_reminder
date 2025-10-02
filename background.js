let PRAYER_TIMES = {};

// Fetch prayer times from CCML website
async function fetchPrayerTimes() {
  try {
    const url = "https://www.ccmgl.ch/fr/cultes/horaire-des-pri%C3%A8res";
    const response = await fetch(url);
    const text = await response.text();
    
    // More robust parsing with multiple regex patterns
    const patterns = [
      // Pattern 1: Table format with prayer names and times
      /Fajr.*?(\d{1,2}:\d{2})/is,
      /Dhuhr.*?(\d{1,2}:\d{2})/is,
      /Asr.*?(\d{1,2}:\d{2})/is,
      /Maghrib.*?(\d{1,2}:\d{2})/is,
      /Isha.*?(\d{1,2}:\d{2})/is
    ];
    
    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const extractedTimes = {};
    
    prayerNames.forEach((prayer, index) => {
      const match = text.match(patterns[index]);
      if (match && match[1]) {
        extractedTimes[prayer] = match[1];
      }
    });
    
    // Only update if we got all prayer times
    if (Object.keys(extractedTimes).length === 5) {
      PRAYER_TIMES = extractedTimes;
      await chrome.storage.local.set({ 
        prayerTimes: PRAYER_TIMES,
        lastFetch: new Date().toISOString()
      });
      scheduleAlarms();
      console.log('Prayer times fetched successfully:', PRAYER_TIMES);
    } else {
      console.error('Could not extract all prayer times');
      // Try to load from storage as fallback
      const stored = await chrome.storage.local.get('prayerTimes');
      if (stored.prayerTimes) {
        PRAYER_TIMES = stored.prayerTimes;
        scheduleAlarms();
      }
    }
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    // Load from storage as fallback
    const stored = await chrome.storage.local.get('prayerTimes');
    if (stored.prayerTimes) {
      PRAYER_TIMES = stored.prayerTimes;
      scheduleAlarms();
    }
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

// Play adhan using offscreen document (Manifest V3 compatible)
async function playAdhan() {
  try {
    // Check if we can create an offscreen document
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length === 0) {
      // Create offscreen document for audio playback
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play adhan audio for prayer notification'
      });
    }
    
    // Send message to play audio
    chrome.runtime.sendMessage({ 
      type: 'playAdhan',
      audioFile: 'adhan.mp3'
    });
    
    // Close offscreen document after audio plays (estimate 3 minutes)
    setTimeout(async () => {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      if (contexts.length > 0) {
        await chrome.offscreen.closeDocument();
      }
    }, 180000); // 3 minutes
    
  } catch (error) {
    console.error('Error playing adhan:', error);
    // Fallback: just show notification without audio
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
});