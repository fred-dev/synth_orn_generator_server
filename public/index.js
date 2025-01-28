import { initCustomDatePicker } from "./customDatePicker.js";

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
let mapChoicelatlng = null;
console.log(userGeneratedData);
const map = L.map("map", {
  center: [-25.2744, 133.7751],
  zoom: 4,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Function to perform reverse geocoding
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    //add the data to the userGeneratedData object
    console.log("reverseGeocode results: " + JSON.stringify(data));

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
  console.log("preformated historical date: " + historicalDate);
  //convert the date to a unix timestamp in seconds
  let formattedDate = historicalDate.getTime() / 1000;
  //remove any decimal places from the formatted date
  formattedDate = Math.floor(formattedDate);
  console.log("Historical date unix timestamp: " + formattedDate);

  return formattedDate;
}

async function getWaterDistanceData(lat, lon) {
  const url = "/waterdistance"; // Relative URL for your Node.js server endpoint

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
    console.log(userGeneratedData);
    userGeneratedData.waterDistance.inland_water.display_name = await reverseGeocode(
      userGeneratedData.waterDistance.inland_water.closest_point.lat,
      userGeneratedData.waterDistance.inland_water.closest_point.lon
    );
    userGeneratedData.waterDistance.coastal_water.display_name = await reverseGeocode(
      userGeneratedData.waterDistance.coastal_water.closest_point.lat,
      userGeneratedData.waterDistance.coastal_water.closest_point.lon
    );
    console.log("getWaterDistanceData" + userGeneratedData);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function to calculate variance based on the selected year
function calculateClimateVariance(weatherData) {
  console.log("calculateClimateVariance start");
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

  console.log("calculateClimateVariance temperature: " + userGeneratedData.temperature);
  console.log("calculateClimateVariance humidity: " + userGeneratedData.humidity);
  console.log("calculateClimateVariance pressure: " + userGeneratedData.pressure);
  console.log("calculateClimateVariance windSpeed: " + userGeneratedData.windSpeed);

  return {
    temperature: (weatherData.data[0].temp * variance).toFixed(2),
    humidity: (weatherData.data[0].humidity * variance).toFixed(2),
    pressure: (weatherData.data[0].pressure * variance).toFixed(2),
    windSpeed: (weatherData.data[0].wind_speed * variance).toFixed(2),
  };
}

// Right-click event for creating a new marker
map.on("contextmenu", async function (event) {
  //let's remove the existing markers
  map.eachLayer(function (layer) {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
  mapChoicelatlng = event.latlng;

  const marker = L.marker(mapChoicelatlng, {
    title: "Temporary Marker",
    alt: "Temporary Marker",
    draggable: true,
  }).addTo(map);
  const locationName = await reverseGeocode(mapChoicelatlng.lat, mapChoicelatlng.lng);
  getWaterDistanceData(mapChoicelatlng.lat, mapChoicelatlng.lng);
  userGeneratedData.locationName = locationName;
  userGeneratedData.lat = mapChoicelatlng.lat;
  userGeneratedData.lon = mapChoicelatlng.lng;

  //lets create a new div to add to the popup
  const popupContent = document.createElement("div");
  popupContent.id = "popup_bubble";
  const locationDiv = document.createElement("div");
  locationDiv.innerHTML = ` ${locationName}<br>`;
  locationDiv.id = "location-display";
  popupContent.appendChild(locationDiv);

  marker.bindPopup(popupContent);

  // Listen for when the popup is actually opened
  marker.on("popupopen", () => {
    initCustomDatePicker({
      containerId: "popup_bubble",
      userGeneratedData,
      onDateSelectionComplete: (finalDate) => {
        console.log("Final date/time chosen:", finalDate);
        fillSuggestedWeatherData(userGeneratedData.date);
      },
      onWeatherSelectionComplete: (finalWeather) => {
        console.log("Final weather chosen:", finalWeather);
        fetchDataAndDisplay();
      },
    });
  });
  marker.on("popupclose", async function (event) {
    //lets remove the marker
    map.removeLayer(marker);
    //lets remove the location name
    userGeneratedData.locationName = "";
    //lets remove the lat and lon
    userGeneratedData.lat = 0;
    userGeneratedData.lon = 0;
    //lets remove the water distance data
  });

  // Finally, open it
  marker.openPopup();

  async function fetchWeatherData() {
    console.log("fetchWeatherData start");
    let altered_date = constructHistoricalDate();
    try {
      const response = await fetch(`/weather?lat=${mapChoicelatlng.lat}&lon=${mapChoicelatlng.lng}&date=${altered_date}`);
      const data = await response.json();
      //print the response to the console serialissed
      console.log("fetchWeatherData recieved response" + JSON.stringify(data));
      return data;
    } catch (error) {
      console.error("Error fetching weather data from server:", error);
      return null;
    }
  }
  async function fillSuggestedWeatherData() {
    console.log("fillSuggestedWeatherData start");
    const weatherData = await fetchWeatherData();
    if (weatherData) {
      const selectedYear = userGeneratedData.date.getFullYear();

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
    const response = await fetch("/generateAudio", {
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
    console.log("Result:", result);
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
    const response = await fetch("/generate-text", {
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
    const resultDiv = document.createElement("div");
    resultDiv.id = "resultDiv";
    resultDiv.style.backgroundColor = "black";
    resultDiv.style.color = "white";
    resultDiv.style.position = "absolute";
    resultDiv.style.top = "50%";
    resultDiv.style.left = "50%";
    resultDiv.style.transform = "translate(-50%, -50%)";
    resultDiv.style.padding = "40px";
    resultDiv.style.borderRadius = "10px";
    resultDiv.style.zIndex = "1000";
    resultDiv.style.width = "60%";
    resultDiv.style.display = "flex";
    resultDiv.style.flexDirection = "column";
    resultDiv.style.justifyContent = "center"; // Vertically center content
    resultDiv.style.alignItems = "flex-start"; // Start text from left side
    resultDiv.style.textAlign = "left"; // Align text to the left within the flex item
    resultDiv.style.fontSize = "32px";
    resultDiv.innerHTML = '<p id="streamedText">Loading...</p><button id="closeBtn">Close</button>';

    document.body.appendChild(resultDiv);
    loadAudio();

    const streamedText = document.getElementById("streamedText");
    const closeBtn = document.getElementById("closeBtn");

    closeBtn.addEventListener("click", () => {
      resultDiv.remove();
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
        console.log("Stream complete");
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
