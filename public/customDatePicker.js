
let currentStep = 0;
let dateSelectionCalback = null;
let weatherSelectionCallback = null;
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
let userSelectedDate = new Date();
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
let moduleUserData = {};

export function initCustomDatePicker({ containerId, userGeneratedData, onDateSelectionComplete, onWeatherSelectionComplete }) {
  dateSelectionCalback = onDateSelectionComplete;
  weatherSelectionCallback = onWeatherSelectionComplete;
  containerElement = document.getElementById(containerId);

  console.log("Callbacks initialized:", {
    onDateSelectionComplete: typeof dateSelectionCalback,
    onWeatherSelectionComplete: typeof weatherSelectionCallback,
  });

  // Start on step 0
  currentStep = 0;
  setupPickerUIInBubble();
  loadYearStep();
  updateUI();
  moduleUserData = userGeneratedData;
  // moduleUserData.temperature = 20;
  console.log("Snapshot of userData:initCustomDatePicker:", JSON.parse(JSON.stringify(moduleUserData)));

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
    backBtn.disabled = false;
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
  backBtn.disabled = true
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
      userSelectedDate.setFullYear(selectedYear);
      console.log("selectedYear:loadYearStep", selectedYear);
      console.log("Snapshot of userData:loadYearStep:", JSON.parse(JSON.stringify(moduleUserData)));

    },
  });
}
 

// Month step
function loadMonthStep() {
  backBtn.disabled = false;

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
      userSelectedDate.setMonth(selectedMonth);
      console.log("selectedMonth:loadMonthStep", selectedMonth);
      console.log("selectedMonthName:loadMonthStep", selectedMonthName);
    },
   
  });
}

// Day step
function loadDayStep() {
  backBtn.disabled = false;
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
      userSelectedDate.setDate(selectedDay);
      console.log("selectedDay:loadDayStep", selectedDay);
      console.log("selectedDayName:loadDayStep", selectedDayName);
    },
  });
}

// Time step
function loadTimeStep() {
  console.log("loadTimeStep");
  backBtn.disabled = false;
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
      console.log("selectedHour:loadTimeStep", selectedHour);
      console.log("selectedMinute:loadTimeStep", selectedMinute);
      console.log("selectedAMPM:loadTimeStep", selectedAMPM);
      userSelectedDate.setHours(selectedHour);
      userSelectedDate.setMinutes(selectedMinute);
      moduleUserData.date = userSelectedDate;
      moduleUserData.minutes_of_day = minutesOfDayFromDate(userSelectedDate);
      moduleUserData.day_of_year = dayOfYearFromDate(userSelectedDate); 
      console.log("Snapshot of userData:loadTimeStep:", JSON.parse(JSON.stringify(moduleUserData)));
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
    dateSelectionDone();
    createWeatherSelection();
  } else if (currentStep === 4) {
    currentStep = 5;
    setProgressBar(currentStep);
    weatherSelectionDone();
    clearPopupBubble();

  }

  updateUI();
}

// "Back" step
function prevStep() {
  if (currentStep === 0) {
    return; // can't go back from year
  }
  destroyPicker();
  currentStep--;
  
  if (currentStep === 0) {
    setProgressBar(currentStep);
    loadYearStep();
  } else if (currentStep === 1) {
    setProgressBar(currentStep);
    loadMonthStep();
  } else if (currentStep === 2) {
    setProgressBar(currentStep);
    loadDayStep();
  }
  updateUI();
}


// After finishing final step, call the callback
function dateSelectionDone() {
  console.log("custompickerjs::dateSelectionDone");
  // Force final pick
  if (customPicker?.options?.pick) {
    customPicker.options.pick(customPicker.getDate());
  }
  const finalDate = buildFinalDate();
  if (dateSelectionCalback) {
    dateSelectionCalback(finalDate);
  }
  //lets clear the date selection from the container
  containerElement.removeChild(customPickerContainer);
  containerElement.removeChild(pickerInstructions);
 
}

function weatherSelectionDone() {
  const finalWeatherData = buildFinalWeatherData();
  if (weatherSelectionCallback) {
    weatherSelectionCallback(finalWeatherData);
  }
}

function buildFinalWeatherData() {
  const weatherData = {
    temperature: moduleUserData.temperature,
    humidity: moduleUserData.humidity,
    pressure: moduleUserData.pressure,
    wind_speed: moduleUserData.wind_speed};
  return weatherData;
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
  else if (step === 1) progressBarFill.style.width = "20%";
  else if (step === 2) progressBarFill.style.width = "40%";
  else if (step === 3) progressBarFill.style.width = "60%";
  else if (step === 4) progressBarFill.style.width = "80%";
  else if (step === 5) progressBarFill.style.width = "100%";
}

// Example of injecting the snippet:
function createWeatherSelection() {
  // Create a container for the weather snippet
  const weatherContainer = document.createElement("div");
  // Give it a unique ID so we can style or reference it
  weatherContainer.id = "weather-container-input";

  const form = document.createElement("form");
  form.id = "weather-form-input";
  const temperatureLabel = document.createElement("label");
  temperatureLabel.textContent = "Temperature (°C): ";
  const temperatureInput = document.createElement("input");
  temperatureInput.id = "temperature-input";
  temperatureInput.type = "number";
  temperatureInput.step = "0.5"; // Set the increment step to 0.5
  temperatureInput.addEventListener("input", onWeatherDataAdjusted);
  temperatureLabel.appendChild(temperatureInput);
  form.appendChild(temperatureLabel);

  const humidityLabel = document.createElement("label");
  humidityLabel.textContent = "Humidity (%): ";
  const humidityInput = document.createElement("input");
  humidityInput.id = "humidity-input";
  humidityInput.type = "number";
  humidityInput.value = "50";
  temperatureInput.step = "0.5"; // Set the increment step to 0.5
  humidityInput.min = "0";
  humidityInput.max = "100";
  humidityInput.addEventListener("input", onWeatherDataAdjusted);
  humidityLabel.appendChild(humidityInput);
  form.appendChild(humidityLabel);

  const pressureLabel = document.createElement("label");
  pressureLabel.textContent = "Pressure (hPa): ";
  const pressureInput = document.createElement("input");
  pressureInput.id = "pressure-input";
  pressureInput.type = "number";
  pressureInput.value = "1013";
  pressureInput.min = "900";
  pressureInput.max = "1100";
  pressureInput.step = "0.5"; // Set the increment step to 0.5
  pressureInput.addEventListener("input", onWeatherDataAdjusted);
  pressureLabel.appendChild(pressureInput);
  form.appendChild(pressureLabel);

  const windSpeedLabel = document.createElement("label");
  windSpeedLabel.textContent = "Wind Speed (km/h): ";
  const windSpeedInput = document.createElement("input");
  windSpeedInput.id = "wind-speed-input";
  windSpeedInput.type = "number";
  windSpeedInput.value = "10";
  windSpeedInput.min = "0";
  windSpeedInput.step = "0.5"; // Set the increment step to 0.5
  windSpeedInput.addEventListener("input", onWeatherDataAdjusted);
  windSpeedLabel.appendChild(windSpeedInput);
  form.appendChild(windSpeedLabel);

  weatherContainer.appendChild(form);

  const weatherResult = document.createElement("div");
  weatherResult.id = "weather-result-input";

  const weatherInlineIcon = document.createElement("div");
  weatherInlineIcon.id = "weather-inline-icon-input";

  const weatherIcon = document.createElement("div");
  weatherIcon.id = "weather-icon";
  weatherInlineIcon.appendChild(weatherIcon);

  const weatherDescription = document.createElement("p");
  weatherDescription.id = "weather-description-input";
  weatherDescription.textContent = "Sunny";
  weatherInlineIcon.appendChild(weatherDescription);

  weatherResult.appendChild(weatherInlineIcon);

  const rainProbability = document.createElement("p");
  rainProbability.className = "stat";
  rainProbability.innerHTML = 'Rain Probability: <span id="rain-probability-input">0%</span>';
  weatherResult.appendChild(rainProbability);

  const cloudCoverage = document.createElement("p");
  cloudCoverage.className = "stat";
  cloudCoverage.innerHTML = 'Cloud Coverage: <span id="cloud-coverage-input">0%</span>';
  weatherResult.appendChild(cloudCoverage);

  weatherContainer.appendChild(weatherResult);


  //lets insert the weather container into the container element before the dateDisplay element
  containerElement.insertBefore(weatherContainer, progressBar);

}

function onWeatherDataAdjusted() {
  console.log("Weather data adjusted");

  moduleUserData.temperature = document.getElementById("temperature-input").value;
  moduleUserData.humidity = document.getElementById("humidity-input").value;
  moduleUserData.pressure = document.getElementById("pressure-input").value;
  moduleUserData.wind_speed = document.getElementById("wind-speed-input").value;

  selectWeatherIcon();
}
function selectWeatherIcon() {
  // --- 1) Determine time of day from userGeneratedData.date ---
  // For example, day = 6AM to 6PM, else night.
  const hour = moduleUserData.date.getHours();
  const isNight = (hour < 6 || hour >= 18);

  // Decide which icon array to pick from
  const iconArray = isNight ? imageIconArrayNight : imageIconArrayDay;

  // --- 2) Extract relevant weather data from userGeneratedData ---
  const temperature = moduleUserData.temperature;  // °C
  const humidity    = moduleUserData.humidity;     // 0–100
  const pressure    = moduleUserData.pressure;     // hPa
  const windSpeed   = moduleUserData.windSpeed;    // e.g. km/h

  // --- 3) Start with a default icon for day vs. night ---
  let chosenIcon = isNight 
    ? "night_clear_mostlyclear.png"
    : "clear_mostlyclear.png";

  // --- 4) Very simple heuristic checks ---
  // Thunderstorm (humid + windy)
  if (humidity > 70 && windSpeed > 25) {
    chosenIcon = "thunderstorm.png";
  }
  // Heavy rain (warm + very humid)
  else if (temperature > 0 && humidity > 80) {
    chosenIcon = "heavy_rain.png";
  }
  // Snow (below freezing + fairly humid)
  else if (temperature < 0 && humidity > 60) {
    chosenIcon = "snow.png";
  }
  // Drizzle or light rain (moderate humidity)
  else if (humidity > 60) {
    // We do have "drizzle_night.png", but it’s in the day array — might be a mismatch.
    chosenIcon = isNight ? "drizzle_night.png" : "drizzle_freezingdrizzle.png";
  }
  // Fog (moderate humidity + low wind + lower pressure)
  else if (humidity > 50 && windSpeed < 5 && pressure < 1010) {
    chosenIcon = "fog.png";
  }
  // Cloudy
  else if (humidity > 40) {
    chosenIcon = "cloudy.png";
  }

  // --- 5) If chosenIcon isn’t in the chosen array, fallback to a default ---
  if (!iconArray.includes(chosenIcon)) {
    chosenIcon = isNight
      ? "night_clear_mostlyclear.png"
      : "clear_mostlyclear.png";
  }
  let iconDiv = document.getElementById("weather-icon");
  //lets load an image and display iti nt heicon div
  iconDiv.innerHTML = `<img src="/weather_icons/${chosenIcon}" alt="Weather icon" />`;

  console.log("selected icon", chosenIcon);
  return chosenIcon;
}


function dayOfYearFromDate(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  console.log("day of year function", day);
  return day;
}
function minutesOfDayFromDate(date) {
  let minutes = date.getHours() * 60 + date.getMinutes();
  console.log("minutes of day function", minutes);
  return minutes;
}

function clearPopupBubble() {
  //remove all children from the container element
  while (containerElement.firstChild) {
    containerElement.removeChild(containerElement.firstChild);
  }
  
}