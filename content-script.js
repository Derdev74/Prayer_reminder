// Content script to extract prayer times from CCML website
(function() {
  console.log('CCML Prayer Times Extractor running...');
  
  // Wait for dynamic content to load, then extract
  setTimeout(() => {
    extractAndSaveTimes();
  }, 2000);
  
  // Also try immediately
  extractAndSaveTimes();
  
  function extractAndSaveTimes() {
    const times = extractPrayerTimes();
    
    if (Object.keys(times).length === 5) {
      console.log('✓ Successfully extracted all prayer times:', times);
      
      // Save to storage
      chrome.storage.local.set({ 
        prayerTimes: times,
        lastFetch: new Date().toISOString(),
        source: 'content-script'
      }, () => {
        console.log('Prayer times saved to storage');
        
        // Send to background script
        chrome.runtime.sendMessage({
          type: 'setFetchedTimes',
          times: times
        }).catch(err => {
          console.log('Could not send message to background:', err);
        });
      });
    } else {
      console.error('Could not extract all prayer times. Found:', times);
      
      // Retry after a delay if we didn't get all times
      if (Object.keys(times).length < 5) {
        console.log('Retrying extraction in 3 seconds...');
        setTimeout(extractAndSaveTimes, 3000);
      }
    }
  }
  
 function extractPrayerTimes() {
  const times = {};
  
  // Get today's date
  const today = new Date();
  const todayDate = today.getDate();
  
  console.log(`Looking for prayer times for date: ${todayDate}`);
  
  // Find all tables
  const tables = document.querySelectorAll('table');
  
  for (let table of tables) {
    const rows = table.querySelectorAll('tr');
    
    // Look for a row containing today's date
    for (let row of rows) {
      const cells = row.querySelectorAll('td');
      
      // Check if this row contains today's date in the first few cells
      let dateFound = false;
      for (let i = 0; i < Math.min(3, cells.length); i++) {
        const cellText = cells[i]?.innerText?.trim() || '';
        // Check if cell contains just the date number
        if (cellText === String(todayDate) || cellText.includes(String(todayDate))) {
          dateFound = true;
          break;
        }
      }
      
      if (dateFound && cells.length >= 9) {
        console.log('Found today\'s row with', cells.length, 'cells');
        
        // Extract times from known positions
        // Format: Day | Date | Islamic Date | Fajr | Sunrise | Dhuhr | Asr | Maghrib | Isha
        const extractTime = (cell) => {
          const text = cell?.innerText?.trim() || '';
          // Handle both HH:MM and HHhMM formats
          return text.replace(/h/gi, ':').replace(/\s/g, '');
        };
        
        times.Fajr = extractTime(cells[3]);
        // Skip sunrise at index 4
        times.Dhuhr = extractTime(cells[5]);
        times.Asr = extractTime(cells[6]);
        times.Maghrib = extractTime(cells[7]);
        times.Isha = extractTime(cells[8]);
        
        // Validate extracted times
        const timeRegex = /^\d{1,2}:\d{2}$/;
        const allValid = Object.values(times).every(time => timeRegex.test(time));
        
        if (allValid) {
          console.log('Successfully extracted all times:', times);
          return times;
        } else {
          console.log('Invalid time format detected, trying next row');
          // Reset and continue searching
          Object.keys(times).forEach(key => delete times[key]);
        }
      }
    }
  }
  
  // Fallback: Try to find times in text format if table extraction failed
  if (Object.keys(times).length < 5) {
    console.log('Table extraction failed, trying text extraction...');
    
    const pageText = document.body.innerText || '';
    const lines = pageText.split('\n');
    
    // Look for lines containing today's date and times
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes(String(todayDate))) {
        // Check this line and next few lines for time patterns
        const searchText = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
        const timeMatches = searchText.match(/\d{1,2}[h:]\d{2}/g);
        
        if (timeMatches && timeMatches.length >= 6) {
          // Normalize times
          const normalizedTimes = timeMatches.map(t => t.replace(/h/gi, ':'));
          
          times.Fajr = normalizedTimes[0];
          times.Dhuhr = normalizedTimes[2]; // Skip sunrise
          times.Asr = normalizedTimes[3];
          times.Maghrib = normalizedTimes[4];
          times.Isha = normalizedTimes[5];
          
          console.log('Extracted from text:', times);
          break;
        }
      }
    }
  }
  
  return times;
}
})();