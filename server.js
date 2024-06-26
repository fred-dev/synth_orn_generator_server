import OpenAI from "openai";
import { Client } from "@gradio/client";
import { spawn } from "child_process";
import fetch from "node-fetch";

import dotenv from "dotenv";
dotenv.config();

import express from "express";
// const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3001;
const HF_TOKEN = process.env.HF_TOKEN;
const openWeatherMapsAPIKey = process.env.OPENWEATHER_API_KEY; // Your API key stored in .env file

//const gradioApp = await Client.connect("fred-dev/audio_test", { hf_token: HF_TOKEN });

app.use(express.json());

// Middleware to check the application mode and modify request handling
app.use((req, res, next) => {
  const appMode = process.env.APP_MODE || "testing"; // Default to testing mode if not specified
  req.appMode = appMode;
  next();
});

app.use(express.static("public"));

// generateWithGradio(
//   0,
//   22,
//   -54.617412,
//   96.8233,
//   10,
//   88,
//   0.550,
//   940,
//   340,
//   11,
//   4.0,
//   100,
//   0,
//   -1,
//   "dpmpp-2m-sde",
//   0.3,
//   50,
//   0.4,
//   1.0
// );

async function initializeGradio() {
  try {
    const app = await Client.connect("fred-dev/audio_test", {
      hf_token: HF_TOKEN,
      space_status: (status) => console.log("Space status:", status),
    });
    const appInfo = await app.view_api();
    console.log(appInfo);
    return app;
  } catch (error) {
    console.error("Failed to initialize Gradio:", error);
    throw error;
  }
}

async function generateWithGradio(lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year) {
  try {
    const gradioApp = await initializeGradio();
    console.log("Generating with Gradio");

    const submission = gradioApp.submit("/generate", [0, 22, lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year, 4.0, 200, 0, -1, "dpmpp-2m-sde", 0.3, 30, 0.3, 1.0]);

    return new Promise((resolve, reject) => {
      submission.on("data", (data) => {
        console.log("Data received:", data);
        if (data && data.data && data.data[0] && data.data[0].url) {
          resolve(data.data[0].url);
        } else {
          reject(new Error("Invalid data format"));
        }
      });

      submission.on("status", (status) => {
        console.log("Status update:", status);
      });

      submission.on("error", (error) => {
        console.error("Error received:", error);
        reject(error);
      });
    });
  } catch (error) {
    console.error("Error occurred:", error);
    throw error;
  }
}

app.post("/generateAudio", async (req, res) => {
  const { lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year } = req.body;
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
    console.log("Simulated insert operation:", mockResult);
    res.status(201).json(mockResult.ops[0]);
  } catch (error) {
    console.error("Error creating new marker entry", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Placeholder endpoint to read marker entries
app.get("/markers", async (req, res) => {
  try {
    // Simulate fetching all markers
    const mockMarkers = [
      { id: "mock_id_1", data: "mock data 1" },
      { id: "mock_id_2", data: "mock data 2" },
    ];
    console.log("Simulated fetch operation:", mockMarkers);
    res.status(200).json(mockMarkers);
  } catch (error) {
    console.error("Error fetching marker entries", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Placeholder endpoint to update a marker entry
app.put("/markers/:id", async (req, res) => {
  try {
    const markerId = req.params.id;
    const updateData = req.body;
    // Simulate update operation
    console.log(`Simulated update operation for marker ${markerId}:`, updateData);
    res.status(200).json({ id: markerId, ...updateData });
  } catch (error) {
    console.error("Error updating marker entry", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Placeholder endpoint to delete a marker entry
app.delete("/markers/:id", async (req, res) => {
  try {
    const markerId = req.params.id;
    // Simulate delete operation
    console.log(`Simulated delete operation for marker ${markerId}`);
    res.status(200).json({ id: markerId, deleted: true });
  } catch (error) {
    console.error("Error deleting marker entry", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to generate audio content using Gradio API
app.post("/generate-audio", async (req, res) => {
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
      console.log("Simulated Gradio API call:", mockResponse);
      res.status(200).json(mockResponse);
    }
  } catch (error) {
    console.error("Error generating audio content", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.post("/generate-text", async (req, res) => {
  const userInput = req.body.userInput;
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4",

      messages: [
        {
          role: "system",
          content:
            'You are a science fiction story teller in the future  that uses grim, news presenter  style text. You will be given an input that includes a time and date, a real location, and a set of climate conditions. You are to make a short grim statement about the location, and referencing specific unique things about the location, and commenting how things are destroyed due to climate change.  Use your knowledge of the location to do this, for example if there are usually some species of animal living there, then say that they are almost all gone, and the last are sick and dying. Always talk about the birdlife at the location and how it is being affected badly by climate change. \n\nIf you know for sure there are specific species of birds or animals in the area mention them.\n\nIf there are specific seasonal events mention them.\n\nIf there are some poignant historical events from the location mention it.\n\nDOnt use the whole name given, but a more local one. For example this: "Branding Yard Track, Mount Cole, Rural City of Ararat, Victoria, Australia"\nwould just be Mount Cole Ararat Victoria.\n\nYou should never say that a bird species is extinct, gone or silent, you can mention that the extreme weather has caused their calls to be strained and sometimes unrecognisable.\n\nThe response must not exceed 100 words and should always start with "it is {day} of (month} in the year {year} at {location}.... You must use a lot of variation in generating each response as users will see many and they must all seem reasonable unique, You will also get som einfomration about the closest inland water adn the closest coast line. Add these to the text in some form, manye in the opneing, after the data and town, you can say xxxkm from the coast and xx km from the nearest water, you have the place names for the locations of the nearst coastal and ainland water. Alternately if these distnaces are small you can say close by to the ....',
        },
        {
          role: "assistant",
          content:
            'You are a science fiction story teller in the future  that uses grim, news presenter  style text. You will be given an input that includes a time and date, a real location, and a set of climate conditions. You are to make a short grim statement about the location, and referencing specific unique things about the location, and commenting how things are destroyed due to climate change.  Use your knowledge of the location to do this, for example if there are usually some species of animal living there, then say that they are almost all gone, and the last are sick and dying. Always talk about the birdlife at the location and how it is being affected badly by climate change. \n\nIf you know for sure there are specific species of birds or animals in the area mention them.\n\nIf there are specific seasonal events mention them.\n\nIf there are some poignant historical events from the location mention it.\n\nDOnt use the whole name given, but a more local one. For example this: "Branding Yard Track, Mount Cole, Rural City of Ararat, Victoria, Australia"\nwould just be Mount Cole Ararat Victoria.\n\nYou should never say that a bird species is extinct, gone or silent, you can mention that the extreme weather has caused their calls to be strained and sometimes unrecognisable.\n\nThe response must not exceed 100 words and should always start with "it is {day} of (month} in the year {year} at {location}.... You must use a lot of variation in generating each response as users will see many and they must all seem reasonable unique, You will also get som einfomration about the closest inland water adn the closest coast line. Add these to the text in some form, manye in the opneing, after the data and town, you can say xxxkm from the coast and xx km from the nearest water, you have the place names for the locations of the nearst coastal and ainland water. Alternately if these distnaces are small you can say close by to the ....',
        },
        {
          role: "user",
          content: userInput,
        },
      ],
      temperature: 1,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0.22,
      presence_penalty: 0.81,
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
    console.error("Error calling OpenAI API:", error);
    res.status(500).send("Failed to generate text");
  }
});

app.get("/weather", async (req, res) => {
  console.log("weather request");

  const { lat, lon, date } = req.query;

  // Ensure all necessary data is provided
  if (!lat || !lon || !date) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${date}&appid=${openWeatherMapsAPIKey}&units=metric`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error fetching weather data:", error);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

app.post("/waterdistance", (req, res) => {
  console.log("Received request:", req.body); // Log the incoming request body

  const { lat, lon } = req.body; // Expect lat and lon in the request body

  // Spawn a new Python process
  const pythonProcess = spawn("python3", ["distance_to_water/distance_to_water.py", lat, lon]);

  pythonProcess.stdout.on("data", (data) => {
    try {
      const jsonData = JSON.parse(data.toString()); // Parse the JSON string
      res.json(jsonData); // Send JSON response back to client
    } catch (error) {
      console.error("Error parsing JSON:", error);
      res.status(500).send("Server error in parsing Python response");
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    // Capture any errors
    //console.error(`stderr: ${data}`);
    //res.status(500).send(`Error in Python script: ${data}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`Child process exited with code ${code}`);
  });
});
