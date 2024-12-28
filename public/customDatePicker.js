// customDatePicker.js
// Minimal multi-step picker implementation using Picker.js
// Provides an init function that accepts a callback for the final date.
//prepare this so we can import it in the main.js
//import Picker from "https://cdn.jsdelivr.net/npm/pickerjs/dist/picker.min.js";

let currentStep = 0;
let finishCallback = null;
let containerElement = null;

// Selections
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth();
let selectedDay = new Date().getDate();
let selectedDayName = "";
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

  // Find or create the container element
  containerElement = document.getElementById("popup_bubble");
  if (!containerElement) {
    console.error(`Element with ID popup_bubble not found!`);
    return;
  } else {
    console.log("Element with ID popup_bubble found!");

    dateDisplay = document.createElement("div");
    dateDisplay.id = "date-display";
    dateDisplay.className = "date-display";
    dateDisplay.innerHTML = "Select a year";

    progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBarFill = document.createElement("div");
    progressBarFill.className = "progress-bar-fill";
    progressBarFill.id = "progress";
    progressBar.appendChild(progressBarFill);
    containerElement.appendChild(dateDisplay);
    containerElement.appendChild(progressBar);


    pickerInstructions = document.createElement("div");
    pickerInstructions.id = "picker-instructions";
    pickerInstructions.style = "margin-bottom: 8px; font-weight: bold;";
    containerElement.appendChild(pickerInstructions);

    customPickerContainer = document.createElement("div");
    customPickerContainer.id = "custom-picker";
    containerElement.appendChild(customPickerContainer);
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

   
  }

  // Start on step 0
  currentStep = 0;
  loadYearStep();
  updateUI();
}

// Helper to destroy old picker
function destroyPicker() {
  if (customPicker) {
    document.getElementById("custom-picker").innerHTML = "";
    customPicker = null;
    console.log("destroyed picker");
  }
}

// Year step
function loadYearStep() {
  console.log("loadYearStep");
  destroyPicker();
  customPicker = new Picker(document.getElementById("custom-picker"), {
    inline: true,
    controls: true,
    rows: 3,
    format: "YYYY",
    increment: { year: 1 },
    date: new Date(), // Start at "now"
    min: new Date(new Date().getFullYear(), 0, 1),
    max: new Date(new Date().getFullYear() + 20, 11, 31),
    pick(date) {
      selectedYear = date.getFullYear();
    },
  });
}

// Month step
function loadMonthStep() {
  console.log("loadMonthStep");
  destroyPicker();
  customPicker = new Picker(document.getElementById("custom-picker"), {
    inline: true,
    controls: true,
    rows: 3,
    format: "MMMM",
    increment: { month: 1 },
    date: new Date(selectedYear, 0),
    pick(date) {
      selectedMonth = date.getMonth();
    },
  });
}

// Day step
function loadDayStep() {
  console.log("loadDayStep");
  destroyPicker();
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
    },
  });
}

// Time step
function loadTimeStep() {
  console.log("loadTimeStep");
  destroyPicker();
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
    },
  });
}

// "Next" step
function nextStep() {
  // Force the current pick
  if (customPicker?.options?.pick) {
    customPicker.options.pick(customPicker.getDate());
  }

  if (currentStep === 0) {
    currentStep = 1;
    loadMonthStep();
  } else if (currentStep === 1) {
    currentStep = 2;
    loadDayStep();
  } else if (currentStep === 2) {
    currentStep = 3;
    loadTimeStep();
  } else if (currentStep === 3) {
    // Final step done
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
  switch (currentStep) {
    case 0:
      msg = "Select a Year";
      break;
    case 1:
      msg = "Select a Month";
      break;
    case 2:
      msg = "Select a Day";
      break;
    case 3:
      msg = "Select a Time";
      break;
  }
  instructions.textContent = msg;
}

// Helper for day name
function getDayName(dayIdx) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[dayIdx] || "";
}

// Export if using modules
