let PRAYER_TIMES = {};

// Fetch prayer times from CCML website or use defaults
async function fetchPrayerTimes() {
  try {
    // First, try to get from API if available (check if CCML has an API endpoint)
    // This is a placeholder - you may need to find the actual API endpoint
    
    // For now, use default times for Lausanne (approximate times)
    // These should be updated based on actual CCML times or season
    const defaultTimes = getDefaultPrayerTimes();
    
    // Try to fetch from website
    const url = "https://www.ccmgl.ch/fr/cultes/horaire-des-pri%C3%A8res";
    const response = await fetch(url);
    const text = await response.text();
    
    // Try multiple extraction patterns
    let extractedTimes = {};
    
    // Pattern 1: Look for JSON data in script tags
    const jsonMatch = text.match(/var\s+prayerTimes\s*=\s*({[^}]+})/);
    if (jsonMatch) {
      try {
        extractedTimes = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.log('JSON parsing failed');
      }
    }
    
    // Pattern 2: CCML table structure - look for calendar table
    if (Object.keys(extractedTimes).length === 0) {
      // Try to parse as HTML to find table structure
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const tables = doc.querySelectorAll('table');
      
      for (let table of tables) {
        const tableText = table.innerText || table.textContent || '';
        // Check if this is the prayer times table
        if (tableText.includes('Fadjr') && tableText.includes('Dhohr') && tableText.includes('Maghrib')) {
          // Get today's date
          const today = new Date();
          const todayDate = today.getDate();
          
          // Look for today's row
          const rows = table.querySelectorAll('tr');
          for (let row of rows) {
            const rowText = row.innerText || row.textContent || '';
            if (rowText.includes(String(todayDate))) {
              // Extract all times from this row
              const timeMatches = rowText.match(/\d{1,2}[:h]\d{2}/g);
              if (timeMatches && timeMatches.length >= 6) {
                // Order in CCML table: Fadjr, Sunrise, Dhohr, Asr, Maghrib, Icha
                extractedTimes.Fajr = timeMatches[0].replace('h', ':');
                extractedTimes.Dhuhr = timeMatches[2].replace('h', ':'); // Skip sunrise at index 1
                extractedTimes.Asr = timeMatches[3].replace('h', ':');
                extractedTimes.Maghrib = timeMatches[4].replace('h', ':');
                extractedTimes.Isha = timeMatches[5].replace('h', ':');
                console.log('Extracted from table row:', extractedTimes);
                break;
              }
            }
          }
        }
      }
    }
    
    // Pattern 3: Fallback regex patterns - CCML uses French names
    if (Object.keys(extractedTimes).length === 0) {
      const patterns = {
        Fajr: [/(?:Fadjr|Fajr|Sobh|Subh)[^0-9]*(\d{1,2}[:h]\d{2})/i, /(?:فجر)[^0-9]*(\d{1,2}:\d{2})/],
        Dhuhr: [/(?:Dhohr|Dhuhr|Dohr|Zuhr)[^0-9]*(\d{1,2}[:h]\d{2})/i, /(?:ظهر)[^0-9]*(\d{1,2}:\d{2})/],
        Asr: [/(?:Asr|Aser)[^0-9]*(\d{1,2}[:h]\d{2})/i, /(?:عصر)[^0-9]*(\d{1,2}:\d{2})/],
        Maghrib: [/(?:Maghrib|Maghreb|Magrib)[^0-9]*(\d{1,2}[:h]\d{2})/i, /(?:مغرب)[^0-9]*(\d{1,2}:\d{2})/],
        Isha: [/(?:Icha|Isha|Ischaa)[^0-9]*(\d{1,2}[:h]\d{2})/i, /(?:عشاء)[^0-9]*(\d{1,2}:\d{2})/]
      };
      
      for (const [prayer, patternList] of Object.entries(patterns)) {
        for (const pattern of patternList) {
          const match = text.match(pattern);
          if (match && match[1]) {
            // Normalize time format (replace h with :)
            extractedTimes[prayer] = match[1].replace('h', ':');
            break;
          }
        }
      }
    }
    
    // If we successfully extracted times, use them
    if (Object.keys(extractedTimes).length === 5) {
      PRAYER_TIMES = extractedTimes;
      console.log('Extracted prayer times from website:', PRAYER_TIMES);
    } else {
      // Use default times as fallback
      PRAYER_TIMES = defaultTimes;
      console.log('Using default prayer times:', PRAYER_TIMES);
    }
    
    // Save to storage
    await chrome.storage.local.set({ 
      prayerTimes: PRAYER_TIMES,
      lastFetch: new Date().toISOString(),
      source: Object.keys(extractedTimes).length === 5 ? 'website' : 'default'
    });
    
    scheduleAlarms();
    
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    
    // Load from storage or use defaults
    const stored = await chrome.storage.local.get('prayerTimes');
    if (stored.prayerTimes && Object.keys(stored.prayerTimes).length === 5) {
      PRAYER_TIMES = stored.prayerTimes;
    } else {
      PRAYER_TIMES = getDefaultPrayerTimes();
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