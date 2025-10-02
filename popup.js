document.addEventListener("DOMContentLoaded", () => {
  const timesList = document.getElementById("times-list");
  function showTimes(times) {
    timesList.innerHTML = Object.entries(times || {}).map(
      ([name, time]) => `<li>${name}: ${time}</li>`
    ).join("");
    // Fill editors
    ["Fajr","Dhuhr","Asr","Maghrib","Isha"].forEach(prayer => {
      document.getElementById(prayer).value = times[prayer] || "";
    });
  }
  chrome.storage.local.get("prayerTimes", (data) => showTimes(data.prayerTimes));

  document.getElementById("edit-times").onsubmit = (e) => {
    e.preventDefault();
    let newTimes = {};
    ["Fajr","Dhuhr","Asr","Maghrib","Isha"].forEach(
      prayer => newTimes[prayer] = document.getElementById(prayer).value
    );
    chrome.runtime.sendMessage({type: "saveTimes", times: newTimes});
    showTimes(newTimes);
  };

  document.getElementById("refresh-btn").onclick = () => {
    chrome.runtime.getBackgroundPage((bg) => {
      bg.fetchPrayerTimes();
      setTimeout(() =>
        chrome.storage.local.get("prayerTimes", (data) => showTimes(data.prayerTimes)), 2000
      );
    });
  };
});
