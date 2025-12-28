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
  fajr: 'https://www.islamcan.com/audio/adhan/azan1.mp3',
  regular: 'https://www.islamcan.com/audio/adhan/azan1.mp3'
};

let audio = null;

// Listen for messages to play audio
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Offscreen received message:', request);

  if (request.type === 'playAdhan') {
    const prayerName = request.prayerName || 'regular';
    const isFajr = prayerName.toLowerCase() === 'fajr';
    const adhanType = isFajr ? 'fajr' : 'regular';

    console.log(`Playing ${adhanType} adhan for ${prayerName} prayer`);

    try {
      // Stop any currently playing audio
      if (audio) {
        audio.pause();
        audio = null;
      }

      // Create new audio instance with appropriate adhan
      audio = new Audio(ADHAN_URLS[adhanType]);
      audio.volume = 0.7;

      // If primary URL fails, try fallback
      audio.onerror = (e) => {
        console.error('Primary adhan URL failed:', e);
        console.log('Trying fallback URL...');
        audio = new Audio(FALLBACK_URLS[adhanType]);
        audio.volume = 0.7;
        audio.play()
          .then(() => console.log('Fallback audio playing'))
          .catch(err => console.error('Fallback audio also failed:', err));
      };

      // Play audio
      audio.play()
        .then(() => {
          console.log(`${adhanType} adhan started playing successfully`);
          sendResponse({ status: 'playing', adhanType });
        })
        .catch(error => {
          console.error('Error playing adhan:', error);
          sendResponse({ status: 'error', error: error.message });
        });

      // Clean up when finished
      audio.addEventListener('ended', () => {
        console.log('Adhan finished playing');
        audio = null;
      });
    } catch (error) {
      console.error('Exception in playAdhan handler:', error);
      sendResponse({ status: 'error', error: error.message });
    }

    return true; // Keep message channel open for async response
  }
});

// Keep the document alive during playback
setInterval(() => {
  // Heartbeat to keep document active during playback
}, 1000);
