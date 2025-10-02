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
      const data = await chrome.storage.local.get(["prayerTimes", "lastFetch"]);
      showTimes(data.prayerTimes);
      
      // Show last fetch time if available
      if (data.lastFetch) {
        const lastFetch = new Date(data.lastFetch);
        const fetchInfo = document.createElement("p");
        fetchInfo.style.fontSize = "small";
        fetchInfo.style.color = "#666";
        fetchInfo.textContent = `Last updated: ${lastFetch.toLocaleString()}`;
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
  
  // Handle fetch from CCML website button
  fetchBtn.addEventListener("click", async () => {
    try {
      fetchBtn.disabled = true;
      fetchBtn.textContent = "Fetching...";
      
      // First, try to fetch directly via background script
      const response = await chrome.runtime.sendMessage({ type: "fetchNow" });
      
      if (response && response.status === "ok" && response.times) {
        showTimes(response.times);
        fetchBtn.textContent = "✓ Fetched Successfully!";
        
        setTimeout(() => {
          fetchBtn.textContent = "Fetch Times from CCML";
          fetchBtn.disabled = false;
        }, 2000);
      } else {
        // Fallback: Try to inject content script into CCML tab
        const tabs = await chrome.tabs.query({});
        const ccmlTab = tabs.find(tab =>
          tab.url && tab.url.includes("ccmgl.ch") && tab.url.includes("horaire")
        );
        
        if (ccmlTab) {
          // Inject content script
          await chrome.scripting.executeScript({
            target: { tabId: ccmlTab.id },
            files: ["content-script.js"]
          });
          
          // Wait for extraction and reload times
          setTimeout(async () => {
            await loadTimes();
            fetchBtn.textContent = "✓ Extracted from tab!";
            setTimeout(() => {
              fetchBtn.textContent = "Fetch Times from CCML Tab";
              fetchBtn.disabled = false;
            }, 2000);
          }, 2000);
        } else {
          // No CCML tab open, try direct fetch
          alert("Opening CCML website to fetch times...");
          chrome.tabs.create({
            url: "https://www.ccmgl.ch/fr/cultes/horaire-des-pri%C3%A8res",
            active: false
          }, (tab) => {
            setTimeout(async () => {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ["content-script.js"]
                });
                setTimeout(async () => {
                  await loadTimes();
                  chrome.tabs.remove(tab.id);
                }, 3000);
              } catch (err) {
                console.error("Error injecting script:", err);
              }
            }, 3000); // Wait for page to load
          });
          
          fetchBtn.textContent = "Fetch Times from CCML Tab";
          fetchBtn.disabled = false;
        }
      }
    } catch (error) {
      console.error("Error fetching times:", error);
      fetchBtn.textContent = "Error - Try Again";
      setTimeout(() => {
        fetchBtn.textContent = "Fetch Times from CCML Tab";
        fetchBtn.disabled = false;
      }, 2000);
    }
  });
});