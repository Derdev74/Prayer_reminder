// Offscreen document script for audio playback
console.log('Offscreen document loaded');

// Audio URLs for different adhan types
// Fajr adhan includes "As-salatu khayrun min an-nawm" (Prayer is better than sleep)
const ADHAN_URLS = {
  fajr: 'https://cdn.aladhan.com/audio/adhans/1/Fajr.mp3',
  regular: 'https://cdn.aladhan.com/audio/adhans/1/Adhan.mp3'
};

// Fallback URLs in case primary fails
const FALLBACK_URLS = {
  fajr: 'https://cdn.aladhan.com/audio/adhans/2/Fajr.mp3',
  regular: 'https://www.islamcan.com/audio/adhan/azan1.mp3'
};

let audio = null;

// Load an audio URL and play it only once it's ready (avoids AbortError race condition)
function tryPlay(url) {
  return new Promise((resolve, reject) => {
    const a = new Audio(url);
    a.volume = 0.7;
    a.addEventListener('canplay', () => {
      a.play().then(() => resolve(a)).catch(reject);
    }, { once: true });
    a.addEventListener('error', (e) => {
      reject(new Error(`Failed to load audio: ${e.type}`));
    }, { once: true });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== 'playAdhan') return false;

  const prayerName = request.prayerName || '';
  const isFajr = prayerName.toLowerCase() === 'fajr';
  const adhanType = isFajr ? 'fajr' : 'regular';

  console.log(`Playing ${adhanType} adhan for ${prayerName}`);

  if (audio) {
    audio.pause();
    audio = null;
  }

  // Acknowledge receipt immediately so background.js doesn't retry
  sendResponse({ status: 'received', adhanType });

  // Async playback with clean fallback — separated from sendResponse
  (async () => {
    try {
      audio = await tryPlay(ADHAN_URLS[adhanType]);
      console.log(`${adhanType} adhan playing`);
    } catch (primaryErr) {
      console.error(`Primary URL failed (${primaryErr.message}), trying fallback...`);
      try {
        audio = await tryPlay(FALLBACK_URLS[adhanType]);
        console.log('Fallback adhan playing');
      } catch (fallbackErr) {
        console.error(`Fallback also failed: ${fallbackErr.message}`);
        return;
      }
    }

    audio.addEventListener('ended', () => {
      console.log('Adhan finished playing');
      audio = null;
    }, { once: true });
  })();
});

// Keep the document alive during playback
setInterval(() => {}, 1000);
