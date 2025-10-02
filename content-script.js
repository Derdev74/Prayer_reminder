// Content script to extract prayer times from CCML website
(function() {
  console.log('CCML Prayer Times Extractor running...');
  
  // Wait for dynamic content to load
  setTimeout(() => {
    extractAndSaveTimes();
  }, 2000);
  
  // Also try immediately
  extractAndSaveTimes();
  function extractAndSaveTimes() {
    const times = extractPrayerTimes();
    
    if (Object.keys(times).length > 0) {
      console.log('Extracted prayer times:', times);
      
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
      console.error('Could not extract prayer times from page');
      console.log('Debugging info:');
      console.log('- Page URL:', window.location.href);
      console.log('- Page title:', document.title);
      
      // Try to find any elements that might contain times
      const timePatterns = /\d{1,2}[:h]\d{2}/g;
      const possibleTimes = document.body.innerText.match(timePatterns);
      if (possibleTimes) {
        console.log('Found possible times on page:', possibleTimes);
      }
      
      // Check for iframes that might contain the data
      const iframes = document.querySelectorAll('iframe');
      console.log('Number of iframes:', iframes.length);
      
      // Check for dynamic loading indicators
      const scripts = document.querySelectorAll('script');
      let hasReact = false, hasVue = false, hasAngular = false;
      scripts.forEach(script => {
        const src = script.src || '';
        if (src.includes('react') || document.querySelector('[data-reactroot]')) hasReact = true;
        if (src.includes('vue') || window.Vue) hasVue = true;
        if (src.includes('angular') || document.querySelector('[ng-app]')) hasAngular = true;
      });
      
      if (hasReact || hasVue || hasAngular) {
        console.log('Page uses dynamic framework:', { hasReact, hasVue, hasAngular });
        console.log('Content might be loaded dynamically. Retrying in 3 seconds...');
        setTimeout(extractAndSaveTimes, 3000);
      }
    }
  }
    const times = {};
    
    // Method 1: Try to find times in table format
    const tables = document.querySelectorAll('table');
    
    for (let table of tables) {
      const rows = table.querySelectorAll('tr');
      
      for (let row of rows) {
        const cells = row.querySelectorAll('td');
        
        if (cells.length >= 2) {
          const nameCell = cells[0].textContent.trim().toLowerCase();
          const timeCell = cells[1].textContent.trim();
          
          // Match prayer names in various formats
          if (nameCell.includes('fajr') || nameCell.includes('sobh')) {
            times.Fajr = timeCell.match(/\d{1,2}:\d{2}/)?.[0] || timeCell;
          } else if (nameCell.includes('dhuhr') || nameCell.includes('dohr') || nameCell.includes('zuhr')) {
            times.Dhuhr = timeCell.match(/\d{1,2}:\d{2}/)?.[0] || timeCell;
          } else if (nameCell.includes('asr')) {
            times.Asr = timeCell.match(/\d{1,2}:\d{2}/)?.[0] || timeCell;
          } else if (nameCell.includes('maghrib') || nameCell.includes('maghreb')) {
            times.Maghrib = timeCell.match(/\d{1,2}:\d{2}/)?.[0] || timeCell;
          } else if (nameCell.includes('isha') || nameCell.includes('icha')) {
            times.Isha = timeCell.match(/\d{1,2}:\d{2}/)?.[0] || timeCell;
          }
        }
      }
    }
    
    // Method 2: Try to find times using regex on entire page
    if (Object.keys(times).length < 5) {
      const bodyText = document.body.innerText || document.body.textContent;
      
      const patterns = {
        Fajr: /(?:fajr|sobh)[^\d]*(\d{1,2}:\d{2})/i,
        Dhuhr: /(?:dhuhr|dohr|zuhr)[^\d]*(\d{1,2}:\d{2})/i,
        Asr: /asr[^\d]*(\d{1,2}:\d{2})/i,
        Maghrib: /(?:maghrib|maghreb)[^\d]*(\d{1,2}:\d{2})/i,
        Isha: /(?:isha|icha)[^\d]*(\d{1,2}:\d{2})/i
      };
      
      for (let [prayer, pattern] of Object.entries(patterns)) {
        if (!times[prayer]) {
          const match = bodyText.match(pattern);
          if (match && match[1]) {
            times[prayer] = match[1];
          }
        }
      }
    }
    
    // Method 3: Look for divs or spans with prayer times
    if (Object.keys(times).length < 5) {
      const allElements = document.querySelectorAll('div, span, p, td');
      
      const prayerNames = {
        'fajr': 'Fajr',
        'sobh': 'Fajr',
        'dhuhr': 'Dhuhr',
        'dohr': 'Dhuhr',
        'zuhr': 'Dhuhr',
        'asr': 'Asr',
        'maghrib': 'Maghrib',
        'maghreb': 'Maghrib',
        'isha': 'Isha',
        'icha': 'Isha'
      };
      
      allElements.forEach(element => {
        const text = element.textContent.toLowerCase();
        for (let [key, prayer] of Object.entries(prayerNames)) {
          if (text.includes(key) && !times[prayer]) {
            // Look for time in the same element or next sibling
            const timeMatch = element.textContent.match(/\d{1,2}:\d{2}/);
            if (timeMatch) {
              times[prayer] = timeMatch[0];
            } else if (element.nextElementSibling) {
              const nextMatch = element.nextElementSibling.textContent.match(/\d{1,2}:\d{2}/);
              if (nextMatch) {
                times[prayer] = nextMatch[0];
              }
            }
          }
        }
      });
    }
    
    return times;
  }
  
  // Extract times
  const extractedTimes = extractPrayerTimes();
  console.log('Extracted prayer times:', extractedTimes);
  
  // Save to storage if we found prayer times
  if (Object.keys(extractedTimes).length > 0) {
    chrome.storage.local.set({ 
      prayerTimes: extractedTimes,
      lastFetch: new Date().toISOString()
    }, () => {
      console.log('Prayer times saved to storage');
      
      // Also send to background script
      chrome.runtime.sendMessage({
        type: 'setFetchedTimes',
        times: extractedTimes
      }).catch(err => {
        // Message might fail if popup is closed, that's okay
        console.log('Could not send message to background:', err);
      });
    });
  } else {
    console.error('Could not extract prayer times from page');
    
    // Try alternative extraction for debugging
    console.log('Page title:', document.title);
    console.log('Number of tables found:', document.querySelectorAll('table').length);
    console.log('Sample of page text:', document.body.innerText.substring(0, 500));
  }
})();