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

    progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBarFill = document.createElement("div");
    progressBarFill.className = "progress-bar-fill";
    progressBarFill.id = "progress";
    progressBar.appendChild(progressBarFill);
    containerElement.appendChild(dateDisplay);
    containerElement.appendChild(progressBar);
    progressBarFill.style.width = "0%";

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
    min: new Date(new Date().getFullYear(), 0, 1),         // Jan 1, current year
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

function displayFinalSelection(){

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
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return names[monthIdx] || "";
}
// Export if using modules
function setProgressBar(step) {
  if      (step === 0) progressBarFill.style.width = "0%";
  else if (step === 1) progressBarFill.style.width = "25%";
  else if (step === 2) progressBarFill.style.width = "50%";
  else if (step === 3) progressBarFill.style.width = "75%";
}
