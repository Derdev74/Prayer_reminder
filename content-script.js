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
    
    // CCML uses a calendar table with prayer times
    // Header: ['Date', 'Islamic Date', 'Fadjr', 'Lever du soleil', 'Dhohr', 'Asr', 'Maghrib', 'Icha']
    // Columns 3-8 contain: Fadjr, Sunrise, Dhohr, Asr, Maghrib, Icha
    
    const tables = document.querySelectorAll('table');
    console.log('Found', tables.length, 'tables on page');
    
    for (let table of tables) {
      const rows = table.querySelectorAll('tr');
      
      // Find header row with prayer names
      let headerRow = null;
      let headerIndex = -1;
      
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td, th');
        const rowText = rows[i].innerText || rows[i].textContent || '';
        
        // Check if this row contains prayer column headers
        if (rowText.includes('Fadjr') && rowText.includes('Dhohr') && rowText.includes('Maghrib')) {
          headerRow = rows[i];
          headerIndex = i;
          console.log('Found header row at index', i);
          
          // Map column indices for each prayer
          const columnMap = {};
          cells.forEach((cell, idx) => {
            const text = cell.innerText.trim();
            if (text === 'Fadjr') columnMap.Fajr = idx;
            else if (text === 'Dhohr') columnMap.Dhuhr = idx;
            else if (text === 'Asr') columnMap.Asr = idx;
            else if (text === 'Maghrib') columnMap.Maghrib = idx;
            else if (text === 'Icha') columnMap.Isha = idx;
          });
          
          console.log('Column mapping:', columnMap);
          
          // Get today's date
          const today = new Date();
          const todayDate = today.getDate();
          const todayMonth = today.toLocaleDateString('fr-FR', { month: 'long' });
          
          console.log(`Looking for today's date: ${todayDate} ${todayMonth}`);
          
          // Find today's row or use the first data row
          let targetRow = null;
          
          // First, try to find today's date
          for (let j = headerIndex + 1; j < rows.length; j++) {
            const cells = rows[j].querySelectorAll('td');
            if (cells.length >= 9) { // Must have enough columns
              const dateCell = cells[1]; // Date is usually in column 1
              const dateText = dateCell ? dateCell.innerText.trim() : '';
              
              if (dateText === String(todayDate)) {
                targetRow = rows[j];
                console.log(`Found today's row (${todayDate}):`, targetRow.innerText);
                break;
              }
            }
          }
          
          // If we couldn't find today, use the first data row (tomorrow's times are better than none)
          if (!targetRow && rows[headerIndex + 1]) {
            targetRow = rows[headerIndex + 1];
            console.log('Using first data row as fallback:', targetRow.innerText);
          }
          
          // Extract times from the target row - using fixed column positions
          if (targetRow) {
            const cells = targetRow.querySelectorAll('td');
            
            // CCML table has fixed structure: Day, Date, Islamic Date, Fadjr, Sunrise, Dhohr, Asr, Maghrib, Icha
            if (cells.length >= 9) {
              times.Fajr = cells[3].innerText.trim().replace('h', ':');
              times.Dhuhr = cells[5].innerText.trim().replace('h', ':');
              times.Asr = cells[6].innerText.trim().replace('h', ':');
              times.Maghrib = cells[7].innerText.trim().replace('h', ':');
              times.Isha = cells[8].innerText.trim().replace('h', ':');
              
              console.log('Extracted times from row:', times);
            }
          
          // If we found times, we're done
          if (Object.keys(times).length === 5) {
            return times;
          }
        }
      }
    }
    
    // Fallback: Try regex extraction if table method failed
    if (Object.keys(times).length < 5) {
      console.log('Table extraction incomplete, trying regex method...');
      const pageText = document.body.innerText || document.body.textContent || '';
      
      // Look for today's date first
      const today = new Date();
      const todayDate = today.getDate();
      
      // Find the line/section with today's date and extract times
      const lines = pageText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if line contains today's date
        if (line.includes(String(todayDate))) {
          // This line or the next few lines might have the times
          const nearbyText = lines.slice(i, i + 3).join(' ');
          const timeMatches = nearbyText.match(/\d{1,2}[:h]\d{2}/g);
          
          if (timeMatches && timeMatches.length >= 6) {
            // Assuming order: Fadjr, Sunrise, Dhohr, Asr, Maghrib, Icha
            times.Fajr = timeMatches[0].replace('h', ':');
            times.Dhuhr = timeMatches[2].replace('h', ':'); // Skip sunrise
            times.Asr = timeMatches[3].replace('h', ':');
            times.Maghrib = timeMatches[4].replace('h', ':');
            times.Isha = timeMatches[5].replace('h', ':');
            
            console.log('Extracted times from date line:', times);
            break;
          }
        }
      }
    }
    
    return times;
  }
  
  // Also listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'extractTimes') {
      const times = extractPrayerTimes();
      sendResponse({ times: times });
    }
  });
})();