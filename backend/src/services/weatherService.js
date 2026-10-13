import axios from 'axios';

let cachedWeather = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes cache

// Default coordinates (can be overridden via ENV or auto-detected)
const LATITUDE = process.env.WEATHER_LAT || '28.6139';
const LONGITUDE = process.env.WEATHER_LON || '77.2090';

/**
 * Computes a smart, stylish, and weather-appropriate outfit recommendation.
 */
export function computeOutfitRecommendation(temp, rainProb, isRaining, humidity) {
  const t = temp !== null ? temp : 25;
  const isWet = isRaining || rainProb >= 40;
  const humid = (humidity || 50) > 70;

  let tops = '';
  let bottoms = '';
  let footwear = '';
  const accessories = [];
  let summary = '';

  if (t < 14) {
    tops = 'Warm thermal innerwear with a heavy fleece sweater, wool coat, or insulated jacket';
    bottoms = 'Thick denim jeans, corduroy trousers, or fleece-lined pants';
    footwear = 'Insulated boots or sturdy closed-toe shoes with warm wool socks';
    accessories.push('🧣 Warm woolen scarf', '🧤 Gloves', 'Beanie cap');
    summary = `Cold weather (${t}°C). Layer up warmly with insulated outerwear.`;
  } else if (t < 20) {
    tops = 'Long-sleeve t-shirt with a light jacket, cardigan, or cozy hoodie';
    bottoms = 'Regular jeans, chinos, or comfortable joggers';
    footwear = 'Comfortable sneakers or casual leather shoes';
    accessories.push('🧥 Light windbreaker or zip-up jacket');
    summary = `Mild and cool conditions (${t}°C). A comfortable layered outfit works best.`;
  } else if (t < 28) {
    tops = humid 
      ? 'Ultra-breathable moisture-wicking cotton t-shirt or loose linen shirt'
      : 'Breathable cotton t-shirt, casual polo, or light linen button-down shirt';
    bottoms = 'Light chinos, relaxed jeans, or airy cotton trousers';
    footwear = 'Breathable sneakers, loafers, or slip-on canvas shoes';
    accessories.push('🕶️ Sunglasses');
    summary = `Pleasant and comfortable temperature (${t}°C). Casual daytime wear is ideal.`;
  } else {
    tops = 'Lightweight, loose-fitting cotton or linen t-shirt / shirt in light, sun-reflecting colors';
    bottoms = 'Breathable cotton shorts, light chinos, or airy linen trousers';
    footwear = 'Breathable mesh sneakers or airy sandals';
    accessories.push('🕶️ UV-protection sunglasses', '🧢 Sun cap or hat', '🧴 Sunscreen');
    summary = `Warm / hot weather (${t}°C). Wear light, airy, breathable fabrics to stay cool.`;
  }

  if (isWet) {
    accessories.unshift('☔ Compact windproof umbrella', '🧥 Waterproof raincoat or water-resistant jacket');
    footwear = 'Waterproof shoes, rain boots, or dark water-resistant sneakers (avoid white canvas or suede)';
    summary += ` Rain is expected (${rainProb}% chance)—bring an umbrella and water-resistant footwear!`;
  }

  return {
    summary,
    tops,
    bottoms,
    footwear,
    accessories: [...new Set(accessories)]
  };
}

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

    const temp = current.temperature_2m ?? null;
    const hum = current.relative_humidity_2m ?? null;
    const outfit = computeOutfitRecommendation(temp, maxRainProb, isRainingNow, hum);

    cachedWeather = {
      temperature: temp,
      humidity: hum,
      isRainingNow,
      maxRainProb,
      rainExpectedToday,
      umbrellaRequired,
      outfit,
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
    const fallbackOutfit = computeOutfitRecommendation(25, 10, false, 55);
    return cachedWeather || {
      temperature: 25,
      humidity: 55,
      isRainingNow: false,
      maxRainProb: 10,
      rainExpectedToday: false,
      umbrellaRequired: false,
      outfit: fallbackOutfit,
      summary: 'Weather data currently operating on typical seasonal estimate.',
      lastUpdated: new Date().toISOString()
    };
  }
}
