# Synthetic Ornithology Generator Server

A refactored Node.js server for generating synthetic ornithology content with improved architecture and maintainability.

## Project Structure

```
├── config/
│   └── environment.js          # Configuration management
├── middleware/
│   └── errorHandler.js         # Error handling middleware
├── routes/
│   ├── authRoutes.js          # Authentication routes
│   └── apiRoutes.js           # API routes
├── services/
│   ├── dropboxService.js      # Dropbox integration
│   ├── gradioService.js       # Gradio API integration
│   ├── openaiService.js       # OpenAI API integration
│   ├── pythonService.js       # Python script execution
│   └── weatherService.js      # Weather API integration
├── utils/
│   ├── fileUtils.js           # File operations
│   ├── logger.js              # Logging configuration
│   └── validators.js          # Input validation
├── server.js                  # Main application entry point
└── generator.js               # Legacy file (deprecated)
```

## Features

- **Modular Architecture**: Separated concerns into services, routes, and utilities
- **Input Validation**: Comprehensive validation for all API endpoints
- **Error Handling**: Centralized error handling with proper logging
- **Configuration Management**: Environment-based configuration with validation
- **Service Layer**: Dedicated services for external API integrations
- **Logging**: Structured logging with request tracking

## Environment Variables

Required environment variables:

```env
PORT=4001
GET_PATH_PREFIX=/api
CLIENT_PATH_PREFIX=/dropbox/path
PYTHON_PATH=/usr/bin/python3
DEBUG_VERBOSE=true
GRADIO_SPACE_PATH=https://huggingface.co/spaces/...
OPENAI_API_KEY=your_openai_key
OPENWEATHER_API_KEY=your_openweather_key
HF_TOKEN=your_huggingface_token
DROPBOX_CLIENT_ID=your_dropbox_client_id
DROPBOX_CLIENT_SECRET=your_dropbox_client_secret
DROPBOX_REFRESH_TOKEN=your_dropbox_refresh_token
```

## API Endpoints

### Authentication
- `GET /getauth` - Get Dropbox authentication URL
- `GET /auth` - Complete Dropbox authentication

### API Routes (prefixed with GET_PATH_PREFIX)
- `POST /generateAudio` - Generate audio with Gradio
- `POST /generate-text` - Generate narrative text with OpenAI
- `GET /weather` - Get historical weather data
- `POST /waterdistance` - Calculate distance to water bodies
- `POST /isInAustralia` - Check if coordinates are in Australia
- `POST /hug_space_control` - Control Hugging Face space

## Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env` file

3. Start the server:
   ```bash
   node server.js
   ```

## Best Practices Implemented

- **Separation of Concerns**: Each module has a single responsibility
- **Dependency Injection**: Services are injected where needed
- **Error Boundaries**: Proper error handling at all levels
- **Input Validation**: All inputs are validated before processing
- **Logging**: Structured logging with different levels
- **Configuration**: Centralized configuration management
- **Graceful Shutdown**: Proper cleanup on server shutdown
- **Type Safety**: Input validation provides runtime type checking

## Migration from Legacy Code

The original `generator.js` file has been refactored into:

- **Configuration**: `config/environment.js`
- **Services**: Individual service files in `services/`
- **Routes**: Route handlers in `routes/`
- **Utilities**: Helper functions in `utils/`
- **Middleware**: Error handling in `middleware/`

This structure makes the codebase more maintainable, testable, and easier to understand.
