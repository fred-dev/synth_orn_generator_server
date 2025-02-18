import { initCustomDatePicker } from "./customDatePicker.js";

const globalLogLevel = "silent"; // "silent", "error", "warning", "info", "debug"
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
var routingPrefix = "";
// const map = L.map("map", {center: [-25.2744, 133.7751], zoom: 4,});
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const map = L.map("map", { zoomControl: false }).setView([-24.801233, 132.94551], 5);

map.fitBounds([
  [-10, 112],
  [-44, 154],
]);

//const tiles = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg", { attribution });
//const tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution });
const tiles = L.tileLayer(tileUrl, { attribution });

tileUrl;
tiles.addTo(map);

// ================= Drift Mode Configuration & State =================

// ================= Drift Mode Configuration & State =================

// Set this to true during development if you want the system to load in drift mode by default.
const DRIFT_MODE_DEFAULT = true;
// Key (e.g. "d") used to toggle modes.
const DRIFT_MODE_KEY = "d";

// Current mode: either "normal" or "drift".
var currentMode = "drift";

// Custom log function to handle different log levels.
customLog("debug", "Current mode on start:", currentMode);

// Drift mode configuration
const driftConfig = {
  crossfade: 4, // seconds (fly-to and crossfade will run for 4 seconds)
  fileDuration: 22, // seconds (all files are 23 sec long, so crossfade starts at 18 sec)
  totalFiles: 1000,
  // This folder should be accessible via your web server (e.g. via a symlink) and contain files in subfolders:
  // drift_mp3s: contains files named "0001.mp3", "0002.mp3", etc.
  // drift_json: contains files named "0001.json", "0002.json", etc.
  folderPath: "/drift",
};

// Global variables for drift mode state.
let driftActive = false;
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

// ================= Utility Functions =================

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

function showPermissionOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "permissionOverlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.8)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "48px",
    zIndex: "10000",
    cursor: "pointer",
  });
  overlay.textContent = "CLICK / TOUCH";
  document.body.appendChild(overlay);

  // Remove the overlay and start drift mode when clicked or touched.
  const removeOverlay = (e) => {
    e.stopPropagation();
    overlay.remove();
    firstLoad = false;
    customLog("debug", "Permission overlay removed. Current mode:", currentMode);
    if (currentMode === "drift") {
      //lets wait a bit before starting the drift mode
      setTimeout(() => {
        startDriftMode();
        driftAudio[0].load();
        driftAudio[1].load();
      }, 800);
      detectTouchDevice();
      customLog("debug", "Starting drift mode from permission overlay.");
    }
  };

  // Use the 'once' option so the event fires only a single time.
  overlay.addEventListener("click", removeOverlay, { once: true });
  overlay.addEventListener("touchstart", removeOverlay, { once: true });
}

// ================= Drift Mode Functions =================

/**
 * Loads the audio file and its corresponding JSON (to get geolocation and other data),
 * creates a marker with a popup showing time/date and weather,
 * sets the audio source, and starts playback.
 * Returns the created marker.
 */
// Helper function to convert HH:MM:SS (24-hour) to 12-hour format with AM/PM.
function convertTimeTo12Hour(timeStr) {
  const [hourStr, minuteStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minuteStr} ${ampm}`;
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

    // Build the seven text items:
    // 1. Location (the longest string)
    // 2. Year
    // 3. Date details (day, month, date, time)
    // 4. Temperature (°C)
    // 5. Humidity (%) capped at 100
    // 6. Pressure (hPa) capped at 1084
    // 7. Wind Speed (km/h)
    const wrappedLocation = wrapTextAtWhitespace("Location: " + jsonData.display_name, 90);
    const items = [
      wrappedLocation,
      "Year: " + year,
      `Date: ${dayName} ${monthName} ${dateNumber} ${time12}`,
      "Temperature: " + jsonData.main.temp + "°C",
      "Humidity: " + Math.min(jsonData.main.humidity, 100) + "%",
      "Pressure: " + Math.min(jsonData.main.pressure, 1084) + "hPa",
      "Wind Speed: " + jsonData.wind.speed + "km/h",
    ];

    // Create the popup container
    const popupContainer = document.createElement("div");
    popupContainer.style.backgroundColor = "black";
    popupContainer.style.padding = "5px";
    // Optionally, force each component to display on one line:
    popupContainer.style.display = "flex";
    popupContainer.style.flexDirection = "column";
    popupContainer.style.gap = "2px";

    // For each item, create a container with the appropriate classes.
    items.forEach((itemText) => {
      const compDiv = document.createElement("div");
      compDiv.className = "flyoverComponent"; // style in your CSS to ensure proper spacing and sizing
      // The text element:
      const textSpan = document.createElement("div");
      textSpan.className = "flyoverText"; // style this class (e.g., white text, font, etc.)
      textSpan.textContent = itemText;
      compDiv.appendChild(textSpan);
      popupContainer.appendChild(compDiv);
    });

    // Bind this popup to your marker (assuming you already have a marker variable)
    marker = L.marker([jsonData.coord.lat, jsonData.coord.lon], {
      autoClose: false,
      closeOnClick: false,
    }).bindPopup(popupContainer);

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

  return marker;
}

/**
 * Flies to the given latlng and then pans the map so that the point appears
 * at the desired container offset (horizontally centered and 90% down vertically).
 *
 * @param {L.LatLng} latlng - The target latitude/longitude.
 * @param {number} zoom - The zoom level.
 * @param {number} duration - The duration (in seconds) for the flyTo.
 * @returns {Promise} Resolves when both flyTo and panBy are complete.
 */
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
/**
 * Schedules the crossfade (and corresponding fly-to) between the currently playing audio and the next one.
 * The fly-to operation (with duration equal to driftConfig.crossfade) and the audio crossfade
 * start at the same time.
 */
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
  if (driftActive) return; // Already running
  driftActive = true;
  currentMode = "drift";
  document.body.classList.add("drift-mode");
  console.log("Drift mode activated");

  // Add a slight delay to ensure currentMode is set before showing the popup
  setTimeout(() => {
    showInstructionPopup();
  }, 100);

  playedFiles.clear();
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

// ================= Mode Toggle via Keyboard =================

// document.addEventListener("keydown", (e) => {
//   if (e.key.toLowerCase() === DRIFT_MODE_KEY) {
//     if (currentMode === "drift") {
//       // Switch back to normal mode.
//       currentMode = "normal";
//       stopDriftMode();
//       customLog("debug", "Switched to normal mode");
//       // (Optional) Re-enable your normal map event listeners here.
//     } else {
//       // Switch to drift mode.
//       currentMode = "drift";
//       startDriftMode();
//       customLog("debug", "Switched to drift mode");

//       // (Optional) Disable normal map event listeners if necessary.
//     }
//   }
// });

// document.addEventListener("DOMContentLoaded", () => {

// });

let firstLoad = true;
let instructionTimeout;

function showInstructionPopup() {
  const popup = document.getElementById("instructionPopup");
  if (!popup || popup.classList.contains("visible") || document.getElementById("resultDiv") || mapChoicelatlng) {
    return;
  }
  console.log("showInstructionPopup called. Current mode:", currentMode);

  const normalText = `
    <h3 id="popup-heading">Welcome to Synthetic Ornithology</h3>
    This platform uses predictive models to simulate how
    <br>Australian ecosystems respond to future climate scenarios.
    <br>For a selected scenario, our model will produce birdsong
    <br>and wildlife soundscapes reflecting the projected conditions.
    <br><br>Simply pan and zoom across the map to choose a location
    <br>(it must be within Australia). Once at your desired location,
    <br>right-click (Control + click on Mac)
    <br>or long-press on touchscreen devices
    <br>to generate a location-specific simulation.
  `;

  const driftText = `
  <h3 id="popup-heading">Welcome to Synthetic Ornithology</h3>
    This platform uses predictive models to simulate how
    <br>Australian ecosystems respond to future climate scenarios.
    <br>For a selected scenario, our model will produce birdsong
    <br>and wildlife soundscapes reflecting the projected conditions.
    <br><br>Drift Mode is currently active, providing a continuously
    <br>changing simulated soundscape. To choose your own scenario,
    <br>interact with the map:

    <br><br>Simply pan and zoom across the map to choose a location
    <br>(it must be within Australia). Once at your desired location,
    <br>right-click (Control + click on Mac)
    <br>or long-press on touchscreen devices
    <br>to generate a location-specific simulation.
  `;

  popup.innerHTML = currentMode === "drift" ? driftText : normalText;
  popup.classList.add("visible");
}

function hideInstructionPopup() {
  if (currentMode === "drift") return;
  const popup = document.getElementById("instructionPopup");
  if (popup) {
    popup.classList.remove("visible");
  }
}

function resetInstructionTimeout() {
  if (firstLoad) return;
  hideInstructionPopup();
  clearTimeout(instructionTimeout);
  instructionTimeout = setTimeout(() => {
    showInstructionPopup();
  }, 45000);
}

setTimeout(() => {
  hideInstructionPopup();
  instructionTimeout = setTimeout(() => {
    showInstructionPopup();
  }, 45000);
}, 15000);

// Polyfill for Element.closest() for older browsers
if (!Element.prototype.closest) {
  Element.prototype.closest = function (selector) {
    let el = this;
    while (el) {
      if (el.matches(selector)) return el;
      el = el.parentElement;
    }
    return null;
  };
}

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

["mousemove", "mousedown", "touchend", "click"].forEach((evt) => {
  document.addEventListener(evt, debounce((e) => {
    // Ignore events that originate from the permission overlay.
    if (e.target.id == "permissionOverlay" || e.target.closest("#permissionOverlay")) {
      console.log("Ignoring event from permission overlay");
      return;
    }

    if (currentMode === "drift") {
      exitDriftMode();
      console.log("Exiting drift mode");
    } else {
      resetInactivityTimeout(); // For normal mode inactivity handling.
    }
  }, 400));
});

["mousemove", "mousedown", "touchstart", "touchend", "touchmove", "click"].forEach((evt) => {
  document.addEventListener(evt, resetInactivityTimeout);
});

let inactivityTimeout;
function resetInactivityTimeout() {
  if (currentMode !== "normal") return;
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(() => {
    // Switch automatically to drift mode after 80 seconds of inactivity
    currentMode = "drift";
    document.body.classList.add("drift-mode");
    startDriftMode();
  }, 80000); // 80 seconds
}

function detectTouchDevice() {
  const hasTouchSupport =
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);

  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  if (hasTouchSupport || isCoarsePointer) {
    document.body.classList.add('touch-device');
    console.log('Touch device detected');
    return true;
  }
  console.log('Touch device not detected');
  return false;
}

async function getRoutingPrefix() {
  const url = "/generate/routingPrefix"; // Relative URL for your Node.js server endpoint

  try {
    const response = await fetch(url, {
      method: "GET",
    });
    const data = await response.json();
    customLog("debug", "Routing Prefix inner function:", data.route);
    return data.route;
  } catch (error) {
    customLog("error", "Failed to fetch Routing Prefix:", error);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  customLog("debug", "DOMContentLoaded event fired");

  // Call getRoutingPrefix after a delay of 3 seconds (3000 milliseconds)
  setTimeout(async () => {
    try {
      routingPrefix = await getRoutingPrefix();
      customLog("debug", "Routing Prefix received event list:", routingPrefix);
      const style = document.createElement("style");
      style.innerHTML = `
                        @font-face {
                          font-family: "Univers";
                          src: url("${routingPrefix}/fonts/Univers/UniversLight.ttf") format("truetype");
                        }
                        `;
      console.log("routing prefix", routingPrefix);
      document.head.appendChild(style);

      showPermissionOverlay();
      // Use the routingPrefix as needed in your client-side code
    } catch (error) {
      customLog("error", "Failed to fetch Routing Prefix:", error);
    }
  }, 1000); // 3000 milliseconds = 3 seconds
});



// Function to perform reverse geocoding
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    //add the data to the userGeneratedData object
    customLog("debug", "reverseGeocode results: " + JSON.stringify(data, null, 2));
    return data.display_name;
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
  if (currentMode !== "normal") return;
  handleMapClick(event.latlng);
});

let touchTimeout;
map.on("touchstart", function (event) {
  if (currentMode !== "normal") return;
  touchTimeout = setTimeout(() => {
    handleMapClick(event.latlng);
  }, 450);
});
map.on("touchend", function () {
  if (currentMode !== "normal") return;
  clearTimeout(touchTimeout);
});

function exitDriftMode() {
  if (currentMode === "drift") {
    // Optionally fade out audio (here we simply pause them)
    driftAudio.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    // Close popups and remove drift markers
    if (currentMarker) {
      currentMarker.closePopup();
      map.removeLayer(currentMarker);
      currentMarker = null;
    }
    stopDriftMode();
    // Switch mode and update body class
    currentMode = "normal";
    document.body.classList.remove("drift-mode");
    // Show instructions for 5 seconds then hide them
    showInstructionPopup();
    setTimeout(() => {
      hideInstructionPopup();
    }, 5000);
  }
}

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
    .bindPopup("<div id='check_location_bubble' class='main_text_medium'>Checking your chosen location. <br> <br>Please wait.<br><br></div><div class='loader'></div>", {
      autoClose: false,
      closeOnClick: false,
    })
    .openPopup();

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
    generatedContentDiv.innerHTML = '<p id="streamedText">Loading...</p><button id="closeBtn">Close</button>';

    document.body.appendChild(generatedContentDiv);

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
      resetInstructionTimeout();
    });

    // Read the stream using a reader
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let resultText = "";

    reader.read().then(function processText({ done, value }) {
      if (done) {
        customLog("debug", "Stream complete");
        streamedText.innerHTML = resultText; // Final update to the text
        return;
      }

      // Decode the stream chunk to text
      const chunk = decoder.decode(value, { stream: true });
      resultText += chunk;
      streamedText.innerHTML = resultText; // Update the displayed text with each chunk

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
  if (mapSize.x > 600) {
    // Desired container point: center horizontally, 80% down vertically.
    desiredPoint = L.point(mapSize.x / 2, mapSize.y * 0.8);
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
  // Find the last whitespace before maxLength.
  let breakpoint = text.lastIndexOf(" ", maxLength);
  if (breakpoint === -1) {
    // If no whitespace is found, break at maxLength.
    breakpoint = maxLength;
  }
  return text.substring(0, breakpoint) + "\n" + text.substring(breakpoint + 1);
}
