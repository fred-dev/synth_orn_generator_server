import dotenv from "dotenv";

dotenv.config();

export const config = {
  server: {
    port: process.env.PORT || 4001,
    routingPrefix: process.env.GET_PATH_PREFIX || "",
    clientPathPrefix: process.env.CLIENT_PATH_PREFIX || "",
  },
  
  api: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    openWeather: {
      apiKey: process.env.OPENWEATHER_API_KEY,
    },
    huggingFace: {
      token: process.env.HF_TOKEN,
    },
  },
  
  dropbox: {
    clientId: process.env.DROPBOX_CLIENT_ID,
    clientSecret: process.env.DROPBOX_CLIENT_SECRET,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    redirectUri: "https://audioweather.com/examination/auth",
  },
  
  gradio: {
    spacePath: process.env.GRADIO_SPACE_PATH,
  },
  
  python: {
    path: process.env.PYTHON_PATH,
  },
  
  logging: {
    level: process.env.DEBUG_VERBOSE === "true" ? "debug" : "silent",
  },
};

export const validateConfig = () => {
  const required = [
    'api.openai.apiKey',
    'api.openWeather.apiKey',
    'api.huggingFace.token',
    'dropbox.clientId',
    'dropbox.clientSecret',
    'dropbox.refreshToken',
    'gradio.spacePath',
    'python.path'
  ];
  
  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);
    return !value;
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

