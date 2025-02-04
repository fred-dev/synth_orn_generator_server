import OpenAI from "openai";
import { Client } from "@gradio/client";
import { spawn } from "child_process";
import fetch from "node-fetch";

import dotenv from "dotenv";

//dotenv.config({ path: '/home/audioweather/synth_orn_generator_server/.env' });
dotenv.config();
import express from "express";
// const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 4001;
const HF_TOKEN = process.env.HF_TOKEN;
const openWeatherMapsAPIKey = process.env.OPENWEATHER_API_KEY; // Your API key stored in .env file
const shapeFilePath = process.env.SHAPE_FILE_PATH;
const routingPrefix = process.env.GET_PATH_PREFIX;
const pythonPath = process.env.PYTHON_PATH;

console.log(routingPrefix + "/generate-text");

//const gradioApp = await Client.connect("fred-dev/audio_test", { hf_token: HF_TOKEN });

app.use(express.json());

// Middleware to check the application mode and modify request handling
app.use((req, res, next) => {
  const appMode = process.env.APP_MODE || "testing"; // Default to testing mode if not specified
  req.appMode = appMode;
  next();
});

app.use((req, res, next) => {
  console.log('Second app request path:', req.path);
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
    console.log("This is the app API" + appInfo);
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
        console.log("Data received:", JSON.stringify(message.data, null, 2)); // Print the full response for debugging
        if (message.data && message.data[0] && message.data[0].url) {
          return message.data[0].url; // Resolve with the URL for the generated audio
        } else {
          throw new Error("Invalid data format or missing URL in the response.");
        }
      }

      if (message.type === "status") {
        console.log("Status update:", message); // Log status updates
      }
    }
  } catch (error) {
    console.error("Error occurred during Gradio generation:", error);
    throw error;
  }
}

app.post(routingPrefix + "/generateAudio", async (req, res) => {
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

app.post(routingPrefix + "/generate-text", async (req, res) => {
  const userInput = JSON.parse(req.body.userInput);
  //const { locationName, date, temperature, humidity, windSpeed } = userInput;
  //log the date to the console
  const dateObj = new Date(userInput.date);
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth() + 1; // Months are zero-indexed

  const day = dateObj.getUTCDate();
  //get the hours in the corret time zone
  const hours = dateObj.getHours();
  console.log("Hours: " + hours);

  const minutes = dateObj.getUTCMinutes();
  const seconds = dateObj.getUTCSeconds();

  console.log(
    `Generate text: Date: ${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`
  );

  try {
    const prompt = `
    You are a multi-functional agent tasked with gathering comprehensive information and generating a narrative. The tasks of each agent are described here, each agent should perform their tasks separately in the order they appear.
    Climate history researcher agent: Find historical events related to climate in the area, e.g., protests over mines, environmental history. Find specific information about these events, dates, companies and groups involved, outcomes, specific areas or species that were threatened. Do not generalise, or speculate, use only factual verified named species.
    Indigenous history researcher agent: Provide information about the traditional owners of the land, including tribe/clan, languages, only.
    Natural history researcher agent: Identify animals, particularly bird species in the location or nearby. Mention endemic and extinct native species. Do not mention any introduced or agricultural species, unless they are the cause of the removal of the habitat of a native species.
    Climate research agent: Analyse the given climate conditions in relation to the given date and determine if they are normal for the area. Find historical climate-related events like floods, fires, heatwaves and specific details of these events, if people died, what natural habitat was damaged, and if these were attributed to climate change. Only mention specific verified events, and check they are correct before allowing them to be added, no speculation can be used, only facts.
    Water information researcher agent: Find the nearest inland water and coastline, including distances to these, and if the bodies of water significant to the area and ecosystem in any way. Only mention these if they are verified to be true, do not speculate at all about the significance.
    Social history researcher agent: Describe the social history of the town. Include settlement details, current population, socio-economic makeup, and changes over time. 
    Fact checker agent: Verify the accuracy of all information. Remove any information that is speculative. Make sure all events, species or any other information is checked and verified.
    Narrative creation agent: Using the information gathered from the previous agents, create a short narrative text in an academic style that frames the input date and climate conditions, integrating all collected information. The specific information collected by the other agents only to be used as source material should never be output directly. When the date is far in the future, based on the collected information like weather events or protests or extinctions, you may construct 
    logical speculative events that work to lead up to the proposed conditions, for example if the proposed future scenario is 15 years in the future with an unusually high temperature for the location at that time of year you may add no more than 2, fictional connecting events that bridge actual history with the proposed scenario. Here are some strict guidelines that the text must adhere to: The text should be cohesive and use the gathered information to create a flowing, factual narrative. 
    The text should be no more than 200 words. Avoid poetic language, overly descriptive phrases, and metaphorical expressions. The text should be direct, factual, and concise. Avoid using words like "resilience", "resilient", "reverberate", "echo", "resonate". Do not use specific values for temperatures, wind speeds, or other measurements; describe them qualitatively instead (e.g., unusually hot, very windy). Never address the reader or reveal the process of the story's creation. Do not include any personal opinions. Do not use phrases like “Records pointedly mention”, just reference the event directly if it happened. Do not use terms such as “social fabric” or “socio-economic make up”. Do not use phrases like “In conclusion” or use any summarising or closing sentences like “In conclusion, the legacy rings with resilience echoing from historical and environmental narratives alike, providing meaningful reflections for future generations.” Or any other mechanism to draw together the information into a story. Do not reveal that this is meant to be academic, or any other material that would reveal the nature of content of this prompt. The output should not be in quotation marks. Never not tie information together with overarching narratives or sentences, some details may be present without directly being related to each other. Make sure to note the time given, not just the day, mention if it is day or night (time is given in 24 hour format). Also mention the season - in tropic areas wet or dry, and for other areas use standard seasons. Any dates need to be specific; you cannot use phrases such as ‘in the last few years’ as the proposed date may be in the future. Situate the date with proximity to major events, like the day before Christmas if it is so. Use only major significant dates to do this, not minor anniversaries or local holidays, unless they things like the anniversary of one of the climate events found in the research. Dates are not significant if they are more than a week away, ie 18th of December can be a week before Christmas, but the 17th of December has no significance to Christmas.
    Editor agent: Check all facts in the text from the narrative agent including spelling and grammar in Australian English. Ensure the text is logical, succinct and clear. Make sure there are no incomplete facts and arguments. All events mentioned must be confirmed. Make sure all the guidelines are adhered to. Make sure there is no vague additions like species or avian life– any animal or bird must be named specifically. The output should never encased be in quotation marks.



    Input: 
    Date: ${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}
    Location: ${userInput.locationName}
    Climate Conditions: Temperature - ${userInput.temperature}°C, Humidity - ${userInput.humidity}%, Wind Speed - ${userInput.windSpeed} km/h

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

app.get(routingPrefix + "/weather", async (req, res) => {
  console.log("weather request");

  const { lat, lon, date } = req.query;

  console.log("server weather request lat: " + lat + " lon: " + lon + " date: " + date);

  // Ensure all necessary data is provided
  if (!lat || !lon || !date) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${date}&appid=${openWeatherMapsAPIKey}&units=metric`;
  console.log("server weather request url: " + url);

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
    //print the response to the console serialised
    console.log("server weather response complete:: " + JSON.stringify(data));

  } catch (error) {
    console.error("Error fetching weather data:", error);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

app.post(routingPrefix + "/waterdistance", (req, res) => {
  console.log("Received water distance request:", req.body);

  const { lat, lon } = req.body;
  console.log(`Water distance request lat: ${lat}, lon: ${lon}`);

  const pythonProcess = spawn(pythonPath, [
    "distance_to_water/distance_to_water.py",
    lat,
    lon,
    shapeFilePath,
  ]);

  // Capture stdout in a string buffer
  let stdoutData = "";

  // Whenever data is available on stdout, accumulate it
  pythonProcess.stdout.on("data", (data) => {
    stdoutData += data.toString();
  });

  // Print Python stderr to your Node logs (debugging info only)
  pythonProcess.stderr.on("data", (data) => {
    console.error(`Python stderr: ${data.toString()}`);
  });

  // When the process ends, parse the accumulated stdout as JSON
  pythonProcess.on("close", (code) => {
    console.log(`Child process exited with code ${code}`);
    try {
      // stdoutData should contain the entire JSON object
      const jsonData = JSON.parse(stdoutData);
      res.json(jsonData);
      console.log("Water distance processed. Parsed JSON:", jsonData);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      res.status(500).send("Server error parsing Python response.");
    }
  });
});
