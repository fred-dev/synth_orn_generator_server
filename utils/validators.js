export const validateCoordinates = (lat, lon) => {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  
  if (isNaN(latNum) || isNaN(lonNum)) {
    throw new Error("Invalid coordinates provided");
  }
  
  if (latNum < -90 || latNum > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
  
  if (lonNum < -180 || lonNum > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }
  
  return { lat: latNum, lon: lonNum };
};

export const validateWeatherParams = (temp, humidity, windSpeed, pressure) => {
  const params = {
    temp: parseFloat(temp),
    humidity: parseFloat(humidity),
    windSpeed: parseFloat(windSpeed),
    pressure: parseFloat(pressure),
  };
  
  Object.entries(params).forEach(([key, value]) => {
    if (isNaN(value)) {
      throw new Error(`Invalid ${key} value provided`);
    }
  });
  
  return params;
};

export const validateDateParams = (minutesOfDay, dayOfYear) => {
  const minutes = parseInt(minutesOfDay);
  const day = parseInt(dayOfYear);
  
  if (isNaN(minutes) || minutes < 0 || minutes > 1439) {
    throw new Error("Minutes of day must be between 0 and 1439");
  }
  
  if (isNaN(day) || day < 1 || day > 366) {
    throw new Error("Day of year must be between 1 and 366");
  }
  
  return { minutesOfDay: minutes, dayOfYear: day };
};

export const validateRequiredFields = (obj, requiredFields) => {
  const missing = requiredFields.filter(field => !obj[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};


