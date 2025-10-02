// Test script to run directly in browser console on CCML prayer times page
// Go to: https://www.ccmgl.ch/fr/cultes/horaire-des-prières
// Open DevTools (F12) > Console
// Paste and run this code

console.log('=== CCML Prayer Times Extraction Test ===');

// The prayer names as they appear on CCML website
const ccmlPrayerNames = {
  'Fadjr': 'Fajr',
  'Dhohr': 'Dhuhr',
  'Asr': 'Asr',
  'Maghrib': 'Maghrib',
  'Icha': 'Isha'
};

const times = {};
const pageText = document.body.innerText || document.body.textContent || '';

console.log('Page contains:', pageText.length, 'characters');

// Method 1: Direct pattern matching with French names
console.log('\n--- Method 1: Direct Pattern Matching ---');
for (const [frenchName, englishName] of Object.entries(ccmlPrayerNames)) {
  // Try multiple patterns
  const patterns = [
    new RegExp(frenchName + '\\s*:?\\s*(\\d{1,2}[:h]\\d{2})', 'i'),
    new RegExp(frenchName + '[^0-9]*(\\d{1,2}[:h]\\d{2})', 'i'),
    new RegExp(frenchName + '.*?(\\d{1,2}[:h]\\d{2})', 'i')
  ];
  
  for (const pattern of patterns) {
    const match = pageText.match(pattern);
    if (match && match[1]) {
      times[englishName] = match[1].replace('h', ':');
      console.log(`✓ Found ${englishName} (${frenchName}):`, times[englishName]);
      break;
    }
  }
  
  if (!times[englishName]) {
    console.log(`✗ Could not find ${englishName} (${frenchName})`);
  }
}

// Method 2: Find all times on page
console.log('\n--- Method 2: All Times Found on Page ---');
const allTimes = pageText.match(/\d{1,2}[:h]\d{2}/g);
if (allTimes) {
  console.log('Times found:', allTimes);
  
  // Try to associate with prayer names
  const prayerIndices = {};
  ['Fadjr', 'Lever du soleil', 'Dhohr', 'Asr', 'Maghrib', 'Icha'].forEach(prayer => {
    const index = pageText.indexOf(prayer);
    if (index !== -1) {
      prayerIndices[prayer] = index;
      console.log(`Prayer "${prayer}" found at position:`, index);
    }
  });
} else {
  console.log('No time patterns (HH:MM) found on page');
}

// Method 3: Check tables
console.log('\n--- Method 3: Table Analysis ---');
const tables = document.querySelectorAll('table');
console.log('Number of tables found:', tables.length);

tables.forEach((table, idx) => {
  console.log(`\nTable ${idx + 1}:`);
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (cells.length >= 2) {
      const cellTexts = cells.map(c => c.innerText.trim());
      console.log('  Row:', cellTexts);
      
      // Check if first cell is a prayer name
      const firstCell = cellTexts[0].toLowerCase();
      for (const [frenchName, englishName] of Object.entries(ccmlPrayerNames)) {
        if (firstCell.includes(frenchName.toLowerCase())) {
          // Look for time in subsequent cells
          for (let i = 1; i < cellTexts.length; i++) {
            const timeMatch = cellTexts[i].match(/\d{1,2}[:h]\d{2}/);
            if (timeMatch) {
              times[englishName] = timeMatch[0].replace('h', ':');
              console.log(`  ✓ Extracted ${englishName}:`, times[englishName]);
              break;
            }
          }
        }
      }
    }
  });
});

// Method 4: Check for prayer-related elements
console.log('\n--- Method 4: Prayer Elements ---');
const prayerElements = document.querySelectorAll(
  '[class*="prayer"], [class*="salat"], [class*="priere"], ' +
  '[id*="prayer"], [id*="salat"], [id*="priere"], ' +
  '[class*="horaire"], [id*="horaire"]'
);
console.log('Prayer-related elements found:', prayerElements.length);

prayerElements.forEach((el, idx) => {
  const text = el.innerText || el.textContent || '';
  if (text.match(/\d{1,2}[:h]\d{2}/)) {
    console.log(`Element ${idx + 1}:`, text.substring(0, 100) + '...');
  }
});

// Final results
console.log('\n=== FINAL EXTRACTION RESULTS ===');
if (Object.keys(times).length === 5) {
  console.log('✓ Successfully extracted all prayer times:');
  console.table(times);
} else {
  console.log('✗ Only extracted', Object.keys(times).length, 'out of 5 prayer times');
  if (Object.keys(times).length > 0) {
    console.log('Partial results:');
    console.table(times);
  }
  console.log('\nTry visiting the page and checking if:');
  console.log('1. Prayer times are visible on the page');
  console.log('2. Times are loaded dynamically (wait a few seconds)');
  console.log('3. You need to be logged in or accept cookies');
}

// Export for use in extension
if (Object.keys(times).length > 0) {
  console.log('\n--- Copy this to manually set in extension ---');
  console.log(JSON.stringify(times, null, 2));
}
