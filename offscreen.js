// Offscreen document script for audio playback
console.log('Offscreen document loaded');

// Create audio element immediately
let audio = null;

// Listen for messages to play audio
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Offscreen received message:', request);

  if (request.type === 'playAdhan' && request.audioFile) {
    try {
      // Create new audio instance
      const audioUrl = chrome.runtime.getURL(request.audioFile);
      console.log('Attempting to play audio from:', audioUrl);

      audio = new Audio(audioUrl);
      audio.volume = 0.7;

      // If local file fails, use online backup
      audio.onerror = (e) => {
        console.error('Local adhan not found, error:', e);
        console.log('Trying online version...');
        audio = new Audio('https://www.islamcan.com/audio/adhan/azan1.mp3');
        audio.volume = 0.7;
        audio.play()
          .then(() => console.log('Online audio playing'))
          .catch(e => console.error('Online audio also failed:', e));
      };

      // Play audio
      audio.play()
        .then(() => {
          console.log('Adhan started playing successfully');
          sendResponse({ status: 'playing' });
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

// Keep the document alive
setInterval(() => {
  // Heartbeat to keep document active during playback
}, 1000);
