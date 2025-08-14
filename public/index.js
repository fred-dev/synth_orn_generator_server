import { initCustomDatePicker, onWeatherDataAdjusted } from "./customDatePicker.js";

// =========================
// Global config & state
// =========================
const globalLogLevel = "debug"; // "silent", "error", "warning", "info", "debug"

// Meta modes: high-level behaviour controller
//   - normal: allows DRIFT and GENERATIVE; idle returns to DRIFT
//   - quiet:  allows GENERATIVE only (no DRIFT); idle resets UI to generative instructions
let metaMode = "normal"; // from config.startMetaMode
let masterInactivityMs = 70000; // from config.masterInactivityMs (default 70s)
let postGenerateWaitMs = 10000; // from config.postGenerateWaitMs (default 10s)

let userPresentTimerId = null;
let postGenerateTimerId = null;

let isStreamingText = false;
let isAudioPlaying = false;
let generatedUIOpen = false;

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
  inland_water: { closest_point: { lat: 0, lon: 0 }, display_name: "" },
  coastal_water: { closest_point: { lat: 0, lon: 0 }, display_name: "" },
};
customLog("debug", "init userGeneratedData", userGeneratedData);

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

let routingPrefix = "/examination";
let suppressGlobalEvents = false;

// Leaflet / Map setup
const attribution = '© OpenStreetMap contributors'; // plain text, no <a> tag
const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const map = L.map("map", {
  zoomControl: false,
  attributionControl: true
}).setView([-24.801233, 132.94551], 5);

map.fitBounds([
  [-10, 112],
  [-44, 154],
]);

// Disable Leaflet link in attribution
map.attributionControl.setPrefix(false);

// Add tiles with your custom attribution
L.tileLayer(tileUrl, {
  attribution: attribution
}).addTo(map);

// Modes
const MODES = {
  NORMAL: "normal",
  DRIFT: "drift",
  SILENT: "silent",
  GENERATIVE: "generative",
};
let currentMode = MODES.GENERATIVE; // will be overwritten by config
customLog("debug", "Current mode on start:", currentMode);

let textGenerationComplete = false;
let huggingFaceServerStatus = "";

// Drift mode configuration
const driftConfig = {
  crossfade: 4, // seconds
  fileDuration: 23, // seconds
  totalFiles: 1000,
  folderPath: "/drift",
};

// Drift state
let driftActive = false;
let startMode = "";
let playedFiles = new Set();
let currentPlayer = 0; // 0 or 1
const driftAudio = [new Audio(), new Audio()];
driftAudio[0].volume = 1;
driftAudio[1].volume = 0;
let crossfadeTimeoutId = null;
let fadeIntervalId = null;
let currentMarker = null;

// Legacy timeouts (replaced by master presence timer)
let inactivityTimeout = 0;
let generativeTimeout = 0;

let hasTouch = false;
let silentStartHour = 22;
let silentEndHour = 7;
let silentStartMinute = 0;
let silentEndMinute = 0;

// =========================
// Mode handlers
// =========================
const modeHandlers = {
  [MODES.NORMAL]: {
    enter: () => {
      customLog("debug", "[MODE] Enter NORMAL");
      document.body.classList.remove("drift-mode");
      showInstructionPopupFor(MODES.NORMAL);
      clearUserPresenceTimer();
      startUserPresenceTimer("enter normal");
    },
    exit: () => {
      customLog("debug", "[MODE] Exit NORMAL");
      hideInstructionPopup();
      clearUserPresenceTimer();
      clearPostGenerateTimer();
      closeGeneratedContentIfOpen();
    },
  },

  [MODES.DRIFT]: {
    enter: () => {
      customLog("debug", "[MODE] Enter DRIFT");
      document.body.classList.add("drift-mode");
      showInstructionPopupFor(MODES.DRIFT);
      startDriftMode();
    },
    exit: () => {
      customLog("debug", "[MODE] Exit DRIFT");
      document.body.classList.remove("drift-mode");
      stopDriftMode();
    },
  },

  [MODES.SILENT]: {
    enter: async () => {
      customLog("info", "[MODE] Enter SILENT (pausing HF space)");
      showSilentModeOverlay();
      pauseAllAudio();
      try {
        huggingFaceServerStatus = await controlHuggingFaceServer("pause");
        customLog("info", "HF status after pause:", huggingFaceServerStatus);
      } catch (e) {
        customLog("error", "HF pause error:", e);
      }
    },
    exit: () => {
      customLog("debug", "[MODE] Exit SILENT");
      hideSilentModeOverlay();
    },
  },

  [MODES.GENERATIVE]: {
    enter: () => {
      customLog("debug", "[MODE] Enter GENERATIVE");
      document.body.classList.remove("drift-mode");
      showInstructionPopupFor(MODES.GENERATIVE);
      clearUserPresenceTimer();
      startUserPresenceTimer("enter generative");
    },
    exit: () => {
      customLog("debug", "[MODE] Exit GENERATIVE");
      hideInstructionPopup();
      clearUserPresenceTimer();
      clearPostGenerateTimer();
    },
  },
};

function pauseAllAudio() {
  driftAudio.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {
      customLog("warning", "pauseAllAudio fail:", e);
    }
  });
}

function switchMode(newMode) {
  customLog("info", "[switchMode]", currentMode, "→", newMode);

  // Idempotent cleanup before switching
  try {
    const containerElement = document.getElementById("popup_bubble");
    if (containerElement) {
      while (containerElement.firstChild) containerElement.removeChild(containerElement.firstChild);
    }
  } catch {}

  closeGeneratedContentIfOpen();

  // Remove all markers
  try {
    map.eachLayer(function (layer) {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
  } catch {}

  if (newMode === currentMode) {
    customLog("debug", "[switchMode] no-op (already in", newMode, ")");
    return;
  }

  // exit old
  try { modeHandlers[currentMode]?.exit?.(); } catch (e) { customLog("warning", "mode exit error:", e); }

  // update
  currentMode = newMode;

  // enter new
  try { modeHandlers[newMode]?.enter?.(); } catch (e) { customLog("warning", "mode enter error:", e); }
}

// =========================
// Silent overlay
// =========================
function showSilentModeOverlay() {
  const now = new Date();
  const wentSilentDisplay = formatTime24(now.getHours(), now.getMinutes());
  const resumeDisplay = formatTime24(silentEndHour, silentEndMinute);

  const silentModeOverlay = document.createElement("div");
  silentModeOverlay.id = "silentModeOverlay";
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
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${hh}:${mm}`;
}
function hideSilentModeOverlay() {
  const overlay = document.getElementById("silentModeOverlay");
  if (overlay) overlay.remove();
}

// =========================
// Boot / Config
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  customLog("debug", "DOMContentLoaded fired");

  // Detect touch ASAP (needed for overlay listener decisions)
  detectTouchDevice();

  // Load the JSON config
  const config = await loadConfig();
  if (config) {
    startMode = config.startMode;
    currentMode = MODES[config.startMode?.toUpperCase()] || MODES.NORMAL;

    silentStartHour = config.silentModeStartHour ?? 22;
    silentStartMinute = config.silentModeStartMinute ?? 0;
    silentEndHour = config.silentModeEndHour ?? 7;
    silentEndMinute = config.silentModeEndMinute ?? 0;

    // NEW: meta + timers
    metaMode = (config.startMetaMode || metaMode).toLowerCase();
    masterInactivityMs = Number.isFinite(config.masterInactivityMs) ? config.masterInactivityMs : masterInactivityMs;
    postGenerateWaitMs = Number.isFinite(config.postGenerateWaitMs) ? config.postGenerateWaitMs : postGenerateWaitMs;

    customLog("info", "Loaded config:", config, "=> currentMode:", currentMode, "meta:", metaMode,
      "masterInactivityMs:", masterInactivityMs, "postGenerateWaitMs:", postGenerateWaitMs);
  } else {
    customLog("warning", "No config loaded; using defaults");
  }

  huggingFaceServerStatus = await controlHuggingFaceServer("status");
  customLog("debug", "HF server status:", huggingFaceServerStatus);

  try {
    const style = document.createElement("style");
    style.innerHTML = `
      @font-face { font-family: "Univers"; src: url("${routingPrefix}/fonts/Univers/UniversLight.ttf") format("truetype"); }
    `;
    document.head.appendChild(style);

    showPermissionOverlay();
  } catch (error) {
    customLog("error", "Failed to set font / show overlay:", error);
  }
});

// Silent window watcher
setInterval(() => {
  const now = new Date();
  const nowTotal = minutesSinceMidnight(now.getHours(), now.getMinutes());
  const silentStartTotal = minutesSinceMidnight(silentStartHour, silentStartMinute);
  const silentEndTotal = minutesSinceMidnight(silentEndHour, silentEndMinute);

  let isSilentTime;
  if (silentStartTotal < silentEndTotal) {
    isSilentTime = nowTotal >= silentStartTotal && nowTotal < silentEndTotal;
  } else {
    isSilentTime = nowTotal >= silentStartTotal || nowTotal < silentEndTotal;
  }

  if (isSilentTime && currentMode !== MODES.SILENT) {
    switchMode(MODES.SILENT);
  } else if (!isSilentTime && currentMode === MODES.SILENT) {
    (async () => {
      try {
        huggingFaceServerStatus = await controlHuggingFaceServer("restart");
        customLog("info", "HF status after restart:", huggingFaceServerStatus);
      } catch (e) {
        customLog("error", "HF restart error:", e);
      }
      // Resume sub-mode based on meta
      if (metaMode === "normal") {
        switchMode(MODES.DRIFT);
      } else {
        switchMode(MODES.GENERATIVE);
      }
    })();
  }
}, 60000);

function minutesSinceMidnight(hour, minute) { return hour * 60 + minute; }

// =========================
// Permission overlay (autoplay unlock)
// =========================
function showPermissionOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "permissionOverlay";
  overlay.textContent = "CLICK / TOUCH";
  document.body.appendChild(overlay);

  const removeOverlay = async (e) => {
    e.stopPropagation();
    overlay.remove();

    suppressGlobalEvents = true;
    setTimeout(() => { suppressGlobalEvents = false; }, 1000);

    // Enter starting sub-mode by metaMode
    if (metaMode === "normal") {
      switchMode(MODES.DRIFT);
    } else {
      switchMode(MODES.GENERATIVE);
    }
  };

  // Register both to be safe on hybrid devices
  overlay.addEventListener("click", removeOverlay, { once: true });
  overlay.addEventListener("touchstart", removeOverlay, { once: true, passive: true });
}

// =========================
// Global interaction listener (master presence timer)
// =========================
["mousemove", "mousedown", "touchstart", "touchend", "touchmove", "click"].forEach((evt) => {
  document.addEventListener(evt, (e) => {
    if (suppressGlobalEvents) return;
    const t = e.target;
    if (t && (t.id === "permissionOverlay" || t.closest?.("#permissionOverlay"))) return;

    // No interactions during SILENT should change behaviour
    if (currentMode === MODES.SILENT) return;

    // Any interaction while in DRIFT → jump to GENERATIVE (usable state)
    if (currentMode === MODES.DRIFT) {
      switchMode(MODES.GENERATIVE);
      showInstructionPopupFor(MODES.GENERATIVE);
      clearUserPresenceTimer();
      startUserPresenceTimer("left drift via interaction");
      return;
    }

    // For all other interactive modes, reset master presence timer
    clearUserPresenceTimer();
    startUserPresenceTimer("generic interaction");
  }, { passive: true });
});

// =========================
// Master presence timer & helpers
// =========================
function clearUserPresenceTimer() {
  if (userPresentTimerId) {
    clearTimeout(userPresentTimerId);
    userPresentTimerId = null;
    customLog("verbose", "[presence] cleared");
  }
}
function startUserPresenceTimer(reason = "") {
  if (currentMode === MODES.SILENT || isStreamingText || isAudioPlaying) {
    customLog("debug", "[presence] NOT started (mode/flags)", { currentMode, isStreamingText, isAudioPlaying, reason });
    return;
  }
  clearUserPresenceTimer();
  userPresentTimerId = setTimeout(() => {
    customLog("info", "[presence] expired in", currentMode, "meta:", metaMode);
    if (currentMode === MODES.SILENT) return;

    if (metaMode === "normal") {
      switchMode(MODES.DRIFT);
    } else {
      // quiet: never drift
      closeGeneratedContentIfOpen();
      showInstructionPopupFor(MODES.GENERATIVE);
      if (currentMode !== MODES.GENERATIVE) switchMode(MODES.GENERATIVE);
    }
  }, masterInactivityMs);
  customLog("verbose", `
    [presence] started for ${Math.round(masterInactivityMs / 1000)}s (reason: ${reason})
  `);
}

function clearPostGenerateTimer() {
  if (postGenerateTimerId) {
    clearTimeout(postGenerateTimerId);
    postGenerateTimerId = null;
    customLog("debug", "[postGen] cleared");
  }
}

function closeGeneratedContentIfOpen() {
  const generatedContentDiv = document.getElementById("resultDiv");

  if (generatedContentDiv) {
    // 1) Remove spinner if present
    try { document.getElementById("audioSpinnerContainer")?.remove(); } catch {}

    // 2) Stop & fully unload audio (without triggering error)
    const ap = generatedContentDiv.querySelector("#audioPlayer");
    if (ap) {
      try { ap.pause(); } catch {}

      // Drop all event listeners by cloning, so our "error" handler won't run.
      const clone = ap.cloneNode(true);
      ap.replaceWith(clone);

      // Remove any source and force the element into a 'no src' state.
      clone.removeAttribute("src");
      // Some engines reset better if we call load() after removing src.
      try { clone.load(); } catch {}

      // Finally remove the element from the DOM.
      clone.remove();
    }

    // 3) Remove the results panel
    generatedContentDiv.remove();
    customLog("debug", "[generated] closed UI");
  }

  // 4) Reset flags and timers
  generatedUIOpen = false;
  isStreamingText = false;
  isAudioPlaying = false;
  clearPostGenerateTimer();
}

// =========================
// Instruction popup helpers
// =========================
function showInstructionPopupFor(mode) {
  customLog("debug", "showInstructionPopupFor:", mode);
  const instructionsPopup = document.getElementById("instructionPopup");
  if (!instructionsPopup) { customLog("warning", "Instruction popup not found"); return; }
  if (mode === MODES.DRIFT) instructionsPopup.innerHTML = driftText;
  else if (mode === MODES.GENERATIVE) instructionsPopup.innerHTML = generativeText;
  else instructionsPopup.innerHTML = normalText;
  instructionsPopup.classList.add("visible");
}
function hideInstructionPopup() {
  if (currentMode === MODES.DRIFT) return; // keep visible in drift
  const instructionsPopup = document.getElementById("instructionPopup");
  if (instructionsPopup) instructionsPopup.classList.remove("visible");
}

// =========================
// Reverse geocoding & helpers
// =========================
async function reverseGeocode(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "N/A";
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  try {
    const response = await fetch(url);
    const reverseGeocodeData = await response.json();
    customLog("debug", "reverseGeocode results:", reverseGeocodeData);
    return reverseGeocodeData.display_name || "N/A";
  } catch (error) {
    customLog("error", "Error fetching location name:", error);
    return "N/A";
  }
}

function constructHistoricalDate() {
  let historicalDate = userGeneratedData.date;
  historicalDate.setFullYear(new Date().getFullYear() - 1);
  customLog("debug", "preformatted historical date:", historicalDate);
  let formattedDate = Math.floor(historicalDate.getTime() / 1000);
  customLog("debug", "Historical date unix timestamp:", formattedDate);
  return formattedDate;
}

async function getWaterDistanceData(lat, lon) {
  const url = routingPrefix + "/waterdistance"; // your Node endpoint
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon }),
    });

    const data = await response.json();
    customLog("debug", "waterDistance raw:", data);

    // Normalise shape so downstream code is safe
    const normalised = {
      inland_water: {
        closest_point: {
          lat: Number(data?.inland_water?.closest_point?.lat ?? NaN),
          lon: Number(data?.inland_water?.closest_point?.lon ?? NaN),
        },
        display_name: "",
      },
      coastal_water: {
        closest_point: {
          lat: Number(data?.coastal_water?.closest_point?.lat ?? NaN),
          lon: Number(data?.coastal_water?.closest_point?.lon ?? NaN),
        },
        display_name: "",
      },
    };

    // Helper: reverse geocode only if we have valid coords
    const revIfValid = async (pt) => {
      if (Number.isFinite(pt.lat) && Number.isFinite(pt.lon)) {
        return await reverseGeocode(pt.lat, pt.lon);
      }
      return "N/A";
    };

    // Try to enrich names; fall back to "N/A" if we can't
    normalised.inland_water.display_name = await revIfValid(normalised.inland_water.closest_point);
    normalised.coastal_water.display_name = await revIfValid(normalised.coastal_water.closest_point);

    userGeneratedData.waterDistance = normalised;
    customLog("debug", "waterDistance enriched:", userGeneratedData.waterDistance);
  } catch (error) {
    customLog("error", "getWaterDistanceData error:", error);

    // Ensure we still leave a safe, predictable structure
    userGeneratedData.waterDistance = {
      inland_water: { closest_point: { lat: NaN, lon: NaN }, display_name: "N/A" },
      coastal_water: { closest_point: { lat: NaN, lon: NaN }, display_name: "N/A" },
    };
  }
}

function calculateClimateVariance(weatherData) {
  customLog("debug", "calculateClimateVariance start");
  const currentYear = new Date().getFullYear();
  const yearsIntoFuture = userGeneratedData.date.getFullYear() - currentYear;
  const maxVariance = 0.15; // 15%
  const minVariance = 0.02; // 2%
  const varianceFactor = Math.min(yearsIntoFuture * minVariance, maxVariance);
  const variance = 1 + (Math.random() - 0.5) * varianceFactor;

  userGeneratedData.temperature = (weatherData.data[0].temp * variance).toFixed(2);
  userGeneratedData.humidity = (weatherData.data[0].humidity * variance).toFixed(2);
  userGeneratedData.pressure = (weatherData.data[0].pressure * variance).toFixed(2);
  userGeneratedData.windSpeed = (weatherData.data[0].wind_speed * variance).toFixed(2);

  customLog("debug", "variance outputs:", {
    temperature: userGeneratedData.temperature,
    humidity: userGeneratedData.humidity,
    pressure: userGeneratedData.pressure,
    windSpeed: userGeneratedData.windSpeed,
  });

  return {
    temperature: userGeneratedData.temperature,
    humidity: userGeneratedData.humidity,
    pressure: userGeneratedData.pressure,
    windSpeed: userGeneratedData.windSpeed,
  };
}

// =========================
// Map interactions
// =========================
map.on("contextmenu", async function (event) {
  if (currentMode !== MODES.NORMAL && currentMode !== MODES.GENERATIVE) return;
  handleMapClick(event.latlng);
});

let touchTimeout;
map.on("touchstart", function (event) {
  if (currentMode !== MODES.NORMAL && currentMode !== MODES.GENERATIVE) return;
  touchTimeout = setTimeout(() => { handleMapClick(event.latlng); }, 200);
});
map.on("touchend", function () {
  if (currentMode !== MODES.NORMAL && currentMode !== MODES.GENERATIVE) return;
  clearTimeout(touchTimeout);
});

async function handleMapClick(latlng) {
  customLog("debug", "handleMapClick", latlng);
  hideInstructionPopup();

  // Remove any existing markers from the map.
  try {
    map.eachLayer(function (layer) { if (layer instanceof L.Marker) map.removeLayer(layer); });
  } catch {}

  mapChoicelatlng = latlng;
  const lat = mapChoicelatlng.lat;
  const lon = mapChoicelatlng.lng;
  centerMarkerInView(mapChoicelatlng);

  const marker = L.marker(mapChoicelatlng, {
    title: "Temporary Marker",
    alt: "Temporary Marker",
    draggable: true,
    closeOnClick: false,
  }).addTo(map);

  marker
    .bindPopup("<div id='check_location_bubble' class='main_text_medium'>Checking your chosen location. <br><br>Please wait.<br><br></div>", {
      autoClose: false,
      closeOnClick: false,
    })
    .openPopup();

  // Spinner
  const birdImageUrl = `${routingPrefix}/images/bird-cells-new.svg`;
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
  if (checkLocationBubble) checkLocationBubble.appendChild(spinnerContainer);
  const birdElem = spinnerContainer.querySelector(".bird");
  if (birdElem) birdElem.style.backgroundImage = `url('${birdImageUrl}')`;
  document.documentElement.style.setProperty("--bird-loader-bird-filter", "invert(0)");

  // Async tasks
  const isInAusPromise = getisInAustralia(lat, lon);
  const locationNamePromise = reverseGeocode(lat, lon);
  getWaterDistanceData(lat, lon);

  const isInAustralia = await isInAusPromise;
  if (!isInAustralia) {
    marker.bindPopup("<div class='main_text_medium' id='error_bubble'>The selected point is not in Australia.  <br>Please select a point on any Australian territory.</div>").openPopup();

    const closeAll = () => {
      try { marker.closePopup(); } catch {}
      try { map.removeLayer(marker); } catch {}
      showInstructionPopupFor(MODES.GENERATIVE);
      clearUserPresenceTimer();
      startUserPresenceTimer("not-in-aus closed");
    };
    const tempCloser = () => { document.removeEventListener("click", tempCloser, true); closeAll(); };
    document.addEventListener("click", tempCloser, true);
    setTimeout(() => { document.removeEventListener("click", tempCloser, true); closeAll(); }, 3000);
    return;
  }

  const locationName = await locationNamePromise;
  userGeneratedData.locationName = locationName;
  userGeneratedData.lat = lat;
  userGeneratedData.lon = lon;

  const popupContent = document.createElement("div");
  popupContent.id = "popup_bubble";
  const locationDiv = document.createElement("div");
  locationDiv.id = "location-display";
  locationDiv.className = "main_text_small";
  locationDiv.innerHTML = `<span class="main_text_medium_bold">Simulation location:</span><br> ${locationName}`;
  popupContent.appendChild(locationDiv);

  marker.setPopupContent(popupContent);
  marker.openPopup();

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
      // Close Leaflet popups and markers
      try {
        map.eachLayer(function (layer) { if (layer instanceof L.Marker) map.removeLayer(layer); });
      } catch {}
    },
  });

  marker.on("popupclose", async function () {
    const containerElement = document.getElementById("popup_bubble");
    if (containerElement) while (containerElement.firstChild) containerElement.removeChild(containerElement.firstChild);
    try { map.removeLayer(marker); } catch {}
    userGeneratedData.locationName = "";
    userGeneratedData.lat = 0;
    userGeneratedData.lon = 0;
  });

  async function fetchWeatherData() {
    customLog("debug", "fetchWeatherData start");
    let altered_date = constructHistoricalDate();
    try {
      const response = await fetch(`${routingPrefix}/weather?lat=${lat}&lon=${lon}&date=${altered_date}`);
      const data = await response.json();
      customLog("debug", "weatherData:", data);
      return data;
    } catch (error) {
      customLog("error", "Error fetching weather data:", error);
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
      onWeatherDataAdjusted();
    }
  }
}

// =========================
// Generation & streaming
// =========================
async function callGenerateWithGradio(lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year) {
  try {
    const response = await fetch(routingPrefix + "/generateAudio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year }),
    });
    if (!response.ok) throw new Error("Network response was not ok");
    const result = await response.json();
    customLog("debug", "audio generation result:", result);
    return result.audioUrl;
  } catch (error) {
    customLog("error", "callGenerateWithGradio error:", error);
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

  if (!audioUrl) {
    customLog("error", "No audioUrl returned from generator");
    // resume presence to avoid dead state
    isAudioPlaying = false;
    isStreamingText = false;
    clearUserPresenceTimer();
    startUserPresenceTimer("audio url missing");
    return;
  }

  const resultDiv = document.getElementById("resultDiv");
  if (!resultDiv) {
    customLog("warning", "resultDiv missing when attempting to load audio");
    return;
  }

  // We'll buffer off-DOM, then swap into the UI once ready
  const audioEl = document.createElement("audio");
  audioEl.id = "audioPlayer";
  audioEl.controls = true;           // Keep controls visible
  audioEl.autoplay = true;           // Try autoplay
  audioEl.setAttribute("playsinline", ""); // iOS inline playback
  audioEl.preload = "auto";
  audioEl.src = audioUrl;

  const spinner = document.getElementById("audioSpinnerContainer");

  const removeSpinner = () => {
    try { spinner?.remove(); } catch {}
  };

  // Helper: robust autoplay attempt
  const tryPlay = () => {
    const p = audioEl.play();
    if (p && typeof p.then === "function") {
      p.catch((err) => {
        // Common on iOS if it thinks there wasn't a user gesture
        customLog("warning", "Autoplay was blocked, waiting for a tap to play.", err);
        // One-time user gesture handler to trigger play
        const nudge = () => {
          audioEl.play().catch(() => {}); // best effort
          document.removeEventListener("touchend", nudge, true);
          document.removeEventListener("click", nudge, true);
        };
        document.addEventListener("touchend", nudge, true);
        document.addEventListener("click", nudge, true);
      });
    }
  };

  // When enough is buffered to start playing
  const onCanPlay = () => {
    audioEl.removeEventListener("canplay", onCanPlay);
    removeSpinner();

    // Swap into the UI NOW (player only arrives when ready)
    resultDiv.appendChild(audioEl);
    resultDiv.scrollTop = resultDiv.scrollHeight;

    // Update flags and start playback
    isStreamingText = false;     // text stream might still be going, but audio is independent
    isAudioPlaying = true;
    tryPlay();

    // When the audio ends, start post-generate timer and presence timer
    audioEl.addEventListener("ended", () => {
      isAudioPlaying = false;
      clearPostGenerateTimer();
      postGenerateTimerId = setTimeout(() => {
        if (generatedUIOpen) {
          closeGeneratedContentIfOpen();
          showInstructionPopupFor(MODES.GENERATIVE);
          clearUserPresenceTimer();
          startUserPresenceTimer("post-generate auto close");
        }
      }, postGenerateWaitMs);

      clearUserPresenceTimer();
      startUserPresenceTimer("audio ended");
    }, { once: true });
  };

  const onError = (err) => {
    removeSpinner();
    customLog("error", "Audio load error:", err);
    isAudioPlaying = false;
    isStreamingText = false;
    clearUserPresenceTimer();
    startUserPresenceTimer("audio error");
  };

  // Wire events BEFORE setting src (already set above; safe to add now)
  audioEl.addEventListener("canplay", onCanPlay, { once: true });
  audioEl.addEventListener("error", onError, { once: true });

  // Don’t append audioEl yet. We only append in onCanPlay.
}

async function fetchDataAndDisplay() {
  customLog("debug", "fetchDataAndDisplay userGeneratedData:", userGeneratedData);
  textGenerationComplete = false;

  // Ensure old content is gone
  closeGeneratedContentIfOpen();

  const generatedContentDiv = document.createElement("div");
  generatedContentDiv.id = "resultDiv";
  generatedContentDiv.innerHTML = '<button id="closeBtn" style="position: absolute; top: 10px; right: 10px;">&times;</button><p id="streamedText"></p>';
  document.body.appendChild(generatedContentDiv);

  generatedUIOpen = true;
  isStreamingText = true;
  clearUserPresenceTimer(); // pause presence while streaming / audio

  const birdImageUrl = `${routingPrefix}/images/bird-cells-new.svg`;
  const spinnerContainer = document.createElement("div");
  spinnerContainer.id = "audioSpinnerContainer";
  spinnerContainer.innerHTML = `
    <div class="bird-loader-wrapper">
      <div class="bird-loader">
        <div class="orbit">
          <div class="bird"></div>
        </div>
      </div>
    </div>`;
  generatedContentDiv.appendChild(spinnerContainer);
  const birdElem = spinnerContainer.querySelector(".bird");
  if (birdElem) birdElem.style.backgroundImage = `url('${birdImageUrl}')`;
  document.documentElement.style.setProperty("--bird-loader-bird-filter", "invert(1)");

  try {
    const response = await fetch(routingPrefix + "/generate-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userInput: JSON.stringify(userGeneratedData) }),
    });
    if (!response.ok) throw new Error("Network response was not ok");

    loadAudio();

    const streamedText = document.getElementById("streamedText");
    const closeBtn = document.getElementById("closeBtn");

    closeBtn.addEventListener("click", () => {
      closeGeneratedContentIfOpen();
      showInstructionPopupFor(MODES.GENERATIVE);
      clearUserPresenceTimer();
      startUserPresenceTimer("user closed generated");
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let resultText = "";
    let firstPRemoved = false;
    let firstClosePRemoved = false;

    reader.read().then(function processText({ done, value }) {
      if (done) {
        customLog("debug", "Stream complete");
        streamedText.innerHTML = resultText;
        textGenerationComplete = true;
        const ap = document.getElementById("audioPlayer");
        if (ap) {
          ap.play().catch(()=>{});
          isStreamingText = false;
          isAudioPlaying = true;
          ap.addEventListener("ended", () => {
            isAudioPlaying = false;
            // start post-generate auto-close timer
            clearPostGenerateTimer();
            postGenerateTimerId = setTimeout(() => {
              if (generatedUIOpen) {
                closeGeneratedContentIfOpen();
                showInstructionPopupFor(MODES.GENERATIVE);
                clearUserPresenceTimer();
                startUserPresenceTimer("post-generate auto close");
              }
            }, postGenerateWaitMs);

            clearUserPresenceTimer();
            startUserPresenceTimer("audio ended");
          }, { once: true });
        } else {
          isStreamingText = false;
          clearUserPresenceTimer();
          startUserPresenceTimer("streamed no audio");
        }
        return;
      }

      let chunkStr = decoder.decode(value, { stream: true });
      resultText += chunkStr;

      if (!firstPRemoved) {
        const newResultText = resultText.replace("<p>", "");
        if (newResultText !== resultText) { firstPRemoved = true; resultText = newResultText; }
      }
      if (!firstClosePRemoved) {
        const newResultText = resultText.replace("</p>", "");
        if (newResultText !== resultText) { firstClosePRemoved = true; resultText = newResultText; }
      }

      streamedText.innerHTML = resultText;
      reader.read().then(processText);
    });
  } catch (error) {
    customLog("error", "Failed to fetch response:", error);
    // resume presence to avoid dead state
    isStreamingText = false;
    clearUserPresenceTimer();
    startUserPresenceTimer("text fetch error");
  }
}

// =========================
// DRIFT implementation
// =========================
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

    const dateParts = (jsonData.dateName || "").split(" ");
    const time24 = dateParts[0] || "00:00:00";
    const dayName = dateParts[1] || "";
    const dateNumber = dateParts[2] || "";
    const monthName = dateParts[3] || "";
    const year = dateParts[4] || "";
    const time12 = convertTimeTo12Hour(time24);

    const shortDisplayName = wrapTextAtWhitespace(jsonData.display_name || "Unknown", 70);
    const items = [
      { title: "Location: ", text: shortDisplayName },
      { title: "Year: ", text: year },
      { title: "Date: ", text: `${dayName} ${monthName} ${dateNumber} ${time12}` },
      { title: "Temperature: ", text: (jsonData.main?.temp ?? "-") + "°C" },
      { title: "Humidity: ", text: Math.min(jsonData.main?.humidity ?? 0, 100) + "%" },
      { title: "Pressure: ", text: Math.min(jsonData.main?.pressure ?? 0, 1084) + "hPa" },
      { title: "Wind Speed: ", text: (jsonData.wind?.speed ?? "-") + "km/h" },
    ];

    const flyoverMasterContainer = document.createElement("div");
    flyoverMasterContainer.className = "flyoverMasterContainer";

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

    const flyoverMaxWidth = window.innerWidth * 0.75;
    marker = L.marker([jsonData.coord.lat, jsonData.coord.lon], { autoClose: false, closeOnClick: false })
      .bindPopup(flyoverMasterContainer, { minWidth: 0, maxWidth: flyoverMaxWidth });
    marker.addTo(map);
  } catch (error) {
    customLog("error", "Error loading DRIFT JSON:", error);
    marker = null;
  }

  driftAudio[playerIndex].src = audioUrl;
  driftAudio[playerIndex].load();

  try { await driftAudio[playerIndex].play(); } catch (error) { customLog("error", "DRIFT audio play error:", error); }
  return marker;
}

function flyToWithOffset(latlng, zoom, flyDuration, panDuration) {
  return new Promise((resolve) => {
    map.flyTo(latlng, zoom, { duration: flyDuration });
    map.once("moveend", () => {
      const size = map.getSize();
      const desiredPoint = L.point(size.x * 0.4, size.y * 0.05);
      const markerPoint = map.latLngToContainerPoint(latlng);
      const offset = desiredPoint.subtract(markerPoint);
      map.panBy(offset, { animate: true, duration: panDuration });
      map.once("moveend", () => resolve());
    });
  });
}

function scheduleNext() {
  const crossfadeStartTime = (driftConfig.fileDuration - driftConfig.crossfade) * 1000;
  crossfadeTimeoutId = setTimeout(async () => {
    const nextPlayer = (currentPlayer + 1) % 2;
    const newMarker = await loadAndPlayNext(nextPlayer);

    if (currentMarker) currentMarker.closePopup();

    let flyPromise = null;
    if (newMarker) flyPromise = flyToWithOffset(newMarker.getLatLng(), 11, driftConfig.crossfade - 1.5, 1.5);

    const fadeSteps = 20;
    const stepTime = (driftConfig.crossfade * 1000) / fadeSteps;
    let currentStep = 0;
    fadeIntervalId = setInterval(() => {
      currentStep++;
      driftAudio[currentPlayer].volume = Math.max(0, 1 - currentStep / fadeSteps);
      driftAudio[nextPlayer].volume = Math.min(1, currentStep / fadeSteps);
      if (currentStep >= fadeSteps) {
        clearInterval(fadeIntervalId);
        try { driftAudio[currentPlayer].pause(); driftAudio[currentPlayer].currentTime = 0; } catch {}
        currentPlayer = nextPlayer;
        scheduleNext();
      }
    }, stepTime);

    if (flyPromise) {
      await flyPromise;
      if (currentMarker) { try { map.removeLayer(currentMarker); } catch {} }
      currentMarker = newMarker;
      try { newMarker.openPopup(); } catch {}
    }
  }, crossfadeStartTime);
}

async function startDriftMode() {
  driftActive = true;
  closeGeneratedContentIfOpen();
  showInstructionPopupFor(MODES.DRIFT);

  currentPlayer = 0;
  currentMarker = await loadAndPlayNext(currentPlayer);
  if (currentMarker) {
    await flyToWithOffset(currentMarker.getLatLng(), 12, 1, 0.5);
    try { currentMarker.openPopup(); } catch {}
  }
  scheduleNext();
}

function stopDriftMode() {
  driftActive = false;
  document.body.classList.remove("drift-mode");
  customLog("debug", "Drift mode deactivated");
  if (crossfadeTimeoutId) clearTimeout(crossfadeTimeoutId);
  if (fadeIntervalId) clearInterval(fadeIntervalId);
  driftAudio.forEach((audio) => { try { audio.pause(); audio.currentTime = 0; } catch {} });
  if (currentMarker) { try { map.removeLayer(currentMarker); } catch {} currentMarker = null; }
}

// =========================
// Utilities
// =========================
async function loadConfig() {
  try {
    const response = await fetch(`${routingPrefix}/config.json`);
    if (!response.ok) throw new Error(`Failed to load config: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    customLog("error", "Error loading config:", error);
    return null;
  }
}

function showInstructionPopup() { // kept for backwards compatibility, routes to currentMode
  showInstructionPopupFor(currentMode);
}

function hideInstructionPopupLegacy() { // not used; kept to avoid breaking imports
  hideInstructionPopup();
}

async function getisInAustralia(lat, lon) {
  const url = routingPrefix + "/isInAustralia";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon }),
    });
    const data = await response.json();
    customLog("debug", "isInAustralia:", data);
    return !!data;
  } catch (error) {
    customLog("error", "isInAustralia error:", error);
  }
}

function centerMarkerInView(latlngIn) {
  customLog("debug", "centerMarkerInView start");
  const mapSize = map.getSize();
  const markerPoint = map.latLngToContainerPoint(latlngIn);
  let desiredPoint;
  if (mapSize.x > 1280) desiredPoint = L.point(mapSize.x / 2, mapSize.y * 0.85);
  else if (mapSize.x > 800) desiredPoint = L.point(mapSize.x / 2, mapSize.y * 0.9);
  else desiredPoint = L.point(mapSize.x / 2, mapSize.y * 0.95);
  const offsetX = desiredPoint.x - markerPoint.x;
  const offsetY = desiredPoint.y - markerPoint.y;
  const offset = L.point(-offsetX, -offsetY);
  map.panBy(offset, { animate: false, duration: 1 });
}

function customLog(logLevel, ...messages) {
  const levels = ["silent", "error", "warning", "info", "debug", "verbose"];
  const currentLevelIndex = levels.indexOf(globalLogLevel);
  const messageLevelIndex = levels.indexOf(logLevel);

  if (messageLevelIndex <= currentLevelIndex && currentLevelIndex !== 0) {
    if (logLevel === "error") console.error(...messages);
    else if (logLevel === "warning") console.warn(...messages);
    else if (logLevel === "info") console.info(...messages);
    else console.log(...messages);
  }
}

function wrapTextAtWhitespace(text, maxLength) {
  if (!text || text.length <= maxLength) return text || "";
  let result = "";
  let remainingText = text;
  while (remainingText.length > maxLength) {
    let breakpoint = remainingText.lastIndexOf(",", maxLength);
    if (breakpoint === -1) breakpoint = maxLength;
    result += remainingText.substring(0, breakpoint) + "<br>";
    remainingText = remainingText.substring(breakpoint + 1);
  }
  result += remainingText;
  return result;
}

function convertTimeTo12Hour(timeStr) {
  const [hourStr, minuteStr] = (timeStr || "00:00").split(":");
  let hour = parseInt(hourStr || "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12; if (hour === 0) hour = 12;
  return `${hour}:${minuteStr || "00"} ${ampm}`;
}

function getRandomFileNumber() {
  if (playedFiles.size >= driftConfig.totalFiles) playedFiles.clear();
  let fileNumber;
  do { fileNumber = Math.floor(Math.random() * driftConfig.totalFiles) + 1; } while (playedFiles.has(fileNumber));
  playedFiles.add(fileNumber);
  return fileNumber;
}

function formatFileNumber(num) { return String(num).padStart(4, "0"); }

async function controlHuggingFaceServer(command) {
  try {
    const response = await fetch(`${routingPrefix}/hug_space_control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    if (!response.ok) throw new Error("Network response was not ok");
    const result = await response.json();
    customLog("debug", "HF control result:", result);
    return result.status;
  } catch (error) {
    customLog("error", "HF control error:", error);
    throw error;
  }
}

function detectTouchDevice() {
  const hasTouchSupport =
    "ontouchstart" in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  if (hasTouchSupport || isCoarsePointer) {
    document.body.classList.add("touch-device");
    customLog("info", "Touch device detected");
    hasTouch = true;
    return true;
  }
  customLog("info", "Touch device not detected");
  hasTouch = false;
  return false;
}
