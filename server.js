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

async function initializeGradio() {
  try {
    const app = await Client.connect("fred-dev/synth_orn_gen", {
      hf_token: HF_TOKEN,
      space_status: (status) => console.log("Space status:", status),
    });
    const appInfo = await app.view_api();
    console.log("This isthe app API" + appInfo);
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

    // Using the submit() method with the updated payload format
    const submission = gradioApp.submit("/generate", {
      seconds_start: 0,
      seconds_total: 22,
      latitude: lat,
      longitude: lon,
      temperature: temp,
      humidity: humidity,
      wind_speed: wind_speed,
      pressure: pressure,
      minutes_of_day: minutes_of_day,
      day_of_year: day_of_year,
      cfg_scale: 3.0,
      steps: 90,
      preview_every: 0,
      seed: "-1",
      sampler_type: "dpmpp-2m-sde",
      sigma_min: 0.3,
      sigma_max: 30,
      cfg_rescale: 0.3,
      use_init: 0.3,
    });

    // Iterate over async submission response
    for await (const message of submission) {
      if (message.type === "data") {
        console.log("Data received:", JSON.stringify(message.data, null, 2));  // Print the full response for debugging
        if (message.data && message.data[0] && message.data[0].url) {
          return message.data[0].url;  // Resolve with the URL for the generated audio
        } else {
          throw new Error("Invalid data format or missing URL in the response.");
        }
      }

      if (message.type === "status") {
        console.log("Status update:", message);  // Log status updates
      }
    }
  } catch (error) {
    console.error("Error occurred during Gradio generation:", error);
    throw error;
  }
}


app.post("/generateAudio", async (req, res) => {
  const { lat, lon, temp, humidity, wind_speed, pressure, minutes_of_day, day_of_year } = req.body;
  console.log("Received request:", req.body);
  console.log("minutes_of_day: ", minutes_of_day);
  console.log("day_of_year: ", day_of_year);
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

// // Placeholder endpoint to read marker entries
// app.get("/markers", async (req, res) => {
//   try {
//     // Simulate fetching all markers
//     const mockMarkers = [
//       { id: "mock_id_1", data: "mock data 1" },
//       { id: "mock_id_2", data: "mock data 2" },
//     ];
//     console.log("Simulated fetch operation:", mockMarkers);
//     res.status(200).json(mockMarkers);
//   } catch (error) {
//     console.error("Error fetching marker entries", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

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
// app.delete("/markers/:id", async (req, res) => {
//   try {
//     const markerId = req.params.id;
//     // Simulate delete operation
//     console.log(`Simulated delete operation for marker ${markerId}`);
//     res.status(200).json({ id: markerId, deleted: true });
//   } catch (error) {
//     console.error("Error deleting marker entry", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

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
  const userInput = JSON.parse(req.body.userInput);
  const { locationName, date, temperature, humidity, windSpeed } = userInput;
  //log the date to the console

  const [fullDate] = date;
  const dateObj = new Date(fullDate);
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth() + 1; // Months are zero-indexed
 
  const day = dateObj.getUTCDate();
  //get the hours in the corret time zone
  const hours = dateObj.getHours();
  console.log("Hours: "+hours);
 
  const minutes = dateObj.getUTCMinutes();
  const seconds = dateObj.getUTCSeconds();

  console.log(`Date: ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);


  try {
    const prompt= `
    You are a multi-functional agent tasked with gathering comprehensive information and generating a narrative. The information is only to be used as a source for the narrative and should never be output. Any dates need to be specific, you cannot say in the last few years as the fictional date may be in the future. The paragraph should be written adhering to the Narrative Creation section. Follow these steps:
    Climate Historical Research: Find historical events related to climate in the area, e.g., protests over mines, environmental history. Find specific information about these, dates, companies and groups involved, outcomes, specific areas or species that were threatened. Do not generalise, or speculate, use only factual verified named species.
    Indigenous History: Provide information about the traditional owners of the land, including tribe/clan, languages, only.
    Nature History: Identify animals, particularly bird species in the location or nearby. Mention endemic and extinct native species. Do not mention any introduced or agricultural species, unless they are the cause of the removal of the habitat of a native species.
    Climate Research: Analyze given climate conditions and date. Determine if they are normal for the area. Mention historical climate-related events like floods, fires, heatwaves. Find specific details of important events, if people died, what natural habitat was damaged, and if these were attributed to climate change. Only mention specific events, and verify they are correct before allowing them to be added, no speculation can be used, only facts.
    Water Information: Find the nearest inland water and coastline, including distances if there any significant details. Are the bodies of water significant to the area and ecosystem in any way. Only mention these if they are verified to be true, do not speculate at all about the significance.
    Social History: Describe the social history of the town. Include settlement details, current population, socio-economic makeup, and changes over time. 
    Fact Checking: Verify the accuracy of all information. Remove any information that is speculative. Make sure all events, species or any other information is real and verified.
    Narrative Creation: Using the style of a newspaper article that could possibly be from a piece of modern australian fiction, but is definitely journalistic in style, create a short text about the place in the given future date, integrating all collected information. The text should be cohesive and use the gathered information to create a flowing text. The story should be no more than 200 words. Avoid too much poetic language, overly descriptive phrases, and metaphorical expressions. The text should be direct, factual, and concise. Avoid using words like "resilience", "resilient", "reverberate", "echo", "resonate". Do not use specific values for temperatures, wind speeds, or other measurements; describe them qualitatively instead (e.g., unusually hot, very windy). Never address the reader or reveal the process of the story's creation, nor should it contain any personal opinions. It should not appear or be presented as a news article but should use the style. The output should not be in quotation marks. Importantly do not try to tie all these things together with over reaching narratives or sentences. Some things in the story may be there without directly being related to each other. Make sure to note the time given, not just the day, mention if it is day or night (time is given in 24 hour format). Also mention the season - in tropic areas wet or dry, and for other areas use normal seasons. Situate the date with proximity to major events, like the day before christmas if it is. Use only major significant dates, not minor anniversaries or local holidays, unless they things like the anniversary of one of the climate events. Dates are not significant if they are more than a week away, ie 18th of december can be a week before christmas, but the 17th od december has no significance to christmas.
    Editor: Check all facts, spelling and grammar. Ensure the text is logical, succinct and clear. Make sure there are no incomplete facts and arguments. All events mentioned must be confirmed. Make sure all the guidelines are adhered to. Make sure there is no vague additions like species or avian life– any animal or bird must be named specifically. Do not use phrases like “Records pointedly mention”, just reference the event directly if it happened. Do not use terms such as “social fabric” or “socio-economic make up”. Do not use phrases like “In conclusion” or use any summarising or closing sentences like “In conclusion, the legacy rings with resilience echoing from historical and environmental narratives alike, providing meaningful reflections for future generations.” Or any other mechanism to draw together the information into a story. The output should never encased be in quotation marks.


    Input: 
    Date: ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}
    Location: ${locationName}
    Climate Conditions: Temperature - ${temperature}°C, Humidity - ${humidity}%, Wind Speed - ${windSpeed} km/h

    Output:
    `;
    
//lets print the 
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",

      messages: [
        { role: "system", content: "You are a multi-functional agent." },
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
