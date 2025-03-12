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
const routingPrefix = process.env.GET_PATH_PREFIX;
const clientPathPrefix = process.env.CLIENT_PATH_PREFIX;
const pythonPath = process.env.PYTHON_PATH;
const tempDebugVerbose = process.env.DEBUG_VERBOSE;
const gradioSpacePath = process.env.GRADIO_SPACE_PATH;

if (tempDebugVerbose == "true") {
  logger.level = "debug";
} else {
  logger.level = "silent";
}

logger.debug("clientPathPrefix: " + clientPathPrefix);
logger.debug("routingPrefix: " + routingPrefix);

app.use(express.json());

app.use(express.static("public"));


const dbxConfig = {
  fetch,
  clientId: process.env.DROPBOX_CLIENT_ID,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN, // from your saved token
};
const dbx = new Dropbox(dbxConfig);

const redirectUri = `https://audioweather.com/examination/auth`;

app.get("/getauth", (req, res) => {
  dbx.auth
    .getAuthenticationUrl(redirectUri, null, "code", "offline", null, "none", false)
    .then((authUrl) => {
      // Send the user to Dropbox to grant permission.
      res.redirect(authUrl);
    })
    .catch((error) => {
      logger.error("Error generating auth URL:", error);
      res.status(500).send("Error generating Dropbox auth URL.");
    });
});

/**
 * After the user approves access on Dropbox, Dropbox redirects them here.
 * We grab the 'code' from the querystring, exchange for an access + refresh token,
 * then store that refresh token so the SDK can auto-refresh in future.
 */
app.get("/auth", (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Missing authorization code from Dropbox.");
  }

  dbx.auth
    .getAccessTokenFromCode(redirectUri, code)
    .then((tokenResponse) => {
      const refreshToken = tokenResponse.result.refresh_token;
      console.log("Your new refresh token:", refreshToken); // LOG IT
      //lets write this to the .env file

      // Or show it in the browser (just be careful about exposing secrets!)
      // res.send(`Your refresh token: ${refreshToken}`);

      // Then set it on the SDK so it can refresh automatically
      dbx.auth.setRefreshToken(refreshToken);

      // ... proceed as normal
      return dbx.usersGetCurrentAccount();
    })
    .then((accountInfo) => {
      res.send("Authorization successful! You can close this tab now.");
    })
    .catch((error) => {
      console.error("Error exchanging code for token:", error);
      res.status(500).send("Error exchanging code for token.");
    });
});



async function uploadFileToDropbox(localFilePath, dropboxFolderPath, newFileName) {
  try {
    // (Optional) Force-check if the token is expired and refresh if needed
    await dbx.auth.checkAndRefreshAccessToken();

    const fileContents = fs.readFileSync(localFilePath);
    const dropboxPath = `${dropboxFolderPath}/${newFileName}`;
    const response = await dbx.filesUpload({
      path: dropboxPath,
      contents: fileContents,
      mode: { ".tag": "add" },
    });

    console.log("Upload successful:", response.result);
    fs.unlinkSync(localFilePath);
    console.log("Local file deleted:", localFilePath);
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
    await uploadFileToDropbox(`tempFiles/${uploadFilePrefix}.wav`, `${clientPathPrefix}`, `${uploadFilePrefix}.wav`);
    await uploadFileToDropbox(`tempFiles/${uploadFilePrefix}.json`, `${clientPathPrefix}`, `${uploadFilePrefix}.json`);

    console.log("completeDate done successfully");
  } catch (error) {
    console.error("Error in completeDate:", error);
  }
}



async function initializeGradio() {
  try {
    const app = await Client.connect(gradioSpacePath, {
      hf_token: HF_TOKEN,
      space_status: (status) => logger.debug("Space status:", JSON.stringify(status)),
    });
    const appInfo = await app.view_api();
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
      steps: 120,
      preview_every: 0,
      seed: -1,
      sampler_type: "dpmpp-2m-sde",
      sigma_min: 0.03,
      sigma_max: 50,
      cfg_rescale: 0.25,
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
  apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});

// Start the server
app.listen(port, () => {
  logger.debug(`Server running on port ${port}`);
});

app.post(routingPrefix + "/generate-text", async (req, res) => {
  jsonToSave = req.body.userInput;
  const userInput = JSON.parse(req.body.userInput);
  const dateObj = new Date(userInput.date);
  const ampm = dateObj.getHours() >= 12 ? "pm" : "am";
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth() + 1;
  const day = dateObj.getUTCDate();
  const hours = dateObj.getHours();
  const minutes = dateObj.getUTCMinutes();
  const seconds = dateObj.getUTCSeconds();
  const dateInfoString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")} ${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")} ${ampm}`;
  logger.debug(
    `Generate text: Date: ${dateInfoString}`
  );

  try {
    const prompt = `
    You are a multi-functional agent tasked with gathering comprehensive information and generating a narrative. Each step should be performed separately in the order they appear. To perform this overall task you will be given input information containing a date and time in the format Date: yyyy-m-d-hr-min-sec (time is in 24 hour format), a location name in the format Location: suburb, city, state, postcode, Country (all the locations will be within the Australian territory), weather conditions in the format Climate: Temperature - °C, Humidity - %, Wind Speed - km/h, the distance of the location from the coast Distance to coast: in km as well as a location name and the distance of the location from the nearest body of inland water Distance to inland water (in km) as well as a location name. These will form the basis of all the tasks and cannot be changed in any circumstances. Each research task requires specific information be collected in relation to the location, date and climate conditions, for each research task keep a list of the information that is found, this will used in the final aggregation. If you cannot find verifiable information with specific information like actual dates, locations, place names, clan names, species names, company names or other non-generic information then NO INFORMATION is to be recorded in the output for that task. The information gathered in each research task is to stored in point form as each task is complete, and should not be output, but used in the following generation tasks. Only verified specified information can be included. Following are the different tasks. Once the research tasks are complete you can begin with the generation and editing tasks, their guidelines follow the other task descriptions.

    Indigenous history researcher task: Find information about the traditional owners of the land, including tribe and or clan only (do not use English translations of clan names). Check this information thoroughly as it cannot be erroneous. 

    Environment classification task: Find information about the local environment, is it a desert, coastal town, grasslands.

    Climate research task: taking the given location, date and time, decide whether the proposed conditions are normal or unusual, for all individual conditions, as well as the complete group, it could be slightly hotter than expected for that date, time and location, windier, more humid. Consider the conditions individually and as a whole and describe their relative difference. This might take the form: An unusually hot day, or indicating a storm, unusual for this time of year. 

    Local fauna researcher task: Identify animals, particularly bird species that inhabit the location or surrounds. Make particular note of endemic and extinct native species. Do not mention any introduced or agricultural species. Are there migrating species that stop here? For all species find their sources of food or habitat in this area – ie what natural resources do they require from this area to live?

    Climate history researcher task: Find historical weather related events such as floods, fires, heatwaves and get specific details. Did people die? Were species threatened? What natural habitat was damaged. Were these were attributed to climate change. Only mention specific verified events with dates, and check they are correct before allowing them to be added, no speculation can be used, only facts. 

    Climate and nature activism research task: Find any protests over land use, like mining, deforestation or other related protests that are close by to the location. Find specific information about these events, dates, companies and groups involved, outcomes. Also find the details of specific areas or species that were threatened by the actions that were being protested. Look for other details like if a mine that was being protested was to be run by a company that had a track record of environmental destruction. Do not generalise, or speculate, use only factual verified information for all of this research. 

    Water information researcher task: You are given distances to inland water and coastline, using these as a starting point identify the names of the water bodies they refer to. Find out if the bodies of water are significant to the area and ecosystem in any way, are they threatened, is there a lack of water in the area? Have they been contaminated. 

    Land use researcher task: Is this land used for a specific agricultural or pastoral purpose? What is the main crop or species (ie what farming, sheep or cattle, logging for timber or mining, do NOT include tourism). List impacts of that land use that are confirmed for the location, like salination or water degradation, water polluting – the inclusion of the effects of the land use is very important.

    Speculative event task: If the proposed year is more than 5 years in the future generate speculative events with specific details, these may be in several categories, they could be a future protest, a future mining or agricultural operation, or a future extreme weather event or fire. For every 5 years after the current year you must generate at least one and a maximum of two speculative events. These speculative events must be logical extensions based on previous events and also must have specific dates. For example, devastating floods in June 2038 washed away topsoil and the food supply for the local xxxx species. Or the fires of 2041 razed local ecosystems, or protests against the expansion of the local gold mine in 2036 resulted in mass arrests, or after years of protests, in august 2036 the expansion of the uranium mine was stopped by a high court injunction/ Ministerial Intervention/Stop-work Order/Refusal, Suspension or Revocation of Approvals form the EPA/Voluntary Withdrawal by the developers. Or In 2041 the previously endangered (xxx use specific species name) was officially categorised as extinct. Or in 2038 these lands were returned to their traditional owners, and sustainable land management has seen the local ecosystems flourish. Each speculative event must be added to the appropriate category list collected by the previous research tasks and must ALWAYS be accompanied by a YEAR and date of the future event. Make sure the speculative events are added to the information gathered from research task that matches the category of the speculative event, this is vital for the following processes.

    Text generation task: Using the information gathered from the previous tasks, create a short narrative text in an academic style that frames input scenario, integrating all collected information, where there is no information from a research category this category can be excluded from the text. Here are some strict guidelines that the text must adhere to: The text should be cohesive and use the gathered information to create a flowing, factual text. The text should be in an academic style, informative and importantly concise, with few extra words, but a focus on ease of reading and flow, for example instead of “Uranium mining underpins regional development, involving sites such as Ranger and Jabiluka.” Write Uranium mining at Ranger and Jabiluka produce toxic tailings and radioactive waste” note the removal of involving sites such as – this kind of verbosity is bad. The text should be close to but not over 300 words, no less than 250 words. Make sure not to use phrases like species such as – just name the species directly, use this concept for all parts of the text not just species. Make sure to add all events from the research tasks, including the speculative ones. The text is written on the date and year from the input, so these speculative events will be in the past from this perspective.

    The text should begin with the Year and then time and date information followed by the indigenous traditional owners and then the western place name using this format but adjusted to the specific input for example. 2035, 6:12am on March 18th, just before dawn in the monsoon season on the lands of the Mungguy people (use actual traditional owners), Kakadu (use actual western name)

    Then add the Environment classification to this information, - a tropical/desert/suburban/mountainous area.

    Then move on to the water information, make particular note if water is significant, ie is it a coastal town – then we don’t need to list the distance to the coast. For a desert both distances are important. For example, This desert town is 500 km from the xxxx coastline. Or the ecosystems of this coastal town are deeply connected to the sea, or the local ecosystems are dependent on the xxx river. ALWAYS name the water or locations of the water specifically.

    Then move on to the climate information. It is an unusually hot/cold/windy or typical morning/day/night. Never use the specific values of climate conditions, if it is unusually hot or cold or windy say this, but don’t reference the actual values unless they are incredibly extreme.

    Then move on to the local species information. Home to the endangered/profile, extinct (list verified species, that rely on the (relevant food source/natural resource) for sustenance/shelter. 

    Then move on to previous extreme weather events, for example the floods/fires/avalanches of month and year devastated, impacted, the area resulting in ******. Do not introduce the section for example using "The region has historically experienced severe weather events such as intense heatwaves" Just discuss the events directly like Floods in June 2024, or In January 2019 consecutive days over 45 °C led to extreme fires that destroyed pastoral and and houses.

    Then move on to land use information, for location name is known for, is a centre of, is a ****** town (ie mining, timber logging, wheat growing, lupus cultivation, mining, cattle ranches etc. That have little/significant/disastrous impact on the land resulting in ****** and ***** due to the *******

    Then move on to climate activism. Make sure to note all details, especially dates, locations, companies and organisations involved. Do not introduce the section for example using "The region has a history of environmental activism" Just discuss the events directly like In 2020, protests against the expansion of the local gold mine resulted in mass arrests, or In 2021, the expansion of the uranium mine was stopped by a high court injunction.

    Finally add a small summary, no more than two sentences, an example would be “Continued, mining/agriculture/deforestation/climate change/fires/floods/salination will further impact the ecosystems and their ability to support the **mention bird species and other fauna or extreme weather events, or threated species or specific activities from the gathered data that impact the ecosystems.

    Editor task: The text from Text generation task must be checked and edited. It should be easy to read and flowing and factual, unless it refers to events that are in the future. Check all facts in the text are true, where events are discussed having future dates, they do not need to be fact checked.  Future events are included as if the text is being written after they happened and never mention the events are speculative. Check spelling and grammar in Australian English. Refer to the guidelines for the text generation to ensure they are also followed in the editing process. Ensure the text is logical, succinct and clear and between 220 and 280 words. Make sure there are no incomplete facts and arguments. All events mentioned that are in the past must be confirmed. Make sure all the text guidelines are adhered to. Make sure there is no vague additions for example when discussing animal species or avian life– any animal or bird must be named specifically (use common names not scientific ones). The output should never encased be in quotation marks. The text must be in paragraphs, us the <p> to define paragraphs.

    Input:
    Date: ${dateInfoString}
    Location: ${userInput.locationName}
    Climate: Temperature - ${userInput.temperature}°C, Humidity - ${userInput.humidity}%, Wind Speed - ${userInput.windSpeed} km/h
    Distance to coast - ${userInput.waterDistance.coastal_water.distance} km
    Closest coastal water name - ${userInput.waterDistance.coastal_water.display_name}
    Distance to inland water - ${userInput.waterDistance.inland_water.distance} km
    Closest inland water name - ${userInput.waterDistance.inland_water.display_name}
    Output:

    `;
    logger.debug("Generated prompt:", prompt);
    //save the promtp to a file
    fs.writeFileSync("tempFiles/prompt.txt", prompt);

    // Create the stream from the OpenAI API.
    const stream = await openai.chat.completions.create({
      model: "gpt-4.5-preview",
      messages: [
        {
          role: "system",
          content:
            "You are an academic narrative synthesis agent with expertise in climate, indigenous, natural, water, and social history. Your task is to produce a concise (<210 words), narrative that integrates based on the instructions you are given.",
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

    // Start streaming. Headers are sent once here.
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    });

    // Process the streamed chunks.
    for await (const chunk of stream) {
      //logger.debug("Received chunk:", chunk);
      // Write the chunk or an empty string if not present.
      res.write(chunk.choices[0]?.delta?.content || "");
    }
    res.end();
  } catch (error) {
    // Use the error handling style from the docs
    if (error instanceof OpenAI.APIError) {
      logger.error("OpenAI API Error:");
      logger.error("Request ID:", error.request_id);
      logger.error("Status:", error.status);
      logger.error("Name:", error.name);
      logger.error("Headers:", JSON.stringify(error.headers));
    } else {
      logger.error("Unknown error calling OpenAI API:", error);
    }
    if (!res.headersSent) {
      res.status(500).send("Failed to generate text");
    } else {
      res.end();
    }
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
  logger.debug(`Water distance request lat: ${lat}, lon: ${lon}`);

  const pythonProcess = spawn(pythonPath, ["distance_to_water/distance_to_water.py", lat, lon]);

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
  logger.debug(`isInAustralia lat: ${lat}, lon: ${lon}`);

  const pythonProcess = spawn(pythonPath, ["isInAustralia/isInAustralia.py", lat, lon]);

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

app.post(routingPrefix + "/hug_space_control", (req, res) => {
  //logger.debug("hug_space_con:", JSON.stringify(req.body));

  const { command } = req.body;
  logger.debug(`hug_space_con: ${command}`);

  const pythonProcess = spawn(pythonPath, ["space_control/control_space.py", command]);

  // Capture stdout in a string buffer
  let stdoutData = "";

  // Whenever data is available on stdout, accumulate it
  pythonProcess.stdout.on("data", (data) => {
    stdoutData += data.toString();
    console.log("hug_space_control from server stdoutData: ", stdoutData);
  });

  // Print Python stderr to your Node logs (debugging info only)
  pythonProcess.stderr.on("data", (data) => {
    logger.error(`Python stderr: ${data.toString()}`);
  });

  // When the process ends, parse the accumulated stdout as JSON
  pythonProcess.on("close", (code) => {
    logger.debug(`Child process exited with code ${code}`);
    try {
      //lets check the stdoutData and if it is not JSON then we will ignore it
      if (stdoutData.startsWith("{")) {
        logger.debug(`Currently parsing: ${stdoutData}`);
        const jsonData = JSON.parse(stdoutData.replace(/'/g, '"'));
        res.json(jsonData);
        logger.debug(`hug_space_control. Parsed JSON: ${JSON.stringify(jsonData)}`);
      }
    } catch (error) {
      logger.error("Error parsing JSON:", error);
      res.status(500).send("Server error parsing Python response.");
    }
  });
});
