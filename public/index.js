import { initCustomDatePicker } from "./customDatePicker.js";

const globalLogLevel = "debug"; // "silent", "error", "warning", "info", "debug"
let mapChoicelatlng = null;
let userGeneratedData = {};
userGeneratedData.minutes_of_day = 0;
userGeneratedData.day_of_year = 0;
userGeneratedData.date = new Date();
userGeneratedData.temperature = 0;
userGeneratedData.humidity = 0;
userGeneratedData.pressure = 0;
userGeneratedData.windSpeed = 0;
userGeneratedData.lat = 0;
userGeneratedData.lon = 0;
userGeneratedData.locationName = "";
userGeneratedData.waterDistance = {
  inland_water: {
    closest_point: {
      lat: 0,
      lon: 0,
    },
    display_name: "",
  },
  coastal_water: {
    closest_point: {
      lat: 0,
      lon: 0,
    },
    display_name: "",
  },
};
customLog("debug", userGeneratedData);

const normalText = `
    <h3 id="popup-heading">Welcome: </h3>
    This platform uses predictive models to simulate how
    Australian ecosystems will respond to future climate scenarios.
    For a selected scenario, our model will produce birdsong
    and wildlife soundscapes reflecting the projected conditions.
    <p>Pan and zoom around the map to choose a location
    (it must be within Australia). Once at your desired location,
    long-press on the location
    to generate a location-specific simulation.
  `;

const driftText = `
  <h3 id="popup-heading">Welcome: </h3>
    This platform uses predictive models to simulate how
    Australian ecosystems will respond to future climate scenarios.
    For a selected scenario, our model will produce birdsong
    and wildlife soundscapes reflecting the projected conditions.
    
    <p>Drift Mode is currently active, providing a continuously
    changing simulated soundscape. To choose your own scenario,
    interact with the map:

    <p>Pan and zoom around the map to choose a location
    (it must be within Australia). Once at your desired location,
    long-press on the location
    to generate a location-specific simulation.
  `;
const generativeText = `
  <h3 id="popup-heading">Welcome: </h3>
  This platform uses predictive models to simulate how
  Australian ecosystems will respond to future climate scenarios.
  For a selected scenario, our model will produce birdsong
  and wildlife soundscapes reflecting the projected conditions.
  <p>Pan and zoom around the map to choose a location
    (it must be within Australia). Once at your desired location,
    long-press on the location
    to generate a location-specific simulation.
`;
let routingPrefix = "/generate";

let suppressGlobalEvents = false;

// Set this to true during development if you want the system to load in drift mode by default.
const DRIFT_MODE_DEFAULT = true;
// Key (e.g. "d") used to toggle modes.

// Current mode: either "normal" or "drift".
// 1) Enumerate modes
const MODES = {
  NORMAL: "normal",
  DRIFT: "drift",
  SILENT: "silent",
  GENERATIVE: "generative",
};
// 2) The current mode, default to something on load:
let currentMode = MODES.GENERATIVE; // or MODES.DRIFT if you prefer

// Custom log function to handle different log levels.
customLog("debug", "Current mode on start:", currentMode);

let huggingFaceServerStatus = "";

// Drift mode configuration
const driftConfig = {
  crossfade: 4, // seconds (fly-to and crossfade will run for 4 seconds)
  fileDuration: 23, // seconds (all files are 23 sec long, so crossfade starts at 18 sec)
  totalFiles: 1000,
  // This folder should be accessible via your web server (e.g. via a symlink) and contain files in subfolders:
  // drift_mp3s: contains files named "0001.mp3", "0002.mp3", etc.
  // drift_json: contains files named "0001.json", "0002.json", etc.
  folderPath: "/drift",
};

// Global variables for drift mode state.
let driftActive = false;
let startMode = "";
let playedFiles = new Set();
let currentPlayer = 0; // Index of the currently playing audio (0 or 1)
const driftAudio = [new Audio(), new Audio()];
driftAudio[0].volume = 1;
driftAudio[1].volume = 0;

// To keep track of scheduled timeouts/intervals.
let crossfadeTimeoutId = null;
let fadeIntervalId = null;

// To keep track of markers on the map.
let currentMarker = null;

let inactivityTimeout = 0;
let generativeTimeout = 0;

let hasTouch = false;

let silentStartHour = 22;
let silentEndHour = 7;
let silentStartMinute = 0;
let silentEndMinute = 0;

// const map = L.map("map", {center: [-25.2744, 133.7751], zoom: 4,});
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const map = L.map("map", { zoomControl: false }).setView([-24.801233, 132.94551], 5);
//lets diable all map interactions

map.fitBounds([
  [-10, 112],
  [-44, 154],
]);

//const tiles = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg", { attribution });
//const tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution });
const tiles = L.tileLayer(tileUrl, { attribution });
tileUrl;
tiles.addTo(map);

const modeHandlers = {
  [MODES.NORMAL]: {
    enter: () => {
      customLog("debug", "Entering NORMAL mode");
      document.body.classList.remove("drift-mode");

      // Show normal instructions
      showInstructionPopup("normal");

      // Start inactivity timer that leads to DRIFT if no user action
      resetInactivityTimeout();
    },
    exit: () => {
      customLog("debug", "Exiting NORMAL mode");
      // Hide normal instructions if needed
      hideInstructionPopup();
      // Clear inactivity so we don’t do partial timers
      clearInactivityTimeout();
      // (A) Close resultDiv if it’s open, so that switching to DRIFT doesn’t leave it.
      const resultDiv = document.getElementById("resultDiv");
      if (resultDiv) {
        resultDiv.remove();
        customLog("debug", "Closed resultDiv upon leaving NORMAL mode");
      }
    },
  },

  [MODES.DRIFT]: {
    enter: () => {
      customLog("debug", "Entering DRIFT mode");
      document.body.classList.add("drift-mode");
      startDriftMode(); // your existing function that triggers infinite crossfade, etc.
    },
    exit: () => {
      customLog("debug", "Exiting DRIFT mode");
      document.body.classList.remove("drift-mode");
      stopDriftMode(); // pause audio, remove drift markers
    },
  },

  [MODES.SILENT]: {
    enter: () => {
      customLog("debug", "Entering SILENT mode");
      showSilentModeOverlay(); // show a UI overlay telling users we’re in sleep mode
      // Stop or pause all audio
      pauseAllAudio(); // or driftAudio.forEach(a => { a.pause(); a.currentTime = 0; });
      //lets put the hugging face server to sleep - we need to wait for it to complete this function as it might take a while

      controlHuggingFaceServer("sleep");
    },
    exit: () => {
      customLog("debug", "Exiting SILENT mode");
      hideSilentModeOverlay();
    },
  },

  [MODES.GENERATIVE]: {
    enter: () => {
      customLog("debug", "Entering GENERATIVE mode");
      document.body.classList.remove("drift-mode");

      // Show “generative” instructions if you want
      showInstructionPopup("generative");
      resetGenerativeTimeout();

      // Important: do NOT set inactivity timers if you want it never to auto-switch
      // Possibly call some "startGenerativeProcess()" if you had specific code
      // But if generative mode is literally the same as normal minus inactivity,
      // you don't need the rest of normal’s logic. Just do your standard UI usage.
    },
    exit: () => {
      customLog("debug", "Exiting GENERATIVE mode");
      hideInstructionPopup();
      clearGenerativeTimeout();

      // If you had a startGenerativeProcess(), call endGenerativeProcess() here
    },
  },
};

function pauseAllAudio() {
  driftAudio.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

function switchMode(newMode) {
  customLog("debug", "Switching to mode:", newMode);

  const containerElement = document.getElementById("popup_bubble");
  if (containerElement) {
    while (containerElement.firstChild) {
      containerElement.removeChild(containerElement.firstChild);
    }
  }
  const generatedContentDiv = document.getElementById("resultDiv");
  if (generatedContentDiv) {
    generatedContentDiv.remove();
  }
  map.eachLayer(function (layer) {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  if (newMode === currentMode) return; // No change needed

  // 1) exit the old mode
  modeHandlers[currentMode].exit();

  // 2) update
  currentMode = newMode;

  // 3) enter the new mode
  modeHandlers[newMode].enter();
}

function showSilentModeOverlay() {
  // The time we actually switched to silent:
  const now = new Date();
  const wentSilentHour = now.getHours();
  const wentSilentMinute = now.getMinutes();

  // Convert them to display strings (24-hour format for example)
  const wentSilentDisplay = formatTime24(wentSilentHour, wentSilentMinute);
  const resumeDisplay = formatTime24(silentEndHour, silentEndMinute);

  const silentModeOverlay = document.createElement("div");
  silentModeOverlay.id = "silentModeOverlay";

  // You can style each <h2> on a separate line.
  // You can remove <br> tags if <h2> is block-level (they’ll appear on separate lines by default).
  silentModeOverlay.innerHTML = `
    <h3>Silent Mode</h3>
    <h3>Installation is sleeping</h3>
    <h3>Hugging face server is: ${huggingFaceServerStatus}</h3>
    <h3>Went silent at ${wentSilentDisplay}</h3>
    <h3>Will resume at ${resumeDisplay}</h3>
  `;

  document.body.appendChild(silentModeOverlay);
}
function formatTime24(hour, minute) {
  // Pad hours/minutes to two digits, e.g. "07:05"
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${hh}:${mm}`;
}
function hideSilentModeOverlay() {
  const overlay = document.getElementById("silentModeOverlay");
  if (overlay) overlay.remove();
}

document.addEventListener("DOMContentLoaded", async () => {
  customLog("debug", "DOMContentLoaded event fired");
  // Load the JSON file to get the settings
  const config = await loadConfig();
  if (config) {
    // If it has a "startMode" property, set currentMode
    startMode = config.startMode;
    currentMode = MODES[config.startMode?.toUpperCase()] || MODES.NORMAL;

    // If it has silentMode times, store them for your setInterval check
    silentStartHour = config.silentModeStartHour ?? 22;
    silentStartMinute = config.silentModeStartMinute ?? 0;
    silentEndHour = config.silentModeEndHour ?? 7;
    silentEndMinute = config.silentModeEndMinute ?? 0;

    customLog("debug", "Loaded config:", config, " => currentMode:", currentMode);
  } else {
    console.warn("No config loaded; using defaults");
  }

  huggingFaceServerStatus = await controlHuggingFaceServer("status");
  customLog("debug", "Hugging Face server status:", huggingFaceServerStatus);
  try {
    const style = document.createElement("style");
    style.innerHTML = `
      @font-face {
        font-family: "Univers";
        src: url("${routingPrefix}/fonts/Univers/UniversLight.ttf") format("truetype");
      }
    `;
    customLog("debug", "routing prefix", routingPrefix);
    document.head.appendChild(style);

    showPermissionOverlay();
    // Use the routingPrefix as needed in your client-side code
  } catch (error) {
    customLog("error", "Failed to fetch Routing Prefix:", error);
  }
});

setInterval(() => {
  const now = new Date();
  const nowTotal = minutesSinceMidnight(now.getHours(), now.getMinutes());

  const silentStartTotal = minutesSinceMidnight(silentStartHour, silentStartMinute);
  const silentEndTotal = minutesSinceMidnight(silentEndHour, silentEndMinute);

  let isSilentTime;
  if (silentStartTotal < silentEndTotal) {
    // same-day range (e.g., 08:00 → 14:00)
    isSilentTime = nowTotal >= silentStartTotal && nowTotal < silentEndTotal;
  } else {
    // crossing midnight (e.g., 22:30 → 07:15)
    isSilentTime = nowTotal >= silentStartTotal || nowTotal < silentEndTotal;
  }

  if (isSilentTime && currentMode !== MODES.SILENT) {
    switchMode(MODES.SILENT);
  } else if (!isSilentTime && currentMode === MODES.SILENT) {
    //we meed tot turn on the hugging face server before we move out of silent mode
    controlHuggingFaceServer("restart");
    // return to your preferred mode
    switchMode(MODES.NORMAL);
  }
}, 60_000);

function minutesSinceMidnight(hour, minute) {
  return hour * 60 + minute;
}
function showPermissionOverlay() {
  // overlayActive = true; // flag the overlay is active
  const overlay = document.createElement("div");
  overlay.id = "permissionOverlay";
  overlay.textContent = "CLICK / TOUCH";
  document.body.appendChild(overlay);

  const removeOverlay = (e) => {
    e.stopPropagation();
    overlay.remove();
    suppressGlobalEvents = true; // temporarily ignore global events
    setTimeout(() => {
      suppressGlobalEvents = false;
    }, 1000);

    customLog("debug", "Permission overlay removed. Current mode:", currentMode);
    //switchMode(currentMode);
    modeHandlers[currentMode].enter();
    customLog("debug", "SwitchMode call is done:", currentMode);
    if (currentMode === MODES.DRIFT) {
      //setTimeout(() => {
      //startDriftMode();
      driftAudio[0].load();
      driftAudio[1].load();
      // }, 800);
      hasTouch = detectTouchDevice();
      customLog("debug", "Starting drift mode from permission overlay.");
    }
  };
  if (hasTouch) {
    overlay.addEventListener("touchstart", removeOverlay, { once: true });
  } else {
    overlay.addEventListener("click", removeOverlay, { once: true });
  }
}

["mousemove", "mousedown", "touchstart", "touchend", "touchmove", "click"].forEach((evt) => {
  document.addEventListener(evt, (e) => {
    // Ignore events if the permission overlay is active or if we're currently suppressing global events.
    if (suppressGlobalEvents || (e.target && (e.target.id === "permissionOverlay" || e.target.closest("#permissionOverlay")))) {
      return;
    }

    if (currentMode === MODES.DRIFT) {
      switchMode(MODES.NORMAL);
    } else if (currentMode === MODES.NORMAL) {
      resetInactivityTimeout();
    } else if (currentMode === MODES.GENERATIVE) {
      resetGenerativeTimeout();
    }
  });
});

function resetInactivityTimeout() {
  clearTimeout(inactivityTimeout);
  // Always check if we are STILL in normal mode
  // If in normal mode after X ms, switch to drift.
  inactivityTimeout = setTimeout(() => {
    if (currentMode === MODES.NORMAL) {
      switchMode(MODES.DRIFT);
    }
  }, 180000); // 3 minutes
}

function clearInactivityTimeout() {
  clearTimeout(inactivityTimeout);
  inactivityTimeout = null;
}

function resetGenerativeTimeout() {
  clearTimeout(generativeTimeout);
  // After 3 minutes, close resultDiv (if open) & re-show instructions for generative
  generativeTimeout = setTimeout(() => {
    if (currentMode === MODES.GENERATIVE) {
      // Close resultDiv
      const resultDiv = document.getElementById("resultDiv");
      if (resultDiv) {
        resultDiv.remove();
        customLog("debug", "Closed resultDiv on generative inactivity");
      }
      // Re-show generative instructions
      showInstructionPopup("generative");
    }
  }, 180000);
}

function clearGenerativeTimeout() {
  clearTimeout(generativeTimeout);
  generativeTimeout = null;
}

function detectTouchDevice() {
  const hasTouchSupport = "ontouchstart" in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);

  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  if (hasTouchSupport || isCoarsePointer) {
    document.body.classList.add("touch-device");
    console.log("Touch device detected");
    return true;
  }
  console.log("Touch device not detected");
  return false;
}
async function loadConfig() {
  try {
    const response = await fetch(`${routingPrefix}/config.json`);
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error loading config:", error);
    return null;
  }
}

// In loadAndPlayNext(), after fetching and parsing the JSON:
async function loadAndPlayNext(playerIndex) {
  const fileNumber = getRandomFileNumber();
  const fileName = formatFileNumber(fileNumber);
  const audioUrl = `${routingPrefix}${driftConfig.folderPath}/drift_mp3s/${fileName}.mp3`;
  const jsonUrl = `${routingPrefix}${driftConfig.folderPath}/drift_json/${fileName}.json`;

  let marker;
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error(`Failed to load ${jsonUrl}`);
    const jsonData = await response.json();

    // Assume jsonData.dateName is in the format: "HH:MM:SS DayName DD Month YYYY"
    // Assume jsonData has been fetched and parsed.
    // Parse the dateName (format: "HH:MM:SS DayName DD Month YYYY")
    const dateParts = jsonData.dateName.split(" "); // e.g., ["08:00:00", "Monday", "11", "October", "2028"]
    const time24 = dateParts[0];
    const dayName = dateParts[1];
    const dateNumber = dateParts[2];
    const monthName = dateParts[3];
    const year = dateParts[4];
    const time12 = convertTimeTo12Hour(time24); // Use your existing helper
    if (year == "") {
      console.log("Year is empty: ", jsonData.dateName);
    }

    const shortDisplayName = wrapTextAtWhitespace(jsonData.display_name, 70); // Use your existing helper
    const items = [
      { title: "Location: ", text: shortDisplayName },
      { title: "Year: ", text: year },
      { title: "Date: ", text: `${dayName} ${monthName} ${dateNumber} ${time12}` },
      { title: "Temperature: ", text: jsonData.main.temp + "°C" },
      { title: "Humidity: ", text: Math.min(jsonData.main.humidity, 100) + "%" },
      { title: "Pressure: ", text: Math.min(jsonData.main.pressure, 1084) + "hPa" },
      { title: "Wind Speed: ", text: jsonData.wind.speed + "km/h" },
    ];

    // Create the popup container
    const flyoverMasterContainer = document.createElement("div");
    flyoverMasterContainer.className = "flyoverMasterContainer";

    // For each item, create a container with the appropriate classes.
    items.forEach((item) => {
      const compDiv = document.createElement("div");
      compDiv.className = "flyoverComponent";

      const componentTitle = document.createElement("div");
      componentTitle.className = "flyoverTitle";
      componentTitle.textContent = item.title;

      const componentText = document.createElement("div");
      componentText.className = "flyoverText";
      componentText.innerHTML = item.text;

      compDiv.appendChild(componentTitle);
      compDiv.appendChild(componentText);
      flyoverMasterContainer.appendChild(compDiv);
    });
    //lets get the window width and height
    const flyoverMaxWidth = window.innerWidth * 0.75;
    // Bind this popup to your marker (assuming you already have a marker variable)

    marker = L.marker([jsonData.coord.lat, jsonData.coord.lon], {
      autoClose: false,
      closeOnClick: false,
    }).bindPopup(flyoverMasterContainer, { minWidth: 0, maxWidth: flyoverMaxWidth });

    // Add the marker to the map (and don't call openPopup() if you want it to open later)
    marker.addTo(map);
  } catch (error) {
    console.error("Error loading JSON:", error);
    marker = null;
  }

  // Set the new audio source.
  driftAudio[playerIndex].src = audioUrl;
  driftAudio[playerIndex].load();

  try {
    // Start playback (for the current track, this will be audible; for the next track, volume is 0).
    await driftAudio[playerIndex].play();
  } catch (error) {
    console.error("Error playing audio:", error);
  }
  // lets print out the marker popup to the console so I can see all its css rules

  return marker;
}

function flyToWithOffset(latlng, zoom, flyDuration, panDuration) {
  return new Promise((resolve) => {
    // Start the flyTo animation.
    map.flyTo(latlng, zoom, { duration: flyDuration });
    // Wait for the flyTo to finish.
    map.once("moveend", () => {
      const size = map.getSize();
      // Desired container point: center horizontally, 90% down vertically.
      const desiredPoint = L.point(size.x * 0.4, size.y * 0.05);
      const markerPoint = map.latLngToContainerPoint(latlng);
      const offset = desiredPoint.subtract(markerPoint);
      // Pan the map by the calculated offset.
      map.panBy(offset, { animate: true, duration: panDuration });
      // Wait until the pan is complete.
      map.once("moveend", () => {
        resolve();
      });
    });
  });
}

function scheduleNext() {
  // Calculate when to start the crossfade.
  const crossfadeStartTime = (driftConfig.fileDuration - driftConfig.crossfade) * 1000;
  crossfadeTimeoutId = setTimeout(async () => {
    const nextPlayer = (currentPlayer + 1) % 2;
    // Load the next track and get its marker.
    const newMarker = await loadAndPlayNext(nextPlayer);

    // Close the popup of the current marker (if any) as soon as we start the transition.
    if (currentMarker) {
      currentMarker.closePopup();
    }

    // Start the map flyTo (with offset) and get a promise that resolves when complete.
    let flyPromise = null;
    if (newMarker) {
      flyPromise = flyToWithOffset(newMarker.getLatLng(), 11, driftConfig.crossfade - 1.5, 1.5);
    }

    // Start the audio crossfade concurrently.
    const fadeSteps = 20;
    const stepTime = (driftConfig.crossfade * 1000) / fadeSteps;
    let currentStep = 0;
    fadeIntervalId = setInterval(() => {
      currentStep++;
      // Fade out the current audio.
      driftAudio[currentPlayer].volume = Math.max(0, 1 - currentStep / fadeSteps);
      // Fade in the next audio.
      driftAudio[nextPlayer].volume = Math.min(1, currentStep / fadeSteps);
      if (currentStep >= fadeSteps) {
        clearInterval(fadeIntervalId);
        // Pause and reset the previous audio.
        driftAudio[currentPlayer].pause();
        driftAudio[currentPlayer].currentTime = 0;
        // Switch currentPlayer.
        currentPlayer = nextPlayer;
        // Schedule the next crossfade.
        scheduleNext();
      }
    }, stepTime);

    // Once the map movement is complete, remove the old marker and open the new marker's popup.
    if (flyPromise) {
      await flyPromise;
      if (currentMarker) {
        map.removeLayer(currentMarker);
      }
      currentMarker = newMarker;
      newMarker.openPopup();
    }
  }, crossfadeStartTime);
}

/**
 * Starts the drift mode loop.
 */
async function startDriftMode() {
  driftActive = true;

  // If the results div is present, remove it
  const resultDiv = document.getElementById("resultDiv");
  if (resultDiv) {
    resultDiv.remove();
    console.log("Results div removed");
  } else {
    console.log("Results div not found");
  }

  showInstructionPopup();

  currentPlayer = 0;
  // Load and start the first track, and store its marker.
  currentMarker = await loadAndPlayNext(currentPlayer);
  // Once the first marker is loaded, fly to it:
  if (currentMarker) {
    await flyToWithOffset(currentMarker.getLatLng(), 12, 1, 0.5);
    currentMarker.openPopup();
  }
  // Then schedule subsequent transitions.
  scheduleNext();
}

/**
 * Stops the drift mode loop.
 */
function stopDriftMode() {
  driftActive = false;
  document.body.classList.remove("drift-mode");
  customLog("debug", "Drift mode deactivated");
  if (crossfadeTimeoutId) clearTimeout(crossfadeTimeoutId);
  if (fadeIntervalId) clearInterval(fadeIntervalId);
  // Stop both audio players.
  driftAudio.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  // Optionally, remove any markers.
  if (currentMarker) {
    map.removeLayer(currentMarker);
    currentMarker = null;
  }
}

function showInstructionPopup() {
  console.log("showInstructionPopup called. Current mode:", currentMode);
  const instructionsPopup = document.getElementById("instructionPopup");
  if (!instructionsPopup) {
    console.error("Instruction popup not found.");
    return;
  }
  // Always update the innerHTML based on mode.
  if (currentMode === MODES.DRIFT) {
    instructionsPopup.innerHTML = driftText;
  } else if (currentMode === MODES.GENERATIVE) {
    instructionsPopup.innerHTML = generativeText;
  } else {
    instructionsPopup.innerHTML = normalText;
  }

  // Always add the 'visible' class when calling showInstructionPopup.
  instructionsPopup.classList.add("visible");
}

function hideInstructionPopup() {
  if (currentMode === "drift") return; // In drift mode, keep instructions visible.
  const instructionsPopup = document.getElementById("instructionPopup");
  if (instructionsPopup) {
    instructionsPopup.classList.remove("visible");
  }
}

// Function to perform reverse geocoding
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  try {
    const response = await fetch(url);
    const reverseGeocodeData = await response.json();
    //add the data to the userGeneratedData object
    customLog("debug", "reverseGeocode results: " + JSON.stringify(reverseGeocodeData, null, 2));
    return reverseGeocodeData.display_name;
  } catch (error) {
    console.error("Error fetching location name:", error);
    return "Unknown location";
  }
}

function constructHistoricalDate() {
  //make a new date object from the user data
  let historicalDate = userGeneratedData.date;
  //set the year to the current year minus 1
  historicalDate.setFullYear(new Date().getFullYear() - 1);

  // //log the date bfeore it is formamted
  customLog("debug", "preformated historical date: " + historicalDate);
  //convert the date to a unix timestamp in seconds
  let formattedDate = historicalDate.getTime() / 1000;
  //remove any decimal places from the formatted date
  formattedDate = Math.floor(formattedDate);
  customLog("debug", "Historical date unix timestamp: " + formattedDate);

  return formattedDate;
}

async function getWaterDistanceData(lat, lon) {
  const url = routingPrefix + "/waterdistance"; // Relative URL for your Node.js server endpoint

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lat, lon }),
    });
    const data = await response.json();
    //add the data to the userGeneratedData object
    userGeneratedData.waterDistance = data;
    customLog("debug", JSON.stringify(userGeneratedData, null, 2));
    userGeneratedData.waterDistance.inland_water.display_name = await reverseGeocode(
      userGeneratedData.waterDistance.inland_water.closest_point.lat,
      userGeneratedData.waterDistance.inland_water.closest_point.lon
    );
    userGeneratedData.waterDistance.coastal_water.display_name = await reverseGeocode(
      userGeneratedData.waterDistance.coastal_water.closest_point.lat,
      userGeneratedData.waterDistance.coastal_water.closest_point.lon
    );
    customLog("debug", "getWaterDistanceData" + JSON.stringify(userGeneratedData, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function to calculate variance based on the selected year
function calculateClimateVariance(weatherData) {
  customLog("debug", "calculateClimateVariance start");
  const currentYear = new Date().getFullYear();
  const yearsIntoFuture = userGeneratedData.date.getFullYear() - currentYear;
  const maxVariance = 0.15; // 15%
  const minVariance = 0.02; // 2%
  const varianceFactor = Math.min(yearsIntoFuture * minVariance, maxVariance);
  const variance = 1 + (Math.random() - 0.5) * varianceFactor;

  //add the data to the userGeneratedData object
  userGeneratedData.temperature = (weatherData.data[0].temp * variance).toFixed(2);
  userGeneratedData.humidity = (weatherData.data[0].humidity * variance).toFixed(2);
  userGeneratedData.pressure = (weatherData.data[0].pressure * variance).toFixed(2);
  userGeneratedData.windSpeed = (weatherData.data[0].wind_speed * variance).toFixed(2);

  customLog("debug", "calculateClimateVariance temperature: " + userGeneratedData.temperature);
  customLog("debug", "calculateClimateVariance humidity: " + userGeneratedData.humidity);
  customLog("debug", "calculateClimateVariance pressure: " + userGeneratedData.pressure);
  customLog("debug", "calculateClimateVariance windSpeed: " + userGeneratedData.windSpeed);

  return {
    temperature: (weatherData.data[0].temp * variance).toFixed(2),
    humidity: (weatherData.data[0].humidity * variance).toFixed(2),
    pressure: (weatherData.data[0].pressure * variance).toFixed(2),
    windSpeed: (weatherData.data[0].wind_speed * variance).toFixed(2),
  };
}

map.on("contextmenu", async function (event) {
  if (currentMode !== "normal" && currentMode !== "generative") return;
  handleMapClick(event.latlng);
});

let touchTimeout;
map.on("touchstart", function (event) {
  if (currentMode !== "normal" && currentMode !== "generative") return;
  touchTimeout = setTimeout(() => {
    handleMapClick(event.latlng);
  }, 200);
});
map.on("touchend", function () {
  if (currentMode !== "normal" && currentMode !== "generative") return;
  clearTimeout(touchTimeout);
});

// Right-click event for creating a new marker
async function handleMapClick(latlng) {
  hideInstructionPopup();
  // Remove any existing markers from the map.
  map.eachLayer(function (layer) {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  // Get the coordinates for the new marker.
  mapChoicelatlng = latlng;
  const lat = mapChoicelatlng.lat;
  const lon = mapChoicelatlng.lng;
  centerMarkerInView(mapChoicelatlng);

  // Create a new marker.
  const marker = L.marker(mapChoicelatlng, {
    title: "Temporary Marker",
    alt: "Temporary Marker",
    draggable: true,
    closeOnClick: false,
  }).addTo(map);

  marker
    .bindPopup("<div id='check_location_bubble' class='main_text_medium'>Checking your chosen location. <br> <br>Please wait.<br><br></div>", {
      autoClose: false,
      closeOnClick: false,
    })
    .openPopup();

  const birdImageUrl = `${routingPrefix}/images/bird-cells-new.svg`;

  // Define the bird filter to control its color (e.g. "invert(1)" for white).
  const birdLoaderBirdFilter = "invert(0)";

  // Create the spinner container and the loader structure.
  const spinnerContainer = document.createElement("div");
  spinnerContainer.id = "audioSpinnerContainer";
  spinnerContainer.innerHTML = `
      <div class="bird-loader-wrapper">
        <div class="bird-loader">
          <div class="orbit">
            <div class="bird"></div>
          </div>
        </div>
      </div>
    `;
  const checkLocationBubble = document.getElementById("check_location_bubble");

  // Append the spinner container to your target element.
  checkLocationBubble.appendChild(spinnerContainer);

  // Set the bird's background image dynamically.
  const birdElem = spinnerContainer.querySelector(".bird");
  birdElem.style.backgroundImage = `url('${birdImageUrl}')`;

  // Set the bird filter using JavaScript.
  document.documentElement.style.setProperty("--bird-loader-bird-filter", birdLoaderBirdFilter);

  // Launch all asynchronous tasks concurrently.
  const isInAusPromise = getisInAustralia(lat, lon);
  const locationNamePromise = reverseGeocode(lat, lon);
  getWaterDistanceData(lat, lon);

  // Wait for the Australia check.
  const isInAustralia = await isInAusPromise;

  if (!isInAustralia) {
    // If the point is not in Australia, update the popup with an error message.
    marker
      .bindPopup("<div class='main_text_medium' id='error_bubble'>The selected point is not in Australia.  <br>Please select a point on any Australian territory.</div>")
      .openPopup();

    // After 3 seconds, close the popup and remove the marker.
    setTimeout(() => {
      marker.closePopup();
      map.removeLayer(marker);
    }, 3000);

    // Stop further processing.
    return;
  }

  // If the point is in Australia, await the remaining tasks.
  const locationName = await locationNamePromise;
  //const waterDistance = await waterDistancePromise;

  //lets add line breaks instead of commas in the lo
  // Update your user data.
  userGeneratedData.locationName = locationName;
  userGeneratedData.lat = lat;
  userGeneratedData.lon = lon;
  // userGeneratedData.waterDistance = waterDistance; // if needed

  // Create new popup content.
  // The container (with id "popup_bubble") will also hold the date picker.
  const popupContent = document.createElement("div");
  popupContent.id = "popup_bubble";

  const locationDiv = document.createElement("div");
  locationDiv.id = "location-display";
  locationDiv.className = "main_text_small";
  locationDiv.innerHTML = `<span class="main_text_medium_bold">Simulation location:</span><br> ${locationName}`;
  popupContent.appendChild(locationDiv);

  // Update the marker’s popup content and open it.
  marker.setPopupContent(popupContent);
  marker.openPopup();

  // Directly call the date picker initializer now that the popup is rebuilt.
  initCustomDatePicker({
    containerId: "popup_bubble",
    userGeneratedData,
    onDateSelectionComplete: (finalDate) => {
      customLog("debug", "Final date/time chosen:", finalDate);
      fillSuggestedWeatherData(userGeneratedData.date);
    },
    onWeatherSelectionComplete: (finalWeather) => {
      customLog("debug", "Final weather chosen:", finalWeather);

      fetchDataAndDisplay();
      //lets close the leaflet popoup and marker
      map.eachLayer(function (layer) {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });
    },
  });

  // Set up cleanup for when the popup is closed.
  marker.on("popupclose", async function (event) {
    //clear all the elements from the popup
    const containerElement = document.getElementById("popup_bubble");
    while (containerElement.firstChild) {
      containerElement.removeChild(containerElement.firstChild);
    }
    map.removeLayer(marker);
    userGeneratedData.locationName = "";
    userGeneratedData.lat = 0;
    userGeneratedData.lon = 0;
  });

  // (Optional) Define or include your fetchWeatherData and fillSuggestedWeatherData functions below.
  async function fetchWeatherData() {
    customLog("debug", "fetchWeatherData start");
    let altered_date = constructHistoricalDate();
    try {
      const response = await fetch(`${routingPrefix}/weather?lat=${lat}&lon=${lon}&date=${altered_date}`);
      const data = await response.json();
      customLog("debug", "fetchWeatherData received response: " + JSON.stringify(data));
      return data;
    } catch (error) {
      console.error("Error fetching weather data from server:", error);
      return null;
    }
  }

  async function fillSuggestedWeatherData() {
    customLog("debug", "fillSuggestedWeatherData start");
    const weatherData = await fetchWeatherData();
    if (weatherData) {
      const weatherVariance = calculateClimateVariance(weatherData);
      userGeneratedData.temperature = weatherVariance.temperature;
      userGeneratedData.humidity = weatherVariance.humidity;
      userGeneratedData.pressure = weatherVariance.pressure;
      userGeneratedData.windSpeed = weatherVariance.windSpeed;

      document.getElementById("temperature-input").value = userGeneratedData.temperature;
      document.getElementById("humidity-input").value = userGeneratedData.humidity;
      document.getElementById("pressure-input").value = userGeneratedData.pressure;
      document.getElementById("wind-speed-input").value = userGeneratedData.windSpeed;
      //lets trigger the onWeatherDataAdjusted function from the csutomDatePicker class
      onWeatherDataAdjusted();
    }
  }
}

async function callGenerateWithGradio(lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year) {
  try {
    const response = await fetch(routingPrefix + "/generateAudio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lat,
        lon,
        temp,
        humidity,
        wind_speed,
        pressure,
        minutes_of_day,
        day_of_year,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const result = await response.json();
    customLog("debug", "callGenerateWithGradio::Result from audio generation: ", JSON.stringify(result, null, 2));

    return result.audioUrl;
  } catch (error) {
    console.error("Error:", error);
  }
}

async function loadAudio() {

  const audioUrl = await callGenerateWithGradio(
    userGeneratedData.lat,
    userGeneratedData.lon,
    userGeneratedData.temperature,
    userGeneratedData.humidity,
    userGeneratedData.windSpeed,
    userGeneratedData.pressure,
    userGeneratedData.minutes_of_day,
    userGeneratedData.day_of_year
  );
  if (audioUrl) {
    const resultDiv = document.getElementById("resultDiv");

    // Remove existing audio player if any
    const existingAudioPlayer = document.getElementById("audioPlayer");
    if (existingAudioPlayer) {
      existingAudioPlayer.remove();
    }

    // Create a new audio player
    const audioPlayer = document.createElement("audio");
    audioPlayer.id = "audioPlayer";
    audioPlayer.controls = true;

    // For mobile autoplay support, you need autoplay, playsinline, and possibly muted
    audioPlayer.setAttribute("autoplay", "");
    audioPlayer.setAttribute("playsinline", "");

    audioPlayer.addEventListener(
      "canplaythrough",
      () => {
        document.getElementById("audioSpinnerContainer").remove(); // remove spinner
      },
      { once: true }
    );

    audioPlayer.addEventListener(
      "error",
      (err) => {
        spinnerContainer.remove(); // remove spinner on error
        console.error("Audio load error:", err);
      },
      { once: true }
    );

    audioPlayer.src = audioUrl;
    resultDiv.appendChild(audioPlayer);

    audioPlayer.load();
    resultDiv.scrollTop = resultDiv.scrollHeight;
  }
}

async function fetchDataAndDisplay() {
  customLog("debug", "fetchDataAndDisplay start: " + JSON.stringify(userGeneratedData, null, 2));
  try {
    // Send a POST request to the server
    const response = await fetch(routingPrefix + "/generate-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userInput: JSON.stringify(userGeneratedData) }),
      //lets print the userGeneratedData object to the console
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    // Prepare the result div when the button is pressed, before the response starts streaming
    const generatedContentDiv = document.createElement("div");
    generatedContentDiv.id = "resultDiv";
    generatedContentDiv.innerHTML = '<button id="closeBtn" style="position: absolute; top: 10px; right: 10px;">&times;</button><p id="streamedText">Loading...</p>';

    document.body.appendChild(generatedContentDiv);

    const resultDiv = document.getElementById("resultDiv");

    const birdImageUrl = `${routingPrefix}/images/bird-cells-new.svg`;

    // Define the bird filter to control its color (e.g. "invert(1)" for white).
    const birdLoaderBirdFilter = "invert(1)";

    // Create the spinner container and the loader structure.
    const spinnerContainer = document.createElement("div");
    spinnerContainer.id = "audioSpinnerContainer";
    spinnerContainer.innerHTML = `
                                <div class="bird-loader-wrapper">
                                  <div class="bird-loader">
                                    <div class="orbit">
                                      <div class="bird"></div>
                                    </div>
                                  </div>
                                </div>
                              `;

    // Append the spinner container to your target element.
    resultDiv.appendChild(spinnerContainer);

    // Set the bird's background image dynamically.
    const birdElem = spinnerContainer.querySelector(".bird");
    birdElem.style.backgroundImage = `url('${birdImageUrl}')`;

    // Set the bird filter using JavaScript.
    document.documentElement.style.setProperty("--bird-loader-bird-filter", birdLoaderBirdFilter);

    loadAudio();

    const streamedText = document.getElementById("streamedText");
    const closeBtn = document.getElementById("closeBtn");

    closeBtn.addEventListener("click", () => {
      generatedContentDiv.remove();
      map.eachLayer(function (layer) {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });
      //resetInstructionTimeout();
    });

    // Read the stream using a reader
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let resultText = "";
    // Flags to track removal of the first <p> and first </p>
    let firstPRemoved = false;
    let firstClosePRemoved = false;

    reader.read().then(function processText({ done, value }) {
      if (done) {
        customLog("debug", "Stream complete");
        streamedText.innerHTML = resultText;
        return;
      }

      // Decode the chunk
      let chunkStr = decoder.decode(value, { stream: true });

      // Remove the very first <p> if not removed yet
      

      // Add the processed chunk to the result
      resultText += chunkStr;

      if (!firstPRemoved) {
        const newResultText = resultText.replace("<p>", "");
        // Check if replacement actually happened
        if (newResultText !== resultText) {
          firstPRemoved = true;
          resultText = newResultText;
        }
      }

      // Remove the very first </p> if not removed yet
      if (!firstClosePRemoved) {
        const newResultText = resultText.replace("</p>", "");
        if (newResultText !== resultText) {
          firstClosePRemoved = true;
          resultText = newResultText;
        }
      }
      streamedText.innerHTML = resultText;

      // Read the next chunk
      reader.read().then(processText);
    });
  } catch (error) {
    console.error("Failed to fetch response:", error);
  }
}
async function getisInAustralia(lat, lon) {
  //lets log the time to see how long it takes to get a response
  //console.time("isInAustralia");
  const url = routingPrefix + "/isInAustralia"; // Relative URL for your Node.js server endpoint

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lat, lon }),
    });
    const data = await response.json();
    if (data == true) {
      customLog("debug", "User location is in Australia");
      //lets stop the timer
      //console.timeEnd("isInAustralia");
      return true;
    } else {
      customLog("debug", "User location is not in Australia");
      //lets stop the timer
      //console.timeEnd("isInAustralia");
      return false;
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

function centerMarkerInView(latlngIn) {
  customLog("debug", "centerMarkerInView start");
  const mapSize = map.getSize();
  customLog("debug", "mapSize: " + mapSize);

  const markerPoint = map.latLngToContainerPoint(latlngIn);
  customLog("debug", "markerPoint: " + markerPoint);
  var desiredPoint;
  if (mapSize.x > 1280) {
    // Desired container point: center horizontally, 80% down vertically.
    desiredPoint = L.point(mapSize.x / 2, mapSize.y * 0.85);
    customLog("debug", "desiredPoint: " + desiredPoint);
  } else if (mapSize.x > 800) {
    // Desired container point: center horizontally, 85% down vertically.
    desiredPoint = L.point(mapSize.x / 2, mapSize.y * 0.9);
    customLog("debug", "desiredPoint: " + desiredPoint);
  } else {
    // Desired container point: center horizontally, 80% down vertically.
    desiredPoint = L.point(mapSize.x / 2, mapSize.y * 0.95);
    customLog("debug", "desiredPoint: " + desiredPoint);
  }

  // Compute the offset needed to shift the marker to the desired container point.
  const offsetX = desiredPoint.x - markerPoint.x;
  const offsetY = desiredPoint.y - markerPoint.y;
  // Remove the negative sign here.
  const offset = L.point(-offsetX, -offsetY);

  customLog("debug", "manual offset: " + offset);

  // Pan the map by the computed offset.
  map.panBy(offset, { animate: false, duration: 1 });
}

function customLog(logLevel, ...messages) {
  const levels = ["silent", "error", "warning", "info", "debug"];
  const currentLevelIndex = levels.indexOf(globalLogLevel);
  const messageLevelIndex = levels.indexOf(logLevel);

  if (messageLevelIndex <= currentLevelIndex && currentLevelIndex !== 0) {
    if (logLevel === "error") {
      console.error(...messages);
    } else if (logLevel === "warning") {
      console.warn(...messages);
    } else if (logLevel === "info") {
      console.info(...messages);
    } else {
      console.log(...messages);
    }
  }
}
function wrapTextAtWhitespace(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  let result = "";
  let remainingText = text;

  while (remainingText.length > maxLength) {
    let breakpoint = remainingText.lastIndexOf(",", maxLength);
    if (breakpoint === -1) {
      breakpoint = maxLength;
    }
    result += remainingText.substring(0, breakpoint) + "<br>";
    remainingText = remainingText.substring(breakpoint + 1);
  }

  result += remainingText;
  return result;
}
// Helper function to convert HH:MM:SS (24-hour) to 12-hour format with AM/PM.
function convertTimeTo12Hour(timeStr) {
  const [hourStr, minuteStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minuteStr} ${ampm}`;
}

/**
 * Chooses a random file number (1 to totalFiles) that has not been played yet.
 * Resets the set when all files have been played.
 */
function getRandomFileNumber() {
  if (playedFiles.size >= driftConfig.totalFiles) {
    playedFiles.clear();
  }
  let fileNumber;
  do {
    fileNumber = Math.floor(Math.random() * driftConfig.totalFiles) + 1;
  } while (playedFiles.has(fileNumber));
  playedFiles.add(fileNumber);
  return fileNumber;
}

/**
 * Formats the file number into a 4-digit string (e.g. 1 -> "0001").
 */
function formatFileNumber(num) {
  return String(num).padStart(4, "0");
}

async function controlHuggingFaceServer(command) {
  try {
    const response = await fetch(`${routingPrefix}/hug_space_control`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command: command }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const result = await response.json();
    customLog("debug", "controlHuggingFaceServer::Result from server:", JSON.stringify(result, null, 2));
    return result.status;
  } catch (error) {
    console.error("Error controlling Hugging Face server:", error);
    throw error;
  }
}
