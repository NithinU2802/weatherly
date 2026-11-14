const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
geocodingUrl.search = new URLSearchParams({
  name: "Seattle",
  count: "1",
  language: "en",
  format: "json",
});

const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
forecastUrl.search = new URLSearchParams({
  latitude: "47.6062",
  longitude: "-122.3321",
  current: "temperature_2m,weather_code",
  hourly: "precipitation_probability",
  daily: "temperature_2m_max,temperature_2m_min",
  timezone: "auto",
  forecast_days: "7",
});

const MAX_ATTEMPTS = 3;

async function getJson(url, label) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      lastError = error;
    }

    if (response && response.status !== 200) {
      const error = new Error(`${label} returned HTTP ${response.status}; expected HTTP 200.`);
      if (response.status !== 429 && response.status < 500) {
        throw error;
      }
      lastError = error;
    } else if (response) {
      try {
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      console.warn(
        `${label} request failed on attempt ${attempt}/${MAX_ATTEMPTS}; retrying.`,
        lastError,
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new Error(`${label} request failed after ${MAX_ATTEMPTS} attempts.`, {
    cause: lastError,
  });
}

const geocoding = await getJson(geocodingUrl, "Open-Meteo geocoding API");
if (!Array.isArray(geocoding.results) || !geocoding.results[0]) {
  throw new Error("Open-Meteo geocoding API returned no Seattle search results.");
}
const [seattle] = geocoding.results;
if (
  typeof seattle.latitude !== "number" ||
  typeof seattle.longitude !== "number" ||
  !seattle.name
) {
  throw new Error("Open-Meteo geocoding API returned an invalid city result.");
}
console.log(`Open-Meteo geocoding API: HTTP 200 (${seattle.name}).`);

const forecast = await getJson(forecastUrl, "Open-Meteo forecast API");
if (
  !forecast.current ||
  typeof forecast.current.temperature_2m !== "number" ||
  typeof forecast.current.weather_code !== "number"
) {
  throw new Error("Open-Meteo forecast API returned invalid current conditions.");
}
if (
  !Array.isArray(forecast.daily?.time) ||
  forecast.daily.time.length !== 7 ||
  forecast.daily.temperature_2m_max?.length !== 7 ||
  forecast.daily.temperature_2m_min?.length !== 7
) {
  throw new Error("Open-Meteo forecast API did not return seven complete forecast days.");
}
if (
  !Array.isArray(forecast.hourly?.precipitation_probability) ||
  forecast.hourly.precipitation_probability.length < 12
) {
  throw new Error("Open-Meteo forecast API returned fewer than 12 hourly rain probabilities.");
}
console.log("Open-Meteo forecast API: HTTP 200 (current, hourly, and seven-day data).");
