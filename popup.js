document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const onboardingView = document.getElementById("onboarding-view");
  const mainView = document.getElementById("main-view");
  const currentMosqueName = document.getElementById("current-mosque-name");
  const timesList = document.getElementById("times-list");
  const lastUpdated = document.getElementById("last-updated");
  const searchInput = document.getElementById("mosque-search");
  const searchBtn = document.getElementById("search-btn");
  const searchLoading = document.getElementById("search-loading");
  const searchResults = document.getElementById("search-results");
  const statusMessage = document.getElementById("status-message");
  const useLocationLink = document.getElementById("use-location-link");
  const refreshBtn = document.getElementById("refresh-btn");
  const changeMosqueBtn = document.getElementById("change-mosque-btn");

  // Initialize view based on stored mosque
  await initializeView();

  // Event Listeners
  searchBtn.addEventListener("click", handleSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });
  useLocationLink.addEventListener("click", handleLocationSearch);
  refreshBtn.addEventListener("click", handleRefresh);
  changeMosqueBtn.addEventListener("click", showOnboarding);

  // Initialize the view based on whether a mosque is selected
  async function initializeView() {
    try {
      const data = await chrome.storage.local.get(["selectedMosque", "prayerTimes", "lastFetch"]);

      if (data.selectedMosque && data.selectedMosque.name) {
        showMainView(data.selectedMosque, data.prayerTimes, data.lastFetch);
      } else {
        showOnboarding();
      }
    } catch (error) {
      console.error("Error initializing view:", error);
      showOnboarding();
    }
  }

  // Show onboarding/search view
  function showOnboarding() {
    onboardingView.style.display = "block";
    mainView.style.display = "none";
    currentMosqueName.textContent = "Select a mosque to get started";
    searchResults.style.display = "none";
    searchResults.innerHTML = "";
    statusMessage.innerHTML = "";
    searchInput.value = "";
  }

  // Show main view with prayer times
  function showMainView(mosque, prayerTimes, lastFetch) {
    onboardingView.style.display = "none";
    mainView.style.display = "block";
    currentMosqueName.textContent = mosque.name;

    displayPrayerTimes(prayerTimes);

    if (lastFetch) {
      const date = new Date(lastFetch);
      lastUpdated.textContent = `Last updated: ${date.toLocaleString()}`;
    }
  }

  // Display prayer times in list
  function displayPrayerTimes(times) {
    const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    times = times || {};

    timesList.innerHTML = prayers
      .map(prayer => `<li><strong>${prayer}:</strong> <span>${times[prayer] || "Not set"}</span></li>`)
      .join("");
  }

  // Handle mosque search by name
  async function handleSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      showStatus("Please enter at least 2 characters", "error");
      return;
    }

    setLoading(true);
    clearStatus();

    try {
      const response = await chrome.runtime.sendMessage({
        type: "searchMosques",
        query: query
      });

      if (response.status === "ok" && response.mosques) {
        displaySearchResults(response.mosques);
      } else {
        showStatus(response.error || "Search failed. Please try again.", "error");
      }
    } catch (error) {
      console.error("Search error:", error);
      showStatus("Search failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Handle location-based search
  async function handleLocationSearch(e) {
    e.preventDefault();
    setLoading(true);
    clearStatus();
    showStatus("Requesting location access...", "info");

    try {
      // Get user's location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes cache
        });
      });

      const { latitude, longitude } = position.coords;
      showStatus("Finding nearby mosques...", "info");

      const response = await chrome.runtime.sendMessage({
        type: "searchByLocation",
        lat: latitude,
        lon: longitude
      });

      if (response.status === "ok" && response.mosques) {
        displaySearchResults(response.mosques, true);
        clearStatus();
      } else {
        showStatus(response.error || "Could not find nearby mosques.", "error");
      }
    } catch (error) {
      console.error("Location search error:", error);
      if (error.code === 1) {
        showStatus("Location access denied. Please search by name instead.", "error");
      } else if (error.code === 2) {
        showStatus("Could not determine location. Please search by name.", "error");
      } else if (error.code === 3) {
        showStatus("Location request timed out. Please try again.", "error");
      } else {
        showStatus("Location search failed. Please search by name.", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  // Display search results
  function displaySearchResults(mosques, showDistance = false) {
    if (!mosques || mosques.length === 0) {
      showStatus("No mosques found. Try a different search term.", "info");
      searchResults.style.display = "none";
      return;
    }

    searchResults.style.display = "block";
    searchResults.innerHTML = mosques.map(mosque => {
      const distanceHtml = showDistance && mosque.proximity
        ? `<div class="distance">${formatDistance(mosque.proximity)} away</div>`
        : "";

      return `
        <div class="mosque-item" data-mosque='${JSON.stringify(mosque).replace(/'/g, "&#39;")}'>
          <div class="name">${escapeHtml(mosque.name)}</div>
          <div class="address">${escapeHtml(mosque.address || "")}</div>
          ${distanceHtml}
        </div>
      `;
    }).join("");

    // Add click handlers to mosque items
    searchResults.querySelectorAll(".mosque-item").forEach(item => {
      item.addEventListener("click", () => {
        const mosque = JSON.parse(item.dataset.mosque);
        selectMosque(mosque);
      });
    });
  }

  // Select a mosque
  async function selectMosque(mosque) {
    setLoading(true);
    showStatus("Setting up your mosque...", "info");

    try {
      const response = await chrome.runtime.sendMessage({
        type: "selectMosque",
        mosque: mosque
      });

      if (response.status === "ok") {
        showMainView(mosque, mosque.prayerTimes, new Date().toISOString());
        showStatus("Mosque selected successfully!", "success");
        setTimeout(clearStatus, 2000);
      } else {
        showStatus("Failed to select mosque. Please try again.", "error");
      }
    } catch (error) {
      console.error("Select mosque error:", error);
      showStatus("Failed to select mosque. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Refresh prayer times
  async function handleRefresh() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";

    try {
      const response = await chrome.runtime.sendMessage({ type: "fetchNow" });

      if (response.status === "ok" && response.times) {
        displayPrayerTimes(response.times);
        lastUpdated.textContent = `Last updated: ${new Date().toLocaleString()}`;
        refreshBtn.textContent = "Updated!";
      } else {
        refreshBtn.textContent = "Refresh Failed";
      }
    } catch (error) {
      console.error("Refresh error:", error);
      refreshBtn.textContent = "Refresh Failed";
    }

    setTimeout(() => {
      refreshBtn.textContent = "Refresh Prayer Times";
      refreshBtn.disabled = false;
    }, 2000);
  }

  // Helper: Set loading state
  function setLoading(loading) {
    searchLoading.style.display = loading ? "block" : "none";
    searchBtn.disabled = loading;
  }

  // Helper: Show status message
  function showStatus(message, type) {
    statusMessage.innerHTML = `<div class="status-message ${type}">${message}</div>`;
  }

  // Helper: Clear status message
  function clearStatus() {
    statusMessage.innerHTML = "";
  }

  // Helper: Format distance
  function formatDistance(meters) {
    if (!meters) return "";
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  // Helper: Escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
