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

const tiles = L.tileLayer(tileUrl, { attribution });
tiles.addTo(map);

let firstLoad = true;
let instructionTimeout;

function showInstructionPopup() {
  const popup = document.getElementById("instructionPopup");
  if (popup && !popup.classList.contains("visible") && !document.getElementById("resultDiv") && !mapChoicelatlng) {
    popup.classList.add("visible");
  }
}

function hideInstructionPopup() {
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

showInstructionPopup();

setTimeout(() => {
  hideInstructionPopup();
  firstLoad = false;
  instructionTimeout = setTimeout(() => {
    showInstructionPopup();
  }, 45000);
}, 25000);

["mousemove", "mousedown", "touchstart", "touchend", "touchmove", "click"].forEach((evt) => {
  document.addEventListener(evt, resetInstructionTimeout);
});



function detectTouchDevice() {
  if ("ontouchstart" in window || (window.DocumentTouch && document instanceof DocumentTouch) || window.matchMedia("(pointer: coarse)").matches) {
    document.body.classList.add("touch-device");
    customLog("debug", "Touch device detected");
    return true;
  }
  customLog("debug", "Touch device not detected");
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
      // Use the routingPrefix as needed in your client-side code
    } catch (error) {
      customLog("error", "Failed to fetch Routing Prefix:", error);
    }
  }, 500); // 3000 milliseconds = 3 seconds
});

detectTouchDevice();

showInstructionPopup();

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
  const url = "/generate/waterdistance"; // Relative URL for your Node.js server endpoint

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
// Right-click event for creating a new marker
map.on("contextmenu", async function (event) {
  handleMapClick(event.latlng);
});

// Custom event listener for long press on mobile devices
let touchTimeout;

map.on("touchstart", function (event) {
  touchTimeout = setTimeout(() => {
    handleMapClick(event.latlng);
  }, 450); // 1 second
});

map.on("touchend", function () {
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
    .bindPopup("<div id='check_location_bubble' class='main_text_medium'>Checking your chosen location. <br> <br>Please wait.<br><br></div><div class='loader'></div>", { autoClose: false, closeOnClick: false })
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
      const response = await fetch(`/generate/weather?lat=${lat}&lon=${lon}&date=${altered_date}`);
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
    const response = await fetch("/generate/generateAudio", {
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
    audioPlayer.src = audioUrl;

    // Append the audio player to the resultDiv
    resultDiv.appendChild(audioPlayer);

    // Load and play the audio
    audioPlayer.load();
    audioPlayer.play();
  }
}

async function fetchDataAndDisplay() {
  console.log("fetchDataAndDisplay start: " + JSON.stringify(userGeneratedData, null, 2));
  try {
    // Send a POST request to the server
    const response = await fetch("/generate/generate-text", {
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
  const url = "/generate/isInAustralia"; // Relative URL for your Node.js server endpoint

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
