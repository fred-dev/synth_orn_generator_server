import OpenAI from "openai";
import { Client } from "@gradio/client";
import { spawn } from "child_process";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import { Dropbox } from "dropbox";
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

var jsonToSave = {};

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
const clientPathPrefix = process.env.CLIENT_PATH_PREFIX;
var uploadFilePrefix = "";
var audioUrlToSave = "";
var userInputToSave = "";

if (tempDebugVerbose == "true") {
  logger.level = "debug";
} else {
  logger.level = "silent";
}

logger.debug("rootMediaPath: " + rootMediaPath);
logger.debug("clientPathPrefix: " + clientPathPrefix);
logger.debug("routingPrefix: " + routingPrefix);
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

app.get(routingPrefix + "/routingPrefix", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    route: clientPathPrefix,
  });
  console.log("routingPrefix: ", clientPathPrefix);
});

// or const { Dropbox } = require('dropbox'); if using CommonJS

// 1. Create an instance of the Dropbox class with your stored token
const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN, // or hardcode, but best to keep it in env
});

async function uploadFileToDropbox(localFilePath, dropboxFolderPath, newFileName) {
  try {
    // Read file from disk into a Buffer
    const fileContents = fs.readFileSync(localFilePath);

    // Construct the desired Dropbox path
    // For example, if dropboxFolderPath = "/MyGeneratedFiles",
    // and newFileName = "example.wav", final path = "/MyGeneratedFiles/example.wav"
    const dropboxPath = `${dropboxFolderPath}/${newFileName}`;

    // Perform the upload
    const response = await dbx.filesUpload({
      path: dropboxPath,
      contents: fileContents,
      mode: { ".tag": "add" }, // or 'overwrite' if you'd rather overwrite
    });

    console.log("Upload successful:", response.result);
    //delete the file once it is uploaded it is here localFilePath
  } catch (error) {
    console.error("Error uploading file:", error);
  }
}

async function completeDate(audioUrl) {
  try {
    // 1) Fetch the WAV data from the URL
    const response = await fetch(audioUrl);
    const buffer = await response.buffer();

    // 2) Decide on a file prefix, e.g. from the date
    const uploadFilePrefix = new Date().toISOString().replace(/:/g, "-");

    // 3) Write the WAV locally
    fs.writeFileSync(`tempFiles/${uploadFilePrefix}.wav`, buffer);

    // 4) Write the user input to JSON
    //    (make sure to stringify if it's a JS object)
    fs.writeFileSync(`tempFiles/${uploadFilePrefix}.json`, JSON.stringify(jsonToSave, null, 2));

    // 5) Upload them both to Dropbox
    await uploadFileToDropbox(`tempFiles/${uploadFilePrefix}.wav`, "/generated", `${uploadFilePrefix}.wav`);
    await uploadFileToDropbox(`tempFiles/${uploadFilePrefix}.json`, "/generated", `${uploadFilePrefix}.json`);

    console.log("completeDate done successfully");
  } catch (error) {
    console.error("Error in completeDate:", error);
  }
}

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
      cfg_scale: 4.0,
      steps: 250,
      preview_every: 0,
      seed: -1,
      sampler_type: "dpmpp-2m-sde",
      sigma_min: 0.03,
      sigma_max: 50,
      cfg_rescale: 0.4,
      use_init: -1,
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
    completeDate(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// api_name="/generate"
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Start the server
app.listen(port, () => {
  logger.debug(`Server running on port ${port}`);
});

app.post(routingPrefix + "/generate-text", async (req, res) => {
  jsonToSave = req.body.userInput;
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
      You are a multi-functional agent tasked with gathering comprehensive information and generating a narrative. The tasks of each agent are described here, each agent should perform their tasks separately in the order they appear. To perform this research you will be given input information containing a date and time in the format Date: yyyy-m-d-hr-min-sec, a location name in the format Location: suburb, city, state, postcode, Country (all the locations will be within the Australian territory), weather conditions in the format Climate: Temperature - °C, Humidity - %, Wind Speed - km/h, the distance of the location from the coast Distance to coast: in km and the distance of the location from the nearest body of inland water Distance to inland water (in km). These will form the basis of the research and cannot be changed in any circumstances. Following are the different agents and their tasks.
      Climate research: taking the given location, date and time, decide whether the proposed conditions are normal or unusual, for all individual conditions, as well as the complete group, it could be slightly hotter than expected for that date, time and location, windier, more humid. Consider the conditions individually and as a whole and describe their relative difference. This might take the form: An unusually hot day, or indicating a storm, unusual for this time of year. 
      Indigenous history researcher agent: Find information about the traditional owners of the land, including tribe and or clan only. Check this information thoroughly as it cannot be erroneous.
      Natural history researcher agent: Identify animals, particularly bird species in the location or surrounds. Look out for endemic and extinct native species. Do not mention any introduced or agricultural species, unless they are the cause of the removal of the habitat of a native species.
      Climate history researcher agent: Find historical weather related events such as floods, fires, heatwaves and get specific details. Did people die? Were species threatened? What natural habitat was damaged. Were these were attributed to climate change. Only mention specific verified events, and check they are correct before allowing them to be added, no speculation can be used, only facts.
      Climate and nature activism research agent: Find any protests over land use, like mining, deforestation or other related protests that are close by to the location. Find specific information about these events, dates, companies and groups involved, outcomes. Also find the details of specific areas or species that were threatened by the actions that were being protested. Look for other details like if a mine that was being protested was to be run by a company that had a track record of environmental destruction. Do not generalise, or speculate, use only factual verified information for all of this research.    
      Water information researcher agent: You are given distances to inland water and coastline, using these as a starting point identify the names of the water bodies they refer to. Find out if the bodies of water are significant to the area and ecosystem in any way, are they threatened, is there a lack of water in the area? Have they been contaminated.
      Social history researcher agent: Describe the social history of the town. Include settlement details, current population, socio-economic makeup, and changes over time. 
      Fact checker agent: Verify the accuracy of all information. Remove any information that is speculative. Make sure all events, species or any other information is checked and verified.
      Speculative agent: If the date is more than 6 years in the future you must create no more than 4 pieces of speculative information. These pieces are designed to bridge the present day (and recent history and climate) with the proposed future scenario. Where the future scenario is unusually hot, adding events that lead to this is appropriate. The same as if it is cold or windy. Speculative information can be protests over future industrial activity such as mining, fracking or deforestation, future species extinction, or future extreme weather events. Any speculative events are to be logically possible, and where feasible related to paste events, so more and larger fires or floods in places that had them before. Species that are known to be endangered going extinct, protests against industrial activity where there has been a history of this. Here there is some room for a little imagination. The speculative events are likely negative, but do not have to be, for example if the climate scenario suggests a reduction in global warming there may be some positive speculative events, like protestors stopping a mine or preventing fracking. Any speculative events are to be added to their respective categories as researched by other agents so far. The further the date is into the future, the more pieces of speculative information you may create.
      Narrative creation agent: Using the information gathered from the previous agents, create a short narrative text in an academic style that frames input scenario, integrating all collected information. The specific information collected by the other agents is only to be used as source material should never be output directly. 
      Here are some strict guidelines that the text must adhere to: The text should be cohesive and use the gathered information to create a flowing, factual narrative. 
      The text should be no more than 300 words. Avoid poetic language, overly descriptive phrases, and metaphorical expressions. The text should be direct, factual, and concise. Avoid using words like "resilience", "resilient", "reverberate", "echo", "resonate". Do not use specific values for temperatures, wind speeds, or other measurements; describe them qualitatively instead (e.g., unusually hot, very windy). Never address the reader or reveal the process of the story's creation. Do not include any personal opinions. Do not use phrases like “Records pointedly mention”, just reference the event directly if it happened. Do not use terms such as “social fabric” or “socio-economic make up”. Do not use phrases like “In conclusion” or use any summarising or closing sentences like “In conclusion, the legacy rings with resilience echoing from historical and environmental narratives alike, providing meaningful reflections for future generations.” Or any other mechanism to draw together the information into a story. Do not reveal that this is meant to be academic, or any other material that would reveal the nature of content of this prompt. The output should not be in quotation marks. Never not tie information together with overarching narratives or sentences, some details may be present without directly being related to each other. Make sure to note the time given, not just the day, mention if it is day or night (time is given in 24 hour format). Also mention the season - in tropic areas wet or dry, and for other areas use standard seasons. Any dates need to be specific; you cannot use phrases such as ‘in the last few years’ as the proposed date may be in the future. Situate the date with proximity to major events, like the day before Christmas if it is so. Use only major significant dates to do this, not minor anniversaries or local holidays, unless they things like the anniversary of one of the climate events found in the research. Dates are not significant if they are more than a week away, ie 18th of December can be a week before Christmas, but the 17th of December has no significance to Christmas. The text should begin with variations of this format: “Pre-dawn in Alice springs, the lands of the Arrernte people, it is unusually hot for a June morning. The Todd River is dry again this year, and not likely to flow for some time, and with the nearest coastline 600km away, water is a precious resource.” You must not use this format exactly but use it as an example. Following that you can discuss the topics in this order social history, past climate events and past activism local fauna and flora. Finish with a prominent species of local (preferably endemic) bird. Make sure the text flows, not jumping from one topic hard to another. As this text will be streamed to a DIV add appropriate paragraph breaks using HTML.  
      Editor agent: Check all facts in the text from the narrative agent are true (unless they are proposed for a future date). Check spelling and grammar in Australian English. Ensure the text is logical, succinct and clear. Make sure there are no incomplete facts and arguments. All events mentioned that are in the past must be confirmed. Make sure all the text guidelines are adhered to. Make sure there is no vague additions for example when discussing animal species or avian life– any animal or bird must be named specifically (use common names not scientific ones). The output should never encased be in quotation marks.


    Input:
    Date: ${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}
    Location: ${userInput.locationName}
    Climate: Temperature - ${userInput.temperature}°C, Humidity - ${userInput.humidity}%, Wind Speed - ${userInput.windSpeed} km/h
    Distance to coast - ${userInput.waterDistance.coastal_water.distance} km
    Closest coastal water name - ${userInput.waterDistance.coastal_water.display_name}
    Distance to inland water - ${userInput.waterDistance.inland_water.distance} km
    Closest inland water name - ${userInput.waterDistance.inland_water.display_name}
    Output:
    `;
    console.log("prompt: ", prompt);
    //lets print the
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content:
            "You are an academic narrative synthesis agent with expertise in climate, indigenous, natural, water, and social history. Your task is to produce a concise (<210 words),  narrative that integrates based on the instructions you are given.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.7,
      frequency_penalty: 0.32,
      presence_penalty: 0.51,
      stream: true,
    });
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    });
    uploadFilePrefix = dateObj.toISOString().replace(/:/g, "-");

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
