// Content script to extract prayer times from CCML website
(function() {
  console.log('CCML Prayer Times Extractor running...');

  // The CCML website uses JavaScript to dynamically generate prayer times
  // We need to wait longer for the PrayTimes.js library to populate the table

  // Wait for dynamic content to load, then extract
  // Try at increasing intervals to ensure JS has executed
  setTimeout(() => {
    extractAndSaveTimes();
  }, 3000);

  setTimeout(() => {
    extractAndSaveTimes();
  }, 5000);

  // Also try immediately in case it loads fast
  extractAndSaveTimes();
  
  let extractionAttempts = 0;
  const MAX_ATTEMPTS = 10;

  function extractAndSaveTimes() {
    extractionAttempts++;

    if (extractionAttempts > MAX_ATTEMPTS) {
      console.error('Max extraction attempts reached. Giving up.');
      return;
    }

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
      console.log(`Attempt ${extractionAttempts}: Could not extract all prayer times. Found:`, times);

      // Only retry if we haven't reached max attempts
      if (extractionAttempts < MAX_ATTEMPTS) {
        console.log('Retrying extraction in 2 seconds...');
        setTimeout(extractAndSaveTimes, 2000);
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
  console.log(`Found ${tables.length} tables on the page`);

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const table = tables[tableIndex];
    const rows = table.querySelectorAll('tr');
    console.log(`Table ${tableIndex}: ${rows.length} rows`);

    // Look for a row containing today's date
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const cells = row.querySelectorAll('td');

      // Check if this row contains today's date in the first few cells
      let dateFound = false;
      let dateCellIndex = -1;
      for (let i = 0; i < Math.min(3, cells.length); i++) {
        const cellText = cells[i]?.innerText?.trim() || '';
        // Check if cell contains just the date number
        if (cellText === String(todayDate) || cellText.includes(String(todayDate))) {
          dateFound = true;
          dateCellIndex = i;
          break;
        }
      }

      if (dateFound && cells.length >= 8) {
        console.log(`Found today's row (table ${tableIndex}, row ${rowIndex}) with ${cells.length} cells. Date at cell ${dateCellIndex}`);

        // Extract times from known positions
        // Format: Day | Date | Islamic Date | Fajr | Sunrise | Dhuhr | Asr | Maghrib | Isha
        const extractTime = (cell, index) => {
          const text = cell?.innerText?.trim() || '';
          console.log(`Cell ${index}: "${text}"`);
          // Handle both HH:MM and HHhMM formats
          return text.replace(/h/gi, ':').replace(/\s/g, '');
        };

        times.Fajr = extractTime(cells[3], 3);
        // Skip sunrise at index 4
        times.Dhuhr = extractTime(cells[5], 5);
        times.Asr = extractTime(cells[6], 6);
        times.Maghrib = extractTime(cells[7], 7);
        times.Isha = extractTime(cells[8], 8);

        // Validate extracted times
        const timeRegex = /^\d{1,2}:\d{2}$/;
        const allValid = Object.values(times).every(time => timeRegex.test(time));

        if (allValid) {
          console.log('✓ Successfully extracted all times with valid format:', times);
          return times;
        } else {
          console.log('⚠ Invalid time format detected. Extracted:', times);
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