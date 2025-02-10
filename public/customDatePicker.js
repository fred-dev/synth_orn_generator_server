const globalLogLevel = "debug"; // "silent", "error", "warning", "info", "debug"

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
imageIconArrayNight = ["night_clear_mostlyclear.png", "night_partly_cloudy.png"];

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

  customLog("debug","Callbacks initialized:", {
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
  customLog("debug","Snapshot of userData:initCustomDatePicker:", JSON.parse(JSON.stringify(moduleUserData)));
}

function setupPickerUIInBubble() {
  // Find or create the container element
  if (!containerElement) {
    console.error(`Element with ID popup_bubble not found!`);
    return;
  } else {
    customLog("debug","Element with ID popup_bubble found!");

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
    customLog("debug",containerElement);
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
  customLog("debug","loadYearStep");
  backBtn.disabled = true;
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
      customLog("debug","selectedYear:loadYearStep", selectedYear);
      customLog("debug","Snapshot of userData:loadYearStep:", JSON.parse(JSON.stringify(moduleUserData)));
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
      customLog("debug","selectedMonth:loadMonthStep", selectedMonth);
      customLog("debug","selectedMonthName:loadMonthStep", selectedMonthName);
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
      customLog("debug","selectedDay:loadDayStep", selectedDay);
      customLog("debug","selectedDayName:loadDayStep", selectedDayName);
    },
  });
}

// Time step
function loadTimeStep() {
  customLog("debug","loadTimeStep");
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
      customLog("debug","selectedHour:loadTimeStep", selectedHour);
      customLog("debug","selectedMinute:loadTimeStep", selectedMinute);
      customLog("debug","selectedAMPM:loadTimeStep", selectedAMPM);
      userSelectedDate.setHours(selectedHour);
      userSelectedDate.setMinutes(selectedMinute);
      moduleUserData.date = userSelectedDate;
      moduleUserData.minutes_of_day = minutesOfDayFromDate(userSelectedDate);
      moduleUserData.day_of_year = dayOfYearFromDate(userSelectedDate);
      customLog("debug","Snapshot of userData:loadTimeStep:", JSON.parse(JSON.stringify(moduleUserData)));
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
  customLog("debug","custompickerjs::dateSelectionDone");
  // Force final pick
  if (customPicker?.options?.pick) {
    customPicker.options.pick(customPicker.getDate());
  }
  const finalDate = buildFinalDate();
  if (dateSelectionCalback) {
    dateSelectionCalback(finalDate);
  }

  customLog("debug","moon phase: " + Moon.phase(moduleUserData.date.getFullYear(), moduleUserData.date.getMonth(), moduleUserData.date.getDate()).name);
  //lets get the moon phase for the selected date and location
  // getMoonPhase(finalDate, moduleUserData.latitude, moduleUserData.longitude);

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
    wind_speed: moduleUserData.wind_speed,
  };
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

function createWeatherSelection() {
  // Create a container for the weather snippet
  const weatherContainer = document.createElement("div");
  weatherContainer.id = "weather-container-input";

  const form = document.createElement("form");
  form.id = "weather-form-input";
  

  // Helper: Create a touch-enabled input row with a separate drag handle
  const createTouchInput = (id, min, max, step, labelText) => {
    // Row container: flex layout with space between label and input group
    const rowContainer = document.createElement("div");
    rowContainer.className = "weather-input-row";

    // Label: left aligned
    const label = document.createElement("label");
    label.className = "weather-input-label";
    label.textContent = labelText;
    label.style.whiteSpace = "nowrap";

    // Input group container: holds the input and the drag handle (right aligned)
    const inputGroup = document.createElement("div");
    inputGroup.className = "weather-input-group";


    // Numeric input: remove default spinner arrows and right-align text
    const input = document.createElement("input");
    input.className = "weather-number-input";
    input.id = id;
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
   
    input.addEventListener("input", onWeatherDataAdjusted);

    // Drag handle: a small square to the right of the input
    const dragHandle = document.createElement("div");
    dragHandle.className = "weather-input-drag-handle";
    //lets add an image to the drag handle
    const dragHandleImage = document.createElement("img");
    dragHandleImage.src = "/images/drag-adjust.png";
    dragHandleImage.alt = "drag handle";
    dragHandle.appendChild(dragHandleImage);
    //make the image fit to whatever sie the drag handle is
    dragHandleImage.style.width = "100%";
    //lets make the image 80% opacity
    dragHandleImage.style.opacity = "0.8";
    //and when we touch down on it we will make it 100% opacity
    //and when we touch up on it we will make it 80% opacity
      dragHandleImage.style.opacity = "0.6";
      
  

    // Touch events for the drag handle (so that dragging adjusts the input)
    let startY;
    let startValue;
    dragHandle.addEventListener("touchstart", (e) => {
      startY = e.touches[0].clientY;
      startValue = parseFloat(input.value) || 0;
      dragHandleImage.style.opacity = "1";
      e.preventDefault();
    });
    dragHandle.addEventListener("touchmove", (e) => {
      const deltaY = startY - e.touches[0].clientY;
      const newValue = startValue + deltaY * (step / 10);
      if (newValue >= min && newValue <= max) {
        input.value = newValue.toFixed(1);
        
      }
      e.preventDefault();
    });
    dragHandle.addEventListener("touchend", (e) => {
      e.preventDefault();
      dragHandleImage.style.opacity = "0.6";
      onWeatherDataAdjusted();
    });
    

    // Assemble the input group
    inputGroup.appendChild(input);
    inputGroup.appendChild(dragHandle);

    // Assemble the entire row
    rowContainer.appendChild(label);
    rowContainer.appendChild(inputGroup);

    return rowContainer;
  };

  // Create inputs for temperature, humidity, pressure, and wind speed
  form.appendChild(createTouchInput("temperature-input", -20, 60, 0.5, "Temperature (°C): "));
  form.appendChild(createTouchInput("humidity-input", 0, 100, 0.5, "Humidity (%): "));
  form.appendChild(createTouchInput("pressure-input", 900, 1100, 0.5, "Pressure (hPa): "));
  form.appendChild(createTouchInput("wind-speed-input", 0, 100, 0.5, "Wind Speed (km/h): "));

  weatherContainer.appendChild(form);

  // Create a container for the weather result display
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

  // Insert the weather container into the container element before the progressBar element
  containerElement.insertBefore(weatherContainer, progressBar);

  // Call the function to select and update the weather icon/description based on the current data
  selectWeatherIcon();
}

function onWeatherDataAdjusted() {
  customLog("debug","Weather data adjusted");

  moduleUserData.temperature = document.getElementById("temperature-input").value;
  moduleUserData.humidity = document.getElementById("humidity-input").value; 
  moduleUserData.pressure = document.getElementById("pressure-input").value;
  moduleUserData.wind_speed = document.getElementById("wind-speed-input").value;

  selectWeatherIcon();
}

function selectWeatherIcon() {
  // Get time, date, and weather parameters
  const hour = moduleUserData.date.getHours();
  const isNight = hour < 6 || hour >= 18;
  const temp = parseFloat(moduleUserData.temperature);
  const humidity = parseFloat(moduleUserData.humidity);
  const pressure = parseFloat(moduleUserData.pressure);
  const windSpeed = parseFloat(moduleUserData.wind_speed);

  // --- Calculate derived values ---

  // Rain probability (0-100)
  let rainProb = 0;
  if (humidity > 65) {
    rainProb += (humidity - 65) * 1.5;
    rainProb += Math.max(0, (1013 - pressure) * 0.5);
    // Moderate temperatures (5°C to 28°C) make rain more likely
    if (temp > 5 && temp < 28) {
      rainProb += 10;
    }
  }
  rainProb = Math.min(100, Math.max(0, rainProb));

  // Cloud coverage (0-100)
  let cloudCover = 0;
  cloudCover += Math.max(0, (humidity - 40) * 1.2); // Clouds start to form above 40% humidity
  cloudCover += Math.min(15, windSpeed / 3);
  cloudCover += Math.max(0, (1013 - pressure) * 0.2);
  cloudCover = Math.min(100, Math.max(0, cloudCover));

  // Update UI elements for rain and cloud values
  document.getElementById("rain-probability-input").textContent = `${Math.round(rainProb)}%`;
  document.getElementById("cloud-coverage-input").textContent = `${Math.round(cloudCover)}%`;

  // --- Determine weather condition candidates ---
  // Each candidate has a priority. The higher the number, the more severe/important it is.
  // This modular approach allows high winds, for example, to override less extreme conditions.
  let conditions = [];

  // Extreme wind conditions: if wind speed is very high, show storm or cyclone.
  if (windSpeed >= 60 && pressure < 1000) {
    // For very extreme conditions you might want a "cyclone" icon.
    conditions.push({
      priority: 110,
      icon: "cyclone.png",
      description: "Cyclonic conditions"
    });
  } else if (windSpeed >= 40) {
    conditions.push({
      priority: 100,
      icon: "storm.png",
      description: "Stormy winds"
    });
  } else if (windSpeed >= 25) {
    conditions.push({
      priority: 80,
      icon: "windy.png",
      description: "Windy"
    });
  }

  // Fog: often occurs in high humidity, low wind, and low pressure.
  if (humidity > 85 && windSpeed < 8 && pressure < 1010 && temp < 30 && !isNight) {
    conditions.push({
      priority: 90,
      icon: "fog.png",
      description: "Foggy"
    });
  }

  // Thunderstorm: moderate temperatures with high humidity, wind and rain probability.
  if (temp < 21 && humidity > 85 && windSpeed > 25 && rainProb > 70) {
    conditions.push({
      priority: 95,
      icon: "thunderstorm.png",
      description: "Thunderstorm"
    });
  }

  // Snow and sleet conditions (for cold weather)
  if (temp < 5) {
    if (humidity > 75 && rainProb > 60) {
      conditions.push({
        priority: 85,
        icon: "heavy_snow.png",
        description: "Heavy snow"
      });
    } else if (humidity > 65 && rainProb > 40) {
      conditions.push({
        priority: 80,
        icon: "snow.png",
        description: "Light snow"
      });
    } else if (humidity > 60) {
      conditions.push({
        priority: 75,
        icon: "freezingrain_sleet.png",
        description: "Sleet"
      });
    }
  }
  // Cold rain (temperatures between 5°C and 14°C)
  else if (temp < 14) {
    if (humidity > 80 && rainProb > 70) {
      conditions.push({
        priority: 85,
        icon: "rain.png",
        description: "Cold rain"
      });
    } else if (humidity > 70 && rainProb > 50) {
      conditions.push({
        priority: 80,
        icon: "drizzle_freezingdrizzle.png",
        description: "Light cold rain"
      });
    }
  }
  // Moderate temperatures (14°C to 21°C)
  else if (temp < 21) {
    if (humidity > 80 && rainProb > 75) {
      conditions.push({
        priority: 85,
        icon: "heavy_rain.png",
        description: "Heavy rain"
      });
    } else if (humidity > 70 && rainProb > 60) {
      conditions.push({
        priority: 75,
        icon: "rain.png",
        description: "Moderate rain"
      });
    }
  }
  // Warm rain (temperatures between 21°C and 28°C)
  else if (temp < 28) {
    if (humidity > 70 && rainProb > 60) {
      conditions.push({
        priority: 75,
        icon: "rain.png",
        description: "Warm rain"
      });
    } else if (humidity > 65 && rainProb > 40) {
      conditions.push({
        priority: 70,
        icon: "drizzle_freezingdrizzle.png",
        description: "Light warm rain"
      });
    }
  }
  // Hot conditions (28°C and above)
  else {
    if (humidity > 75) {
      conditions.push({
        priority: 75,
        icon: "haze.png",
        description: "Hot and humid"
      });
    }
  }

  // Cloud cover conditions (if none of the above override)
  if (cloudCover > 85) {
    conditions.push({
      priority: 60,
      icon: "cloudy.png",
      description: "Overcast"
    });
  } else if (cloudCover > 40) {
    conditions.push({
      priority: 50,
      icon: isNight ? "night_partly_cloudy.png" : "partly_cloudy.png",
      description: "Partly cloudy"
    });
  }

  // Fallback condition: clear sky
  if (conditions.length === 0) {
    conditions.push({
      priority: 10,
      icon: isNight ? "night_clear_mostlyclear.png" : "clear_mostlyclear.png",
      description: isNight ? "Clear night" : "Clear sky"
    });
  }

  // --- Choose the highest priority condition ---
  conditions.sort((a, b) => b.priority - a.priority);
  const selected = conditions[0];

  // Update weather icon and description on the UI
  const iconDiv = document.getElementById("weather-icon");
  iconDiv.innerHTML = `<img id="weather-icon-img" src="/images/weather_icons/${selected.icon}" alt="Weather icon" />`;
  document.getElementById("weather-description-input").textContent = selected.description;

  customLog("debug", "selected icon", selected.icon);
  return selected.icon;
}

function dayOfYearFromDate(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  customLog("debug","day of year function", day);
  return day;
}
function minutesOfDayFromDate(date) {
  let minutes = date.getHours() * 60 + date.getMinutes();
  customLog("debug","minutes of day function", minutes);
  return minutes;
}

function clearPopupBubble() {
  //remove all children from the container element
  while (containerElement.firstChild) {
    containerElement.removeChild(containerElement.firstChild);
  }
}

var Moon = {
  phases: ['new-moon', 'waxing-crescent-moon', 'quarter-moon', 'waxing-gibbous-moon', 'full-moon', 'waning-gibbous-moon', 'last-quarter-moon', 'waning-crescent-moon'],
  phase: function (year, month, day) {
    let c;
    let  e;
    let jd;
    let b;
    

    if (month < 3) {
      year--;
      month += 12;
    }

    ++month;
    c = 365.25 * year;
    e = 30.6 * month;
    jd = c + e + day - 694039.09; // jd is total days elapsed
    jd /= 29.5305882; // divide by the moon cycle
    b = parseInt(jd); // int(jd) -> b, take integer part of jd
    jd -= b; // subtract integer part to leave fractional part of original jd
    b = Math.round(jd * 8); // scale fraction from 0-8 and round

    if (b >= 8) b = 0; // 0 and 8 are the same so turn 8 into 0
    return {phase: b, name: Moon.phases[b]};
  }
};
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