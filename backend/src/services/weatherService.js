import axios from 'axios';

let cachedWeather = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes cache

// Default coordinates (can be overridden via ENV or auto-detected)
const LATITUDE = process.env.WEATHER_LAT || '28.6139';
const LONGITUDE = process.env.WEATHER_LON || '77.2090';

/**
 * Fetches real-time weather and precipitation forecast from Open-Meteo
 */
export async function getLiveWeather() {
  const now = Date.now();
  if (cachedWeather && (now - lastFetchTime) < CACHE_DURATION_MS) {
    return cachedWeather;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code&hourly=precipitation_probability,rain&forecast_days=1`;
    const res = await axios.get(url, { timeout: 3500 });
    const current = res.data.current || {};
    const hourly = res.data.hourly || {};

    const maxRainProb = hourly.precipitation_probability?.length
      ? Math.max(...hourly.precipitation_probability)
      : 0;

    const currentPrecip = current.precipitation || 0;
    const isRainingNow = currentPrecip > 0 || (current.rain && current.rain > 0);
    const rainExpectedToday = maxRainProb >= 40 || isRainingNow;
    const umbrellaRequired = maxRainProb >= 40 || isRainingNow;

    cachedWeather = {
      temperature: current.temperature_2m ?? null,
      humidity: current.relative_humidity_2m ?? null,
      isRainingNow,
      maxRainProb,
      rainExpectedToday,
      umbrellaRequired,
      summary: isRainingNow
        ? 'Currently raining. Umbrella is strongly required! 🌧️'
        : rainExpectedToday
          ? `High probability of rain today (${maxRainProb}%). Carrying an umbrella is recommended! ☔`
          : `Low chance of rain (${maxRainProb}%). An umbrella is unlikely to be needed today. ☀️`,
      lastUpdated: new Date().toISOString()
    };

    lastFetchTime = now;
    return cachedWeather;
  } catch (error) {
    console.warn('[WeatherService] Could not fetch live weather:', error.message);
    return cachedWeather || {
      temperature: null,
      humidity: null,
      isRainingNow: false,
      maxRainProb: 20,
      rainExpectedToday: false,
      umbrellaRequired: false,
      summary: 'Weather data temporarily unavailable.',
      lastUpdated: new Date().toISOString()
    };
  }
}
