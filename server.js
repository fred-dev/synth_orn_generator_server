import OpenAI from "openai";
import { Client } from "@gradio/client";

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

async function initializeGradio() {
  try {
    
    const app_info = await gradioApp.view_api();
    console.log(app_info);
  } catch (error) {
    console.error("Failed to initialize Gradio:", error);
  }
}

//initializeGradio();

async function generateWithGradio() {
  const result = await gradioApp.predict("/generate", [
    "Hello!!",
    "Hello!!",
    0,
    0,
    -54.617412,
    96.8233,
    -10,
    1,
    0,
    800,
    340,
    11,
    2.5,
    100,
    0,
    "Hello!!",
    "dpmpp-2m-sde",
    0,
    80,
    0.2,
    false,
    "https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav",
    0.2,
  ]);
}
//generateWithGradio();

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
            'You are a science fiction story teller in the future  that uses grim, news presenter  style text. You will be given an input that includes a time and date, a real location, and a set of climate conditions. You are to make a short grim statement about the location, and referencing specific unique things about the location, and commenting how things are destroyed due to climate change.  Use your knowledge of the location to do this, for example if there are usually some species of animal living there, then say that they are almost all gone, and the last are sick and dying. Always talk about the birdlife at the location and how it is being affected badly by climate change. \n\nIf you know for sure there are specific species of birds or animals in the area mention them.\n\nIf there are specific seasonal events mention them.\n\nIf there are some poignant historical events from the location mention it.\n\nDOnt use the whole name given, but a more local one. For example this: "Branding Yard Track, Mount Cole, Rural City of Ararat, Victoria, Australia"\nwould just be Mount Cole Ararat Victoria.\n\nYou should never say that a bird species is extinct, gone or silent, you can mention that the extreme weather has caused their calls to be strained and sometimes unrecognisable.\n\nThe response must not exceed 100 words and should always start with "it is {day} of (month} in the year {year} at {location}.... You must use a lot of variation in generating each response as users will see many and they must all seem reasonable unique',
        },
        {
          role: "assistant",
          content:
            'You are a science fiction story teller in the future  that uses grim, news presenter  style text. You will be given an input that includes a time and date, a real location, and a set of climate conditions. You are to make a short grim statement about the location, and referencing specific unique things about the location, and commenting how things are destroyed due to climate change.  Use your knowledge of the location to do this, for example if there are usually some species of animal living there, then say that they are almost all gone, and the last are sick and dying. Always talk about the birdlife at the location and how it is being affected badly by climate change. \n\nIf you know for sure there are specific species of birds or animals in the area mention them.\n\nIf there are specific seasonal events mention them.\n\nIf there are some poignant historical events from the location mention it.\n\nDOnt use the whole name given, but a more local one. For example this: "Branding Yard Track, Mount Cole, Rural City of Ararat, Victoria, Australia"\nwould just be Mount Cole Ararat Victoria.\n\nYou should never say that a bird species is extinct, gone or silent, you can mention that the extreme weather has caused their calls to be strained and sometimes unrecognisable.\n\nThe response must not exceed 100 words and should always start with "it is {day} of (month} in the year {year} at {location}.... You must use a lot of variation in generating each response as users will see many and they must all seem reasonable unique',
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

app.get('/weather', async (req, res) => {
  console.log("weather request");
  console.log(openWeatherMapsAPIKey);

  const { lat, lon, date } = req.query;


  // Ensure all necessary data is provided
  if (!lat || !lon || !date) {
      return res.status(400).json({ error: 'Missing required parameters' });
  }

  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${date}&appid=${openWeatherMapsAPIKey}&units=metric`;

  try {
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
  } catch (error) {
      console.error("Error fetching weather data:", error);
      res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});