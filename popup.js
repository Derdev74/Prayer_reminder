document.addEventListener("DOMContentLoaded", () => {
  const timesList = document.getElementById("times-list");
  function showTimes(times) {
    times = times || {};
    ["Fajr","Dhuhr","Asr","Maghrib","Isha"].forEach(prayer => {
      if (!times[prayer]) times[prayer] = "";
    });
    timesList.innerHTML = Object.entries(times).map(
      ([name, time]) => `<li>${name}: ${time || '-'}</li>`
    ).join("");
    ["Fajr","Dhuhr","Asr","Maghrib","Isha"].forEach(prayer => {
      document.getElementById(prayer).value = times[prayer];
    });
  }
  chrome.storage.local.get("prayerTimes", (data) => showTimes(data.prayerTimes));

  document.getElementById("edit-times").onsubmit = (e) => {
    e.preventDefault();
    let newTimes = {};
    ["Fajr","Dhuhr","Asr","Maghrib","Isha"].forEach(
      prayer => newTimes[prayer] = document.getElementById(prayer).value
    );
    chrome.runtime.sendMessage({type: "saveTimes", times: newTimes}, () => {
      showTimes(newTimes);
    });
  };

document.getElementById("fetch-btn").onclick = async () => {
  let tabs = await chrome.tabs.query({});
  let ccmlTab = tabs.find(tab =>
    tab.url && tab.url.startsWith("https://www.ccmgl.ch/fr/cultes/horaire-des-pri%C3%A8res")
  );
  if (ccmlTab) {
    chrome.scripting.executeScript({
      target: {tabId: ccmlTab.id},
      files: ["content-script.js"]
    });
    setTimeout(() =>
      chrome.storage.local.get("prayerTimes", (data) => showTimes(data.prayerTimes)), 2000
    );
  } else {
    alert("Please open the CCML prayer times page in a tab first!");
  }
};
});
