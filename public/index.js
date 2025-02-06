function showInstructionPopup() {
  const popup = document.getElementById("instructionPopup");
  if (popup) {
    popup.classList.add("visible");
  }
}

// Function to hide the instruction popup (by removing the CSS class)
function hideInstructionPopup() {
  const popup = document.getElementById("instructionPopup");
  if (popup) {
    popup.classList.remove("visible");
  }
}

// A timeout variable that will be used to trigger the popup after 45 seconds
let instructionTimeout;

// Function to reset the timeout and hide the popup immediately on interaction
function resetInstructionTimeout() {
  hideInstructionPopup();
  clearTimeout(instructionTimeout);
  // Restart the timer: after 45 seconds of inactivity, show the popup
  instructionTimeout = setTimeout(() => {
    showInstructionPopup();
  }, 4000);
}

// Attach event listeners for various interactions
["mousemove", "mousedown", "touchstart", "click"].forEach(evt => {
  document.addEventListener(evt, resetInstructionTimeout);
});

// Show the popup when the page loads
document.addEventListener("DOMContentLoaded", function () {
  showInstructionPopup();
  resetInstructionTimeout();
});



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
// const map = L.map("map", {center: [-25.2744, 133.7751], zoom: 4,});
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const map = L.map("map", { zoomControl: true }).setView([-24.801233, 132.94551], 5);

map.fitBounds([
  [-10, 112],
  [-44, 154],
]);

const tiles = L.tileLayer(tileUrl, { attribution });
tiles.addTo(map);


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
  // Remove any existing markers from the map.
  map.eachLayer(function (layer) {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  // Get the coordinates for the new marker.
 mapChoicelatlng = event.latlng;
  const lat = mapChoicelatlng.lat;
  const lon = mapChoicelatlng.lng;
  centerMarkerInView(mapChoicelatlng);

  // Create a new marker.
  const marker = L.marker(mapChoicelatlng, {
    title: "Temporary Marker",
    alt: "Temporary Marker",
    draggable: true,
  }).addTo(map);


  // Immediately bind a loading message.
  marker.bindPopup("<div class='loading-popup-text'>Checking your location. <br>Please wait.<br></div><div class='loader'></div>").openPopup();

  // Launch all asynchronous tasks concurrently.
  const isInAusPromise = getisInAustralia(lat, lon);
  const locationNamePromise = reverseGeocode(lat, lon);
  const waterDistancePromise = getWaterDistanceData(lat, lon);

  // Wait for the Australia check.
  const isInAustralia = await isInAusPromise;

  if (!isInAustralia) {
    // If the point is not in Australia, update the popup with an error message.
    marker.bindPopup("<div class='loading-popup-text' id='error_bubble'>The selected point is not in Australia.  <br>Please select a point on any Australian territory.</div>").openPopup();

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
  const waterDistance = await waterDistancePromise;

  // Update your user data.
  userGeneratedData.locationName = locationName;
  userGeneratedData.lat = lat;
  userGeneratedData.lon = lon;
  userGeneratedData.waterDistance = waterDistance; // if needed

  // Create new popup content.
  // The container (with id "popup_bubble") will also hold the date picker.
  const popupContent = document.createElement("div");
  popupContent.id = "popup_bubble";

  const locationDiv = document.createElement("div");
  locationDiv.id = "location-display";
  locationDiv.innerHTML = `${locationName}<br>`;
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
});

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
    customLog("debug", "Result:", result);
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
    generatedContentDiv.id = "generated_text_div";
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
  console.time("isInAustralia");
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
      console.timeEnd("isInAustralia");
      return true;
    } else {
      customLog("debug", "User location is not in Australia");
      //lets stop the timer
      console.timeEnd("isInAustralia");
      return false;
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

function customLog(logLevel, debugMessage) {
  if (globalLogLevel != "error") {
    if (logLevel == globalLogLevel) {
      console.log(debugMessage);
    }
  } else {
    console.error(debugMessage);
  }
}

function centerMarkerInView(latlngIn) {
  console.log("centerMarkerInView start");
  const mapSize = map.getSize();
  customLog("debug", "mapSize: " + mapSize);

  const markerPoint = map.latLngToContainerPoint(latlngIn);
  customLog("debug", "markerPoint: " + markerPoint);

  // Desired container point: center horizontally, 80% down vertically.
  const desiredPoint = L.point(mapSize.x / 2, mapSize.y * 0.8);
  customLog("debug", "desiredPoint: " + desiredPoint);

  // Compute the offset needed to shift the marker to the desired container point.
  const offsetX = desiredPoint.x - markerPoint.x;
  const offsetY = desiredPoint.y - markerPoint.y;
  // Remove the negative sign here.
  const offset = L.point(-offsetX, -offsetY);

  customLog("debug", "manual offset: " + offset);

  // Pan the map by the computed offset.
  map.panBy(offset, { animate: false, duration: 1 });

}
