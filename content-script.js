function getPrayerTimesFromPage() {
  let times = {};
  // Find the prayer time table – customize these selectors if site HTML changes
  const table = document.querySelector('table');
  if (table) {
    // Try to match exact French names and time cells
    Array.from(table.querySelectorAll('tr')).forEach(row => {
      let cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        let name = cells[0].textContent.trim();
        let time = cells[1].textContent.trim();
        switch (name.toLowerCase()) {
          case "fajr": times.Fajr = time; break;
          case "dhuhr": times.Dhuhr = time; break;
          case "asr": times.Asr = time; break;
          case "maghrib": times.Maghrib = time; break;
          case "isha": times.Isha = time; break;
        }
      }
    });
    if (Object.keys(times).length >= 5) {
      chrome.storage.local.set({ prayerTimes: times });
      chrome.runtime.sendMessage({ type: "setFetchedTimes", times: times });
    }
  }
}
getPrayerTimesFromPage();
