document.addEventListener("DOMContentLoaded", async () => {
  const timesList = document.getElementById("times-list");
  const editForm = document.getElementById("edit-times");
  const fetchBtn = document.getElementById("fetch-btn");
  
  // Display prayer times in the popup
  function showTimes(times) {
    const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    times = times || {};
    
    // Ensure all prayers have a value (empty string if missing)
    prayers.forEach(prayer => {
      if (!times[prayer]) times[prayer] = "";
    });
    
    // Update the list display
    timesList.innerHTML = prayers
      .map(prayer => `<li><strong>${prayer}:</strong> ${times[prayer] || 'Not set'}</li>`)
      .join("");
    
    // Update form inputs
    prayers.forEach(prayer => {
      const input = document.getElementById(prayer);
      if (input) {
        input.value = times[prayer] || "";
      }
    });
  }
  
  // Load and display stored prayer times
  async function loadTimes() {
    try {
      const data = await chrome.storage.local.get(["prayerTimes", "lastFetch", "source"]);
      showTimes(data.prayerTimes);

      // Show last fetch time and source if available
      if (data.lastFetch) {
        const lastFetch = new Date(data.lastFetch);
        const fetchInfo = document.createElement("p");
        fetchInfo.style.fontSize = "small";
        fetchInfo.style.color = "#666";
        const source = data.source === 'mawaqit' ? ' (Mawaqit - Official CCML)' : '';
        fetchInfo.textContent = `Last updated: ${lastFetch.toLocaleString()}${source}`;
        timesList.parentElement.insertBefore(fetchInfo, timesList.nextSibling);
      }
    } catch (error) {
      console.error("Error loading times:", error);
      showTimes({});
    }
  }
  
  // Initial load
  await loadTimes();
  
  // Handle manual time entry form submission
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const newTimes = {};
    
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    let hasError = false;
    
    prayers.forEach(prayer => {
      const input = document.getElementById(prayer);
      const value = input.value.trim();
      
      if (value && !timeRegex.test(value)) {
        input.style.borderColor = "red";
        hasError = true;
      } else {
        input.style.borderColor = "";
        if (value) {
          newTimes[prayer] = value;
        }
      }
    });
    
    if (hasError) {
      alert("Please enter times in HH:MM format (e.g., 05:30, 13:45)");
      return;
    }
    
    if (Object.keys(newTimes).length === 0) {
      alert("Please enter at least one prayer time");
      return;
    }
    
    // Send to background script
    try {
      const response = await chrome.runtime.sendMessage({
        type: "saveTimes",
        times: newTimes
      });
      
      if (response && response.status === "ok") {
        showTimes(newTimes);
        
        // Show success message
        const successMsg = document.createElement("div");
        successMsg.style.color = "green";
        successMsg.style.padding = "5px";
        successMsg.textContent = "✓ Times saved and alarms scheduled!";
        editForm.appendChild(successMsg);
        
        setTimeout(() => {
          successMsg.remove();
        }, 3000);
      }
    } catch (error) {
      console.error("Error saving times:", error);
      alert("Error saving times. Please try again.");
    }
  });
  
  // Handle fetch from Mawaqit button
  fetchBtn.addEventListener("click", async () => {
    try {
      fetchBtn.disabled = true;
      fetchBtn.textContent = "Fetching from Mawaqit...";

      // Fetch directly via background script from Mawaqit
      const response = await chrome.runtime.sendMessage({ type: "fetchNow" });
      
      if (response && response.status === "ok" && response.times && Object.keys(response.times).length === 5) {
        showTimes(response.times);
        await chrome.storage.local.set({ 
          prayerTimes: response.times,
          lastFetch: new Date().toISOString()
        });
        fetchBtn.textContent = "✓ Fetched from Mawaqit!";

        setTimeout(() => {
          fetchBtn.textContent = "🔄 Fetch Times from Mawaqit";
          fetchBtn.disabled = false;
        }, 2000);
      } else {
        // If background fetch failed, show error
        fetchBtn.textContent = "Error - Try Again";
        setTimeout(() => {
          fetchBtn.textContent = "🔄 Fetch Times from Mawaqit";
          fetchBtn.disabled = false;
        }, 2000);
      }
    } catch (error) {
      console.error("Error fetching times:", error);
      fetchBtn.textContent = "Error - Try Again";
      setTimeout(() => {
        fetchBtn.textContent = "🔄 Fetch Times from Mawaqit";
        fetchBtn.disabled = false;
      }, 2000);
    }
  });
});