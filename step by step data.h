<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Slick Year Selector</title>
    <link rel="stylesheet" href="https://unpkg.com/@chakra-ui/react@latest/dist/chakra-ui.min.css">
    <script src="https://unpkg.com/@chakra-ui/react@latest/dist/chakra-ui.min.js"></script>
    <script src="https://unpkg.com/@emotion/react@latest/dist/emotion-react.umd.min.js"></script>
    <script src="https://unpkg.com/@emotion/styled@latest/dist/emotion-styled.umd.min.js"></script>
    <script src="https://unpkg.com/framer-motion@latest/dist/framer-motion.umd.js"></script>

    <style>
        body {
            background-color: #000;
            color: #00ff00;
            font-family: Arial, sans-serif;
        }
        .slider-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 20px;
            width: 60%;
            margin: 0 auto;
        }
        .slider-box {
            width: 100%;
        }
        .chakra-slider__track {
            background-color: #00ff00;
        }
        .chakra-slider__range {
            background-color: #004d00;
        }
        .chakra-slider__thumb {
            background-color: #00ff00;
            box-shadow: 0 0 15px #00ff00;
        }
        button {
            background-color: #00ff00;
            color: #000;
            font-size: 18px;
            padding: 10px 20px;
            border: none;
            cursor: pointer;
            box-shadow: 0 0 15px #00ff00;
        }
        button:hover {
            background-color: #004d00;
            color: #00ff00;
        }
        #current-year, #current-month, #current-day {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #00ff00;
        }
        input[type="time"] {
            background-color: #004d00;
            color: #00ff00;
            border: 2px solid #00ff00;
            padding: 10px;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div id="app" class="slider-container">
        <!-- Initial Year Slider -->
        <div id="year-selector">
            <div id="current-year">2024</div>
            <div class="slider-box">
                <input type="range" id="year-slider" min="2024" max="2074" value="2024" step="1"
                       style="width: 100%;" oninput="updateYear(this.value)">
            </div>
            <div style="display: flex; justify-content: space-between; width: 100%;">
                <span id="min-year">2024</span>
                <span id="max-year">2074</span>
            </div>
            <button onclick="confirmYear()">Confirm Year</button>
        </div>

        <!-- Month Slider (Initially Hidden) -->
        <div id="month-selector" style="display: none;">
            <div id="current-month">January</div>
            <div class="slider-box">
                <input type="range" id="month-slider" min="1" max="12" value="1" step="1"
                       style="width: 100%;" oninput="updateMonth(this.value)">
            </div>
            <div style="display: flex; justify-content: space-between; width: 100%;">
                <span id="min-month">January</span>
                <span id="max-month">December</span>
            </div>
            <button onclick="confirmMonth()">Confirm Month</button>
        </div>

        <!-- Day Slider (Initially Hidden) -->
        <div id="day-selector" style="display: none;">
            <div id="current-day">1</div>
            <div class="slider-box">
                <input type="range" id="day-slider" min="1" max="31" value="1" step="1"
                       style="width: 100%;" oninput="updateDay(this.value)">
            </div>
            <div style="display: flex; justify-content: space-between; width: 100%;">
                <span id="min-day">1</span>
                <span id="max-day">31</span>
            </div>
            <button onclick="confirmDay()">Confirm Day</button>
        </div>

        <!-- Time Input (Initially Hidden) -->
        <div id="time-selector" style="display: none;">
            <input type="time" id="time-input">
            <button onclick="confirmTime()">Confirm Time</button>
        </div>
    </div>

    <script>
        // Initialize values
        const currentYear = new Date().getFullYear();
        const maxYear = currentYear + 50;
        let selectedYear = currentYear;
        let selectedMonth = 1;
        let selectedDay = 1;
        let selectedTime = "00:00";

        // Set the year slider dynamically
        document.getElementById('min-year').textContent = currentYear;
        document.getElementById('max-year').textContent = maxYear;
        document.getElementById('year-slider').min = currentYear;
        document.getElementById('year-slider').max = maxYear;

        // Year slider update
        function updateYear(value) {
            document.getElementById('current-year').textContent = value;
            selectedYear = parseInt(value);
        }

        // Confirm year and show month slider
        function confirmYear() {
            document.getElementById('year-selector').style.display = 'none';
            document.getElementById('month-selector').style.display = 'block';
            updateMonthRange();
        }

        // Update month range based on selected year
        function updateMonthRange() {
            const monthSlider = document.getElementById('month-slider');
            if (selectedYear === currentYear) {
                const currentMonth = new Date().getMonth() + 1;
                monthSlider.min = currentMonth;
                monthSlider.max = 12;
                document.getElementById('min-month').textContent = getMonthName(currentMonth);
            } else {
                monthSlider.min = 1;
                monthSlider.max = 12;
                document.getElementById('min-month').textContent = 'January';
            }
            document.getElementById('max-month').textContent = 'December';
        }

        // Month slider update
        function updateMonth(value) {
            document.getElementById('current-month').textContent = getMonthName(value);
            selectedMonth = parseInt(value);
        }

        // Confirm month and show day slider
        function confirmMonth() {
            document.getElementById('month-selector').style.display = 'none';
            document.getElementById('day-selector').style.display = 'block';
            updateDayRange();
        }

        // Update day range based on selected month
        function updateDayRange() {
            const daySlider = document.getElementById('day-slider');
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            daySlider.min = 1;
            daySlider.max = daysInMonth;
            document.getElementById('min-day').textContent = '1';
            document.getElementById('max-day').textContent = daysInMonth;
        }

        // Day slider update
        function updateDay(value) {
            document.getElementById('current-day').textContent = value;
            selectedDay = parseInt(value);
        }

        // Confirm day and show time input
        function confirmDay() {
            document.getElementById('day-selector').style.display = 'none';
            document.getElementById('time-selector').style.display = 'block';
        }

        // Confirm time and create Date object
        function confirmTime() {
            selectedTime = document.getElementById('time-input').value;
            const [hours, minutes] = selectedTime.split(':');
            const date = new Date(selectedYear, selectedMonth - 1, selectedDay, hours, minutes);
            console.log("Selected Date and Time:", date);
        }

        // Helper function to map month number to name
        function getMonthName(monthNumber) {
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            return monthNames[monthNumber - 1];
        }
    </script>
</body>
</html>
