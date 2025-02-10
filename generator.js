import OpenAI from "openai";
import { Client } from "@gradio/client";
import { spawn } from "child_process";
import fetch from "node-fetch";
import dotenv from "dotenv";
import pino from "pino";
const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      singleLine: false,
      messageFormat: "{levelLabel} - {msg} - {req.method} {req.url}",
    },
  },
});

dotenv.config();
import express from "express";
// const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 4001;
const HF_TOKEN = process.env.HF_TOKEN;
const openWeatherMapsAPIKey = process.env.OPENWEATHER_API_KEY; // Your API key stored in .env file
const shapeFilePathWater = process.env.SHAPE_FILE_PATH_WATER;
const shapeFilePathInside = process.env.SHAPE_FILE_PATH_INSIDE;
const routingPrefix = process.env.GET_PATH_PREFIX;
const pythonPath = process.env.PYTHON_PATH;
const tempDebugVerbose = process.env.DEBUG_VERBOSE;
const rootMediaPath = process.env.ROOT_MEDIA_PATH;

if (tempDebugVerbose == "true") {
  logger.level = "debug";
} else {
  logger.level = "silent";
}

logger.debug("rootMediaPath: " + rootMediaPath);

logger.debug(routingPrefix + "/generate-text");
logger.debug("isInAustralia shape file" + shapeFilePathInside);
logger.debug("Distance to water shape file" + shapeFilePathWater);

app.use(express.json());

// Middleware to check the application mode and modify request handling
app.use((req, res, next) => {
  const appMode = process.env.APP_MODE || "testing"; // Default to testing mode if not specified
  req.appMode = appMode;
  next();
});

app.use((req, res, next) => {
  logger.debug("Second app request path:", JSON.stringify(req.path));
  next();
});

app.use(express.static("public"));

async function initializeGradio() {
  try {
    const app = await Client.connect("fred-dev/synth_orn_gen", {
      hf_token: HF_TOKEN,
      space_status: (status) => logger.debug("Space status:", JSON.stringify(status)),
    });
    const appInfo = await app.view_api();
    logger.debug("This is the app API" + JSON.stringify(appInfo));
    return app;
  } catch (error) {
    logger.error("Failed to initialize Gradio:", error);
    throw error;
  }
}

async function generateWithGradio(lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year) {
  try {
    const gradioApp = await initializeGradio();
    logger.debug("Generating with Gradio");

    // Using the submit() method with the updated payload format
    const submission = gradioApp.submit("/generate", {
      seconds_start: 0,
      seconds_total: 23,
      latitude: lat,
      longitude: lon,
      temperature: temp,
      humidity: humidity,
      wind_speed: wind_speed,
      pressure: pressure,
      minutes_of_day: minutes_of_day,
      day_of_year: day_of_year,
      cfg_scale: 5.0,
      steps: 110,
      preview_every: 0,
      seed: "-1",
      sampler_type: "dpmpp-2m-sde",
      sigma_min: 0.3,
      sigma_max: 50,
      cfg_rescale: 0.3,
      use_init: 0.3,
    });

    // Iterate over async submission response
    for await (const message of submission) {
      if (message.type === "data") {
        logger.debug("Data received:", JSON.stringify(message.data, null, 2)); // Print the full response for debugging
        if (message.data && message.data[0] && message.data[0].url) {
          return message.data[0].url; // Resolve with the URL for the generated audio
        } else {
          throw new Error("Invalid data format or missing URL in the response.");
        }
      }

      if (message.type === "status") {
        logger.debug("Status update:", JSON.stringify(message)); // Log status updates
      }
    }
  } catch (error) {
    logger.error("Error occurred during Gradio generation:", error);
    throw error;
  }
}

app.post(routingPrefix + "/generateAudio", async (req, res) => {
  const { lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year } = req.body;
  logger.debug("Received request:", JSON.stringify(req.body));
  logger.debug("minutes_of_day: ", minutes_of_day);
  logger.debug("day_of_year: ", day_of_year);
  try {
    const result = await generateWithGradio(lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year);
    res.json({ audioUrl: result });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// api_name="/generate"
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint to create a new marker entry
app.post("/markers", async (req, res) => {
  try {
    const markerData = req.body;
    // Simulate a successful insert operation with a mock response
    const mockResult = {
      insertedId: "mock_id",
      ops: [markerData],
      connection: null,
    };
    logger.debug("Simulated insert operation:", mockResult);
    res.status(201).json(mockResult.ops[0]);
  } catch (error) {
    logger.error("Error creating new marker entry", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Placeholder endpoint to update a marker entry
app.put("/markers/:id", async (req, res) => {
  try {
    const markerId = req.params.id;
    const updateData = req.body;
    // Simulate update operation
    logger.debug(`Simulated update operation for marker ${markerId}:`, updateData);
    res.status(200).json({ id: markerId, ...updateData });
  } catch (error) {
    logger.error("Error updating marker entry", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to generate audio content using Gradio API
app.post(routingPrefix + "/generate-audio", async (req, res) => {
  try {
    if (req.appMode === "live") {
      // Logic to make a real API call using the Gradio API key
      // This part will be implemented by the user with their actual API key and logic
      res.status(501).json({ error: "Live mode not yet implemented" });
    } else {
      // Existing mock response logic
      const mockResponse = {
        id: "mock_gradio_id",
        status: "completed",
        data: {
          audio: "This is a simulated audio content URL from Gradio API based on the user's input.",
        },
      };
      logger.debug("Simulated Gradio API call:", mockResponse);
      res.status(200).json(mockResponse);
    }
  } catch (error) {
    logger.error("Error generating audio content", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  logger.debug(`Server running on port ${port}`);
});

app.post(routingPrefix + "/generate-text", async (req, res) => {
  const userInput = JSON.parse(req.body.userInput);
  const dateObj = new Date(userInput.date);
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth() + 1; // Months are zero-indexed
  const day = dateObj.getUTCDate();
  const hours = dateObj.getHours();
  const minutes = dateObj.getUTCMinutes();
  const seconds = dateObj.getUTCSeconds();

  logger.debug(
    `Generate text: Date: ${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")} ${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  );

  try {
    const prompt = `
    Using the input below, generate an academic narrative formatted into clear paragraphs (insert a double newline between sections). The narrative must:

    1. Begin with a natural language date and time, e.g., "on the first of March 2037", and a qualitative weather description that highlights only significant anomalies (e.g., "with unusually hot conditions" rather than raw numbers).
    2. Present the location by its common name, integrating indigenous ownership without listing languages (e.g., "in Mount Willoughby, South Australia, the lands of the Yankunytjatjara"). If available, include any specific historical indigenous events (e.g., massacres) with exact details.
    3. Specify verified distances to the nearest inland water source and the coast.
    4. Describe local native fauna using common names only, and mention any species extinct due to human activity.
    5. Detail specific social history events (environmental protests, forest blockades, court cases, fires, floods, etc.) by naming groups, companies, and individuals involved with exact dates and durations. Do not use generic statements like 'has witnessed significant environmental events.'
    6. If the climate is exceptionally abnormal or the date is far into the future, you may include up to two fictional bridging events—but only if they are logically connected and detailed.

    Input:
    Date: ${year}-${month.toString().padStart(2,"0")}-${day.toString().padStart(2,"0")} ${hours.toString().padStart(2,"0")}:${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}
    Location: ${userInput.locationName}
    Climate: Temperature - ${userInput.temperature}°C, Humidity - ${userInput.humidity}%, Wind Speed - ${userInput.windSpeed} km/h

    Output:
    `;
    //lets print the
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",

      messages: [
        {
          role: "system",
          content: "You are an academic narrative synthesis agent with expertise in climate, indigenous, natural, water, and social history. Your task is to produce a concise (<150 words), fact‐based narrative that integrates precise, verifiable details. Avoid generic or vague language; every detail must be specific and impactful.",

        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0.32,
      presence_penalty: 0.71,
      stream: true,
    });
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    });

    for await (const chunk of stream) {
      res.write(chunk.choices[0]?.delta?.content || "");
    }
    res.end(); // End the response when the stream ends
  } catch (error) {
    logger.error("Error calling OpenAI API:", error);
    res.status(500).send("Failed to generate text");
  }
});

app.get(routingPrefix + "/weather", async (req, res) => {
  logger.debug("weather request");

  const { lat, lon, date } = req.query;

  logger.debug("server weather request lat: " + lat + " lon: " + lon + " date: " + date);

  // Ensure all necessary data is provided
  if (!lat || !lon || !date) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${date}&appid=${openWeatherMapsAPIKey}&units=metric`;
  logger.debug("server weather request url: " + url);

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
    //print the response to the console serialised
    logger.debug("server weather response complete:: " + JSON.stringify(data));
  } catch (error) {
    logger.error("Error fetching weather data:", error);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

app.post(routingPrefix + "/waterdistance", (req, res) => {
  logger.debug("Received water distance request:", JSON.stringify(req.body));

  const { lat, lon } = req.body;
  logger.debug(`Water distance request lat: ${lat}, lon: ${lon}, shapeFilePath: ${shapeFilePathWater}`);

  const pythonProcess = spawn(pythonPath, ["distance_to_water/distance_to_water.py", lat, lon, shapeFilePathWater]);

  // Capture stdout in a string buffer
  let stdoutData = "";

  // Whenever data is available on stdout, accumulate it
  pythonProcess.stdout.on("data", (data) => {
    stdoutData += data.toString();
  });

  // Print Python stderr to your Node logs (debugging info only)
  pythonProcess.stderr.on("data", (data) => {
    logger.error(`Python stderr: ${data.toString()}`);
  });

  // When the process ends, parse the accumulated stdout as JSON
  pythonProcess.on("close", (code) => {
    logger.debug(`Child process exited with code ${code}`);
    try {
      // stdoutData should contain the entire JSON object
      const jsonData = JSON.parse(stdoutData);
      res.json(jsonData);
      logger.debug("Water distance processed. Parsed JSON:", JSON.stringify(jsonData));
    } catch (error) {
      logger.error("Error parsing JSON:", error);
      res.status(500).send("Server error parsing Python response.");
    }
  });
});

app.post(routingPrefix + "/isInAustralia", (req, res) => {
  logger.debug("Received isInAustralia request:", JSON.stringify(req.body));

  const { lat, lon } = req.body;
  logger.debug(`isInAustralia lat: ${lat}, lon: ${lon}, shapeFilePath: ${shapeFilePathInside}`);

  const pythonProcess = spawn(pythonPath, ["isInAustralia/isInAustralia.py", lat, lon, shapeFilePathInside]);

  // Capture stdout in a string buffer
  let stdoutData = "";

  // Whenever data is available on stdout, accumulate it
  pythonProcess.stdout.on("data", (data) => {
    stdoutData += data.toString();
    console.log("isInAustralia frm server stdoutData: ", stdoutData);
  });

  // Print Python stderr to your Node logs (debugging info only)
  pythonProcess.stderr.on("data", (data) => {
    logger.error(`Python stderr: ${data.toString()}`);
  });

  // When the process ends, parse the accumulated stdout as JSON
  pythonProcess.on("close", (code) => {
    logger.debug(`Child process exited with code ${code}`);
    try {
      // stdoutData should contain the entire JSON object
      const jsonData = JSON.parse(stdoutData);
      res.json(jsonData);
      logger.debug(`isInAustralia. Parsed JSON: ${JSON.stringify(jsonData)}`);
    } catch (error) {
      logger.error("Error parsing JSON:", error);
      res.status(500).send("Server error parsing Python response.");
    }
  });
});
