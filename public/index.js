let userGeneratedData = {};
const map = L.map("map", {
  center: [-25.2744, 133.7751],
  zoom: 4,
  maxBounds: [
    [-43.00311, 113.6594],
    [-10.05139, 153.6387],
  ],
  minZoom: 4,
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

    return data.display_name;
  } catch (error) {
    console.error("Error fetching location name:", error);
    return "Unknown location";
  }
}

function constructHistoricalDate(date) {
  userGeneratedData.date = date;
  const year = 2023;
  date = new Date(date);
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  //convert the date string to a date object
  let formattedDate = new Date(date);
  //convert the date into a unix timestamp in seconds
  formattedDate = formattedDate.getTime() / 1000;
  // add the date to the user generated data object

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
    console.log(userGeneratedData);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function to calculate variance based on the selected year
function calculateVariance(selectedYear, weatherData) {
  const currentYear = new Date().getFullYear();
  const yearsIntoFuture = selectedYear - currentYear;
  const maxVariance = 0.15; // 15%
  const minVariance = 0.02; // 2%
  const varianceFactor = Math.min(yearsIntoFuture * minVariance, maxVariance);
  const variance = 1 + (Math.random() - 0.5) * varianceFactor;

  //add the data to the userGeneratedData object
  userGeneratedData.temperature = weatherData.data[0].temp * variance;
  userGeneratedData.humidity = weatherData.data[0].humidity * variance;
  userGeneratedData.pressure = weatherData.data[0].pressure * variance;
  userGeneratedData.windSpeed = weatherData.data[0].wind_speed * variance; // corrected from 'pressure' to 'windSpeed'

  return {
    temperature: weatherData.data[0].temp * variance,
    humidity: weatherData.data[0].humidity * variance,
    pressure: weatherData.data[0].pressure * variance,
    windSpeed: weatherData.data[0].wind_speed * variance, // corrected from 'pressure' to 'windSpeed'
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
  const latlng = event.latlng;
  const marker = L.marker(latlng, {
    title: "Temporary Marker",
    alt: "Temporary Marker",
    draggable: true,
  }).addTo(map);
  const locationName = await reverseGeocode(latlng.lat, latlng.lng);
  getWaterDistanceData(latlng.lat, latlng.lng);
  userGeneratedData = {};
  userGeneratedData.locationName = locationName;
  userGeneratedData.lat = latlng.lat;
  userGeneratedData.lon = latlng.lng;

  // Popup content with date, time, and weather condition selectors
  const popupContent = `
        <div>
            <strong>Location:</strong> ${locationName}<br>
            <label for="date">Date:</label>
            <input type="text" id="date" class="flatpickr" data-enable-time="true"><br>
            <label for="temperature">Temperature:</label>
            <input type="number" id="temperature" step="0.01"><br>
            <label for="humidity">Humidity:</label>
            <input type="number" id="humidity" step="1" min="0" max="100"><br>
            <label for="pressure">Pressure:</label>
            <input type="number" id="pressure" step="1"><br>
            <label for="windSpeed">Wind Speed:</label>
            <input type="number" id="windSpeed" step="0.01"><br>
            <button id="confirmBtn">Confirm</button>
        </div>
    `;

  marker.bindPopup(popupContent).openPopup();

  // Initialize flatpickr for date selection
  flatpickr("#date", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    minDate: "today",
    maxDate: new Date().fp_incr(365 * 20), // 20 years from now
    plugins: [new confirmDatePlugin({ confirmText: "Confirm date and time" })], // customize confirm button text
    onChange: function (dateStr) {
      //calculate the the day of the year between 1 and 365
      function getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const day = Math.floor(diff / oneDay);
        return day;
      }
      const selectedDate = new Date(dateStr);
      const day_of_year = getDayOfYear(selectedDate);
      userGeneratedData.day_of_year = day_of_year;

      //calculate the minute of the day between 0 and 1440
      const minutes_of_day = new Date(dateStr).getHours() * 60 + new Date(dateStr).getMinutes();
      userGeneratedData.minutes_of_day = minutes_of_day;
      // this function will be called when the date is confirmed
      fillSuggestedWeatherData(dateStr);
    },
  });
  async function fetchWeatherData(latlng, date) {
    altered_date = constructHistoricalDate(date);
    try {
      const response = await fetch(`/weather?lat=${latlng.lat}&lon=${latlng.lng}&date=${altered_date}`);
      const data = await response.json();
      console.log(data);
      return data;
    } catch (error) {
      console.error("Error fetching weather data from server:", error);
      return null;
    }
  }
  async function fillSuggestedWeatherData(selectedDate) {
    const weatherData = await fetchWeatherData(latlng, selectedDate);
    if (weatherData) {
      const selectedYear = new Date(selectedDate).getFullYear();

      const weatherVariance = calculateVariance(selectedYear, weatherData);
      document.getElementById("temperature").value = weatherVariance.temperature;
      document.getElementById("humidity").value = weatherVariance.humidity;
      document.getElementById("pressure").value = weatherVariance.pressure;
      document.getElementById("windSpeed").value = weatherVariance.windSpeed;
    }
  }
  // Event listener for confirm button to handle user input
  document.getElementById("confirmBtn").addEventListener("click", async () => {
    //close the popup
    marker.closePopup();
    fetchDataAndDisplay();
  });
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

// Include flatpickr CSS
//import 'flatpickr/dist/flatpickr.min.css';
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
    // loadAudio();

    const streamedText = document.getElementById("streamedText");
    const closeBtn = document.getElementById("closeBtn");
    //clear all map markers

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

getWaterDistanceData();
