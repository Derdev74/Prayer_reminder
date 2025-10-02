let PRAYER_TIMES = {};

async function fetchPrayerTimes() {
  // The CCML site HTML parsing: adjust selectors if site structure changes.
  const url = "https://www.ccmgl.ch/fr/cultes/horaire-des-pri%C3%A8res";
  const response = await fetch(url);
  const text = await response.text();

  // Simple extraction by RegExp matching for French static times.
  // Update the below regex if the table format changes!
  let matches = text.match(/Fajr\s*\<\/td\>\s*<td[^>]*>(\d{2}:\d{2})[\s\S]*?Dhuhr\s*\<\/td\>\s*<td[^>]*>(\d{2}:\d{2})[\s\S]*?Asr\s*<\/td>\s*<td[^>]*>(\d{2}:\d{2})[\s\S]*?Maghrib\s*<\/td>\s*<td[^>]*>(\d{2}:\d{2})[\s\S]*?Isha\s*<\/td>\s*<td[^>]*>(\d{2}:\d{2})/i);

  if (matches) {
    PRAYER_TIMES = {
      Fajr: matches[1],
      Dhuhr: matches[2],
      Asr: matches[3],
      Maghrib: matches[4],
      Isha: matches[5]
    };
    chrome.storage.local.set({ prayerTimes: PRAYER_TIMES });
    scheduleAlarms();
  } else {
    // fallback: notify user that times were not fetched
    chrome.storage.local.set({ prayerTimes: {} });
  }
}

// Set alarms for today's prayers
function scheduleAlarms() {
  chrome.alarms.clearAll();
  for (const [prayer, time] of Object.entries(PRAYER_TIMES)) {
    let [hour, minute] = time.split(':').map(Number);
    let now = new Date();
    let alarmDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute, 0, 0
    );
    if (alarmDate.getTime() <= now.getTime()) {
      alarmDate.setDate(alarmDate.getDate() + 1);
    }
    chrome.alarms.create(prayer, { when: alarmDate.getTime() });
  }
}

// Alarm notifications + adhan playback
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== "updateTimes") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: `${alarm.name} Prayer`,
      message: `It's time for ${alarm.name} prayer! (CCML Lausanne)`
    });
    playAdhan();
    scheduleAlarms();
  }
});

// Utility: Play adhan audio on prayer alarm
function playAdhan() {
  // play adhan from the extension root, uses web_accessible_resources
  if (typeof self.Audio !== "undefined") {
    let audio = new Audio(chrome.runtime.getURL("adhan.mp3"));
    audio.play();
  }
}

// Fetch prayer times once per day at startup/installation
chrome.runtime.onStartup.addListener(fetchPrayerTimes);
chrome.runtime.onInstalled.addListener(fetchPrayerTimes);
// Fetch again daily at 00:01
chrome.alarms.create("updateTimes", { when: new Date().setHours(0, 1, 0, 0), periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "updateTimes") fetchPrayerTimes();
});

// Support manual override from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "saveTimes" && request.times) {
    PRAYER_TIMES = request.times;
    chrome.storage.local.set({ prayerTimes: PRAYER_TIMES });
    scheduleAlarms();
    sendResponse({status: "ok"});
  }
});
