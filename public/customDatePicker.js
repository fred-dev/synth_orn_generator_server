// customDatePicker.js
// Minimal multi-step picker implementation using Picker.js
// Provides an init function that accepts a callback for the final date.
//prepare this so we can import it in the main.js
//import Picker from "https://cdn.jsdelivr.net/npm/pickerjs/dist/picker.min.js";

// windy.png
// cloudy.png
// drizzle_freezingdrizzle.png
// drizzle_night.png
// fog.png
// freezingrain_sleet.png
// haze.png
// heavy_rain.png
// heavy_snow.png
// night_clear_mostlyclear.png
// night_partly_cloudy.png
// partly_cloudy.png
// rain.png
// snow.png
// sunset.png
// surnise.png
// thunderstorm.png
// clear_mostlyclear.png

let currentStep = 0;
let finishCallback = null;
let containerElement = null;
let imageIconArrayDay = null;
let imageIconArrayNight = null;
imageIconArrayDay = [
  "windy.png",
  "cloudy.png",
  "drizzle_freezingdrizzle.png",
  "drizzle_night.png",
  "fog.png",
  "freezingrain_sleet.png",
  "haze.png",
  "heavy_rain.png",
  "heavy_snow.png",
  "partly_cloudy.png",
  "rain.png",
  "snow.png",
  "sunset.png",
  "surnise.png",
  "thunderstorm.png",
  "clear_mostlyclear.png",
];
imageIconArrayNight = [
  "night_clear_mostlyclear.png",
  "night_partly_cloudy.png"
];

// Selections
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth();
let selectedDay = new Date().getDate();
let selectedDayName = "";
let selectedMonthName = "";
let selectedHour = 12;
let selectedMinute = 0;
let selectedAMPM = "PM";
let dateDisplay = null;
let progressBar = null;
let progressBarFill = null;
let navButtons = null;
let backBtn = null;
let nextBtn = null;
let pickerInstructions = null;
let customPicker = null;
let customPickerContainer = null;

export function initCustomDatePicker({ containerId, onFinish }) {
  finishCallback = onFinish;
  containerElement = document.getElementById(containerId);
  // Start on step 0
  currentStep = 0;
  setupPickerUIInBubble();
  loadYearStep();
  updateUI();
}

function setupPickerUIInBubble() {
  // Find or create the container element
  if (!containerElement) {
    console.error(`Element with ID popup_bubble not found!`);
    return;
  } else {
    console.log("Element with ID popup_bubble found!");

    dateDisplay = document.createElement("div");
    dateDisplay.id = "date-display";
    dateDisplay.className = "date-display";
    dateDisplay.innerHTML = "Selected date: ";
    containerElement.appendChild(dateDisplay);

    customPickerContainer = document.createElement("div");
    customPickerContainer.id = "custom-picker";
    containerElement.appendChild(customPickerContainer);

    pickerInstructions = document.createElement("div");
    pickerInstructions.id = "picker-instructions";
    // pickerInstructions.style = "margin-bottom: 8px; font-weight: bold;";
    containerElement.appendChild(pickerInstructions);

    progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBarFill = document.createElement("div");
    progressBarFill.className = "progress-bar-fill";
    progressBarFill.id = "progress";
    progressBarFill.style.width = "0%";
    progressBar.appendChild(progressBarFill);
    containerElement.appendChild(progressBar);

    navButtons = document.createElement("div");
    navButtons.className = "nav-buttons";
    backBtn = document.createElement("button");
    backBtn.id = "back-btn";
    backBtn.disabled = true;
    backBtn.innerHTML = "Back";
    backBtn.addEventListener("click", prevStep);
    nextBtn = document.createElement("button");
    nextBtn.id = "next-btn";
    nextBtn.innerHTML = "Next";
    nextBtn.addEventListener("click", nextStep);
    navButtons.appendChild(backBtn);
    navButtons.appendChild(nextBtn);
    containerElement.appendChild(navButtons);
    //print the container element and all its children to the console
    console.log(containerElement);
  }
}
// Helper to destroy old picker
function destroyPicker() {
  customPicker;
  if (customPicker) {
    customPicker.destroy();
  }
}

// Year step
function loadYearStep() {
  console.log("loadYearStep");
  customPicker = new Picker(document.getElementById("custom-picker"), {
    inline: true,
    controls: true,
    rows: 3,
    format: "YYYY",
    increment: { year: 1 },
    date: new Date(),
    min: new Date(new Date().getFullYear(), 0, 1), // Jan 1, current year
    max: new Date(new Date().getFullYear() + 20, 11, 31), // Dec 31, 20 years from now
    pick: function (date) {
      selectedYear = date.getFullYear();
      console.log("selectedYear", selectedYear);
    },
  });
}

// Month step
function loadMonthStep() {
  customPicker = new Picker(document.getElementById("custom-picker"), {
    inline: true,
    controls: true,
    rows: 3,
    format: "MMMM",
    increment: { month: 1 },
    date: new Date(selectedYear, 0),
    pick(date) {
      selectedMonth = date.getMonth();
      selectedMonthName = getMonthName(selectedMonth);
      console.log("selectedMonth", selectedMonth);
      console.log("selectedMonthName", selectedMonthName);
    },
    // ,
    // extraOpts: {
    //   //add a min and max date
    //   min: new Date(selectedYear, 0),
    //   max: new Date(selectedYear, 11)
    // }
  });
}

// Day step
function loadDayStep() {
  customPicker = new Picker(document.getElementById("custom-picker"), {
    inline: true,
    controls: true,
    rows: 3,
    format: "D",
    increment: { day: 1 },
    date: new Date(selectedYear, selectedMonth, 1),
    pick(date) {
      selectedDay = date.getDate();
      selectedDayName = getDayName(date.getDay());
      console.log("selectedDay", selectedDay);
      console.log("selectedDayName", selectedDayName);
    },
  });
}

// Time step
function loadTimeStep() {
  console.log("loadTimeStep");
  customPicker = new Picker(document.getElementById("custom-picker"), {
    inline: true,
    controls: true,
    rows: 3,
    format: "HH:mm",
    increment: { hour: 1 },
    date: new Date(selectedYear, selectedMonth, selectedDay, 12, 0),
    pick(date) {
      selectedHour = date.getHours();
      selectedMinute = date.getMinutes();
      selectedAMPM = selectedHour >= 12 ? "PM" : "AM";
      console.log("selectedHour", selectedHour);
      console.log("selectedMinute", selectedMinute);
      console.log("selectedAMPM", selectedAMPM);
    },
  });
}

// "Next" step
function nextStep() {
  if (customPicker?.options?.pick) {
    customPicker.options.pick(customPicker.getDate());
  }

  destroyPicker();

  if (currentStep === 0) {
    currentStep = 1;
    setProgressBar(currentStep);

    loadMonthStep();
  } else if (currentStep === 1) {
    currentStep = 2;
    setProgressBar(currentStep);
    loadDayStep();
  } else if (currentStep === 2) {
    currentStep = 3;
    setProgressBar(currentStep);
    loadTimeStep();
  } else if (currentStep === 3) {
    currentStep = 4;
    setProgressBar(currentStep);
    // Final step done
    displayFinalSelection();
  } else if (currentStep === 4) {
    setProgressBar(4);
    currentStep = 5;
    finishSelection();
  }

  updateUI();
}

// "Back" step
function prevStep() {
  if (currentStep === 0) {
    return; // can't go back from year
  }
  currentStep--;
  if (currentStep === 0) {
    loadYearStep();
  } else if (currentStep === 1) {
    loadMonthStep();
  } else if (currentStep === 2) {
    loadDayStep();
  }
  updateUI();
}

// After finishing final step, call the callback
function finishSelection() {
  // Force final pick
  if (customPicker?.options?.pick) {
    customPicker.options.pick(customPicker.getDate());
  }
  const finalDate = buildFinalDate();
  if (finishCallback) {
    finishCallback(finalDate);
  }
}

// Build a proper Date from the chosen pieces
function buildFinalDate() {
  const date = new Date(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute);
  return date;
}

// Simple helper to show/hide buttons or instructions
function updateUI() {
  const instructions = document.getElementById("picker-instructions");
  if (!instructions) return;

  let msg = "";
  let accumulatedDate = "";
  switch (currentStep) {
    case 0:
      accumulatedDate = "Selected date: ";
      msg = "Select a Year";
      break;
    case 1:
      msg = "Select a Month";
      accumulatedDate = `Selected date: ${selectedYear}`;
      break;
    case 2:
      msg = "Select a Day";
      accumulatedDate = `Selected date: ${selectedMonthName} ${selectedYear}`;
      break;
    case 3:
      msg = "Select a Time";
      accumulatedDate = `Selected date: ${selectedDayName} ${selectedDay} ${selectedMonthName} ${selectedYear}`;
      break;
    case 4:
      accumulatedDate = `Selected date: ${selectedDayName} ${selectedDay} ${selectedMonthName} ${selectedYear} ${selectedHour}:${selectedMinute} ${selectedAMPM}`;
      break;
  }
  dateDisplay.innerHTML = accumulatedDate;
  instructions.textContent = msg;
}

// Helper for day name
function getDayName(dayIdx) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[dayIdx] || "";
}
function getMonthName(monthIdx) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return names[monthIdx] || "";
}
// Export if using modules
function setProgressBar(step) {
  if (step === 0) progressBarFill.style.width = "0%";
  else if (step === 1) progressBarFill.style.width = "25%";
  else if (step === 2) progressBarFill.style.width = "50%";
  else if (step === 3) progressBarFill.style.width = "75%";
}
function displayFinalSelection() {
  // Keep showing the final date in dateDisplay or wherever you want

  // Next, inject the weather snippet
  injectWeatherSnippet();
}

// Example of injecting the snippet:
function injectWeatherSnippet() {
  // Create a container for the weather snippet
  const weatherContainer = document.createElement("div");
  // Give it a unique ID so we can style or reference it
  weatherContainer.id = "weather-container-step4";

  // Insert your HTML. Notice we’re not including <html>, <head>, <body>,
  // just the part you want inside your bubble. You can rename classes or
  // IDs if you need to avoid collisions.

  weatherContainer.innerHTML = `
    <style>
      #weather-container-step4 {
        font-family: Arial, sans-serif;
        background-color: #f0f8ff;
        padding: 10px;
        border-radius: 5px;
        color: #333;
      }
      #weather-container-step4 header {
        text-align: center;
        padding: 20px;
        background-color: #2196f3;
        color: white;
        border-radius: 5px;
      }
      #weather-container-step4 main {
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
      }
      #weather-container-step4 label {
        display: block;
        font-size: 1rem;
        margin-bottom: 10px;
      }
      #weather-container-step4 input[type="number"] {
        width: 100%;
        padding: 10px;
        margin-top: 5px;
        font-size: 1rem;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-sizing: border-box;
      }
      #weather-container-step4 #weather-result {
        text-align: center;
        margin-top: 30px;
        padding: 20px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      #weather-inline-icon-step4 {
        display: flex;
        align-items: left;
        justify-content: left; /* optional: center horizontally */
        gap: 1rem; /* space between icon and text */
        margin-top: 1rem;
      }

      /* Make the emoji bigger. Use !important if other styles override you. */
      #weather-icon-step4 {
        font-size: 40px !important;
        line-height: 1;
        margin: 0;
        padding: 0;
      }

      /* Adjust text size or style as you like */
      #weather-description-step4 {
        font-size: 2rem;
        font-weight: bold;
        margin: 0;
        padding: 0;
      }
      #weather-container-step4 #weather-description {
        font-size: 1.5rem;
        font-weight: bold;
      }
      #weather-container-step4 .stat {
        margin: 10px 0;
        font-size: 1rem;
      }
      #weather-container-step4 footer {
        text-align: center;
        margin-top: 20px;
        font-size: 0.9rem;
        color: #666;
      }
    </style>
    <main>
      <form id="weather-form-step4">
        <label>Wind Speed (km/h): 
          <input id="wind-speed-step4" type="number" value="10" min="0">
        </label>
        <label>Wind Direction (°): 
          <input id="wind-direction-step4" type="number" value="180" min="0" max="360">
        </label>
        <label>Temperature (°C): 
          <input id="temperature-step4" type="number" value="20">
        </label>
        <label>Humidity (%): 
          <input id="humidity-step4" type="number" value="50" min="0" max="100">
        </label>
        <label>Pressure (hPa): 
          <input id="pressure-step4" type="number" value="1013" min="900" max="1100">
        </label>
      </form>
      <div id="weather-result-step4">
        <div id="weather-inline-icon-step4">
          <div id="weather-icon-step4">☀️</div>
          <p id="weather-description-step4">Sunny</p>
        </div>
        <p class="stat">Rain Probability: <span id="rain-probability-step4">0%</span></p>
        <p class="stat">Cloud Coverage: <span id="cloud-coverage-step4">0%</span></p>
      </div>
    </main>
  `;

  containerElement.appendChild(weatherContainer);

  // If you want the “fake weather” JS logic, attach it here or in a separate file.
  // E.g., re-bind event listeners:
  initFakeWeatherLogic();
}

function initFakeWeatherLogic() {
  // Re-select the newly created elements
  const windSpeedInput = document.getElementById("wind-speed-step4");
  const windDirectionInput = document.getElementById("wind-direction-step4");
  const temperatureInput = document.getElementById("temperature-step4");
  const humidityInput = document.getElementById("humidity-step4");
  const pressureInput = document.getElementById("pressure-step4");
  const weatherIcon = document.getElementById("weather-icon-step4");
  const weatherDescription = document.getElementById("weather-description-step4");
  const rainProbability = document.getElementById("rain-probability-step4");
  const cloudCoverage = document.getElementById("cloud-coverage-step4");

  // Then replicate whatever logic you want for updating icons or text
  // ...
}
