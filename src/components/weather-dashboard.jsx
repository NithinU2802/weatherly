import { useEffect, useRef, useState } from "react";
import {
  Droplets,
  Gauge,
  MapPin,
  RefreshCw,
  Search,
  Sunrise,
  Sunset,
  Sun,
  Wind,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const CITIES = [
  { name: "Vancouver", country: "Canada", latitude: 49.2827, longitude: -123.1207 },
  { name: "Copenhagen", country: "Denmark", latitude: 55.6761, longitude: 12.5683 },
  { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
];
const WEATHER_PARAMS = new URLSearchParams({
  current:
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,pressure_msl",
  hourly: "temperature_2m,precipitation_probability,weather_code",
  daily:
    "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max",
  timezone: "auto",
  forecast_days: "7",
});
const DEFAULT_LOCATION = {
  name: "Seattle",
  country: "United States",
  latitude: 47.6062,
  longitude: -122.3321,
};

function weatherDescription(code) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain showers";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Mostly clear";
}

function weatherEmoji(code, isDay = true) {
  if ([95, 96, 99].includes(code)) return "⛈️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([51, 53, 55, 56, 57, 45, 48].includes(code)) return "🌫️";
  if (code === 3) return "☁️";
  if (code === 2) return "⛅";
  if (code === 1) return isDay ? "🌤️" : "☁️";
  return isDay ? "☀️" : "🌙";
}

function formatTemperature(value, unit) {
  if (value == null) return "--°";
  const temperature = unit === "fahrenheit" ? (value * 9) / 5 + 32 : value;
  return `${Math.round(temperature)}°`;
}

function formatCityTime(value) {
  const parts = value?.match(/T(\d{2}):(\d{2})/);
  if (!parts) return "--:--";
  const wallClock = new Date(Date.UTC(2000, 0, 1, Number(parts[1]), Number(parts[2])));
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(wallClock);
}

function formatCityHour(value) {
  const parts = value?.match(/T(\d{2}):(\d{2})/);
  if (!parts) return "--";
  const wallClock = new Date(Date.UTC(2000, 0, 1, Number(parts[1]), Number(parts[2])));
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: "UTC" }).format(
    wallClock,
  );
}

function formatForecastDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function formatForecastDay(value, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tmrw";
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}

async function fetchForecast(latitude, longitude) {
  const params = new URLSearchParams(WEATHER_PARAMS);
  params.set("latitude", latitude);
  params.set("longitude", longitude);
  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Weather service returned ${response.status}. Please try again.`);
  }
  return response.json();
}

async function findCity(query) {
  const params = new URLSearchParams({
    name: query,
    count: "1",
    language: "en",
    format: "json",
  });
  const response = await fetch(`${GEOCODING_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`City search returned ${response.status}. Please try again.`);
  }
  const result = await response.json();
  const city = result.results?.[0];
  if (!city) throw new Error(`We couldn't find "${query}". Try another city name.`);
  return {
    name: city.name,
    country: city.admin1 && city.admin1 !== city.name ? city.admin1 : city.country,
    latitude: city.latitude,
    longitude: city.longitude,
  };
}

function SectionHeading({ eyebrow, title, trailing }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {trailing}
    </div>
  );
}

function WorldMap({ location, forecast, cities, unit, onSelect }) {
  const markers = [];
  if (location && forecast) markers.push({ location, forecast, current: true });
  for (const item of cities) {
    if (
      location &&
      (item.city.name.toLocaleLowerCase() === location.name.toLocaleLowerCase() ||
        (item.city.latitude === location.latitude && item.city.longitude === location.longitude))
    ) {
      continue;
    }
    markers.push({ location: item.city, forecast: item.forecast, current: false });
  }

  return (
    <Card className="map-panel">
      <SectionHeading
        eyebrow="A DIFFERENT VIEW OF THE FORECAST"
        title="Global map"
        trailing={<span className="panel-note">Select a marker to see that city</span>}
      />
      <div className="world-map">
        <svg
          className="world-map-art"
          viewBox="0 0 1000 390"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <pattern id="map-grid" width="100" height="65" patternUnits="userSpaceOnUse">
              <path
                d="M100 0H0V65"
                fill="none"
                stroke="#fff"
                strokeOpacity=".035"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="map-glow">
              <stop offset="0" stopColor="#324b5d" stopOpacity=".38" />
              <stop offset="1" stopColor="#202328" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1000" height="390" fill="#17191d" />
          <rect width="1000" height="390" fill="url(#map-glow)" />
          <rect width="1000" height="390" fill="url(#map-grid)" />
          <g fill="#282b30" stroke="#373a40" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M83 93 111 73 157 66 179 78 207 72 227 91 218 109 197 119 189 142 174 148 169 169 150 184 143 210 125 219 113 203 104 177 89 161 77 132 66 111Z" />
            <path d="m166 212 20 8 15 23-5 30 12 22-12 34-18 25-13-13-4-32-14-29 5-30-10-19Z" />
            <path d="m451 81 20-12 25 4 14 12-9 13-27 4-18-7Z" />
            <path d="m440 114 23-10 29 5 11 15-12 15-8 22-16 13-11 30-17 16-14-8-4-28-14-23 5-23 13-12Z" />
            <path d="m494 79 48-21 73-3 50 16 42-4 38 18 42 3 35 17-11 20-29 5-20 18-31-5-26 16-30-5-15 17-31-7-28 15-27-12-27 11-27-14-24 3-10-18-19-3-7-24-20-11 10-19Z" />
            <path d="m528 159 32-13 30 13 19 29-8 41-19 31-18 36-19 8-8-27-17-24-11-34 7-24-8-32Z" />
            <path d="m785 275 37-13 36 11 8 20-21 19-38 4-27-18Z" />
            <path d="m395 187 9-5 9 8-5 9-11-2Z" />
            <path d="m353 231 17-5 8 13-8 14-14-5Z" />
          </g>
          <path
            d="M0 195h1000M500 0v390"
            fill="none"
            stroke="#d4e5f1"
            strokeOpacity=".07"
            strokeDasharray="4 7"
          />
        </svg>
        <div className="map-markers">
          {markers.map(({ location: city, forecast: cityForecast, current }) => (
            <Button
              key={`${city.name}-${city.latitude}-${city.longitude}`}
              type="button"
              variant="ghost"
              className={`map-marker${current ? " map-marker-current" : ""}`}
              style={{
                left: `${((Number(city.longitude) + 180) / 360) * 100}%`,
                top: `${((90 - Number(city.latitude)) / 180) * 100}%`,
              }}
              aria-label={`View ${city.name}, ${formatTemperature(cityForecast.current.temperature_2m, unit)}`}
              title={`${city.name}: ${formatTemperature(cityForecast.current.temperature_2m, unit)}, ${weatherDescription(cityForecast.current.weather_code)}`}
              onClick={() => onSelect(city)}
            >
              <span className="map-marker-icon" aria-hidden="true">
                {weatherEmoji(cityForecast.current.weather_code, cityForecast.current.is_day === 1)}
              </span>
              <span className="map-marker-temperature">
                {formatTemperature(cityForecast.current.temperature_2m, unit)}
              </span>
            </Button>
          ))}
        </div>
        <div className="map-legend">
          <span className="map-legend-dot" /> Live weather · Open-Meteo
        </div>
      </div>
    </Card>
  );
}

export default function WeatherDashboard() {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [forecast, setForecast] = useState(null);
  const [cities, setCities] = useState([]);
  const [unit, setUnit] = useState("celsius");
  const [range, setRange] = useState("week");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(DEFAULT_LOCATION.name);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    fetchForecast(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude)
      .then((data) => {
        if (!active) return;
        setForecast(data);
        setLoadingLocation("");
      })
      .catch((error) => {
        if (!active) return;
        setLoadingLocation("");
        setStatus(error.message || "Could not load weather. Check your connection and try again.");
      });

    Promise.allSettled(
      CITIES.map(async (city) => ({
        city,
        forecast: await fetchForecast(city.latitude, city.longitude),
      })),
    ).then((results) => {
      if (!active) return;
      const available = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      setCities(available);
      if (!available.length) {
        setStatus("Weather for other cities is temporarily unavailable.");
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function selectLocation(nextLocation) {
    const activeRequest = ++requestId.current;
    setStatus("");
    setLoadingLocation(nextLocation.name);
    try {
      const data = await fetchForecast(nextLocation.latitude, nextLocation.longitude);
      if (activeRequest !== requestId.current) return;
      setLocation(nextLocation);
      setForecast(data);
      setLoadingLocation("");
    } catch (error) {
      if (activeRequest !== requestId.current) return;
      setLoadingLocation("");
      setStatus(error.message || "Could not load weather. Check your connection and try again.");
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    const cityName = query.trim();
    if (!cityName) return;

    setSearching(true);
    setStatus("");
    try {
      const city = await findCity(cityName);
      await selectLocation(city);
    } catch (error) {
      setStatus(error.message || "City search failed. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  async function refreshWeather() {
    if (!location) return;
    setStatus("");
    const activeRequest = ++requestId.current;
    const results = await Promise.allSettled([
      fetchForecast(location.latitude, location.longitude),
      ...CITIES.map((city) => fetchForecast(city.latitude, city.longitude)),
    ]);

    if (activeRequest !== requestId.current) return;
    if (results[0].status === "fulfilled") {
      setForecast(results[0].value);
    } else {
      setStatus(results[0].reason.message || "Could not refresh the weather.");
    }

    const updatedCities = results.slice(1).flatMap((result, index) =>
      result.status === "fulfilled" ? [{ city: CITIES[index], forecast: result.value }] : [],
    );
    setCities(updatedCities);
    if (!updatedCities.length && results[0].status === "fulfilled") {
      setStatus("Weather for other cities is temporarily unavailable.");
    }
  }

  const currentDate = forecast?.daily.time[0];
  const currentDateLabel = currentDate
    ? new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
      })
        .format(new Date(`${currentDate}T12:00:00`))
        .toUpperCase()
    : "WEATHER RIGHT NOW";
  const currentDay = currentDate
    ? new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
        new Date(`${currentDate}T12:00:00`),
      )
    : "Today";
  const forecastIndexes = forecast
    ? range === "today"
      ? [0]
      : range === "tomorrow"
        ? [1]
        : forecast.daily.time.map((_, index) => index)
    : [];
  const firstHourIndex = forecast
    ? Math.max(0, forecast.hourly.time.findIndex((hour) => hour >= forecast.current.time))
    : 0;
  const hourlyForecast = forecast
    ? forecast.hourly.time.slice(firstHourIndex, firstHourIndex + 12).map((time, index) => ({
        time,
        chance: forecast.hourly.precipitation_probability[firstHourIndex + index] ?? 0,
      }))
    : [];

  return (
    <main className="dashboard">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Weatherly home">
          <span className="brand-mark" aria-hidden="true">
            ✳
          </span>
          <span>weatherly</span>
        </a>
        <div className="location-pill">
          <MapPin size={14} aria-hidden="true" />
          <span>{loadingLocation ? `Loading ${loadingLocation}…` : location.name}{!loadingLocation && location.country ? `, ${location.country}` : ""}</span>
        </div>
        <form className="search" role="search" onSubmit={handleSearch}>
          <Search size={17} aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a city…"
            autoComplete="off"
            aria-label="Search a city"
          />
          <Button
            className="search-submit"
            type="submit"
            size="icon-sm"
            variant="secondary"
            aria-label="Search"
            disabled={searching}
          >
            {searching ? <span aria-hidden="true">…</span> : <span aria-hidden="true">↵</span>}
          </Button>
        </form>
        <div className="top-actions">
          <Button
            className="unit-toggle"
            variant="outline"
            onClick={() => setUnit((value) => (value === "celsius" ? "fahrenheit" : "celsius"))}
            aria-label="Switch temperature unit"
          >
            {unit === "celsius" ? "°C / °F" : "°F / °C"}
          </Button>
          <Button
            className="icon-button"
            size="icon"
            variant="outline"
            onClick={refreshWeather}
            aria-label="Refresh weather"
            title="Refresh weather"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </Button>
        </div>
      </header>

      {status && (
        <div className="status-message" role="status" aria-live="polite">
          {status}
        </div>
      )}

      <section className="overview-grid" aria-label="Current weather and precipitation">
        <Card className="current-card">
          <div className="current-card-top">
            <div>
              <p className="eyebrow">{currentDateLabel}</p>
              <h1>{currentDay}</h1>
            </div>
            <Badge variant="outline" className="live-badge">
              <span className="live-dot" /> LIVE
            </Badge>
          </div>
          <div className="current-main">
            <div>
              <p className="current-temperature">
                {forecast ? formatTemperature(forecast.current.temperature_2m, unit) : "--°"}
              </p>
              <p className="condition">
                {forecast ? weatherDescription(forecast.current.weather_code) : "Loading local forecast"}
              </p>
            </div>
            <div className="current-icon" aria-hidden="true">
              {forecast ? weatherEmoji(forecast.current.weather_code, forecast.current.is_day === 1) : "☀️"}
            </div>
          </div>
          <p className="feels-like">
            Feels like {forecast ? formatTemperature(forecast.current.apparent_temperature, unit) : "--°"}
          </p>
          <div className="current-divider" />
          <div className="sun-times">
            <div className="sun-time">
              <Sunrise className="sun-symbol sun-rise" size={16} aria-hidden="true" />
              <span>
                <small>Sunrise</small>
                <strong>{forecast ? formatCityTime(forecast.daily.sunrise[0]) : "--:--"}</strong>
              </span>
            </div>
            <div className="sun-time">
              <Sunset className="sun-symbol sun-set" size={16} aria-hidden="true" />
              <span>
                <small>Sunset</small>
                <strong>{forecast ? formatCityTime(forecast.daily.sunset[0]) : "--:--"}</strong>
              </span>
            </div>
            <div className="sun-time">
              <Droplets className="sun-symbol" size={15} aria-hidden="true" />
              <span>
                <small>Rain chance</small>
                <strong>{forecast ? `${forecast.daily.precipitation_probability_max[0] ?? 0}%` : "--%"}</strong>
              </span>
            </div>
          </div>
        </Card>

        <div className="right-overview">
          <div className="section-heading forecast-heading">
            <div>
              <p className="eyebrow">YOUR WEEK, AT A GLANCE</p>
              <h2>7-day forecast</h2>
            </div>
            <Tabs value={range} onValueChange={setRange} className="forecast-tabs">
              <TabsList aria-label="Forecast range">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
                <TabsTrigger value="week">7 days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="forecast-grid" aria-live="polite">
            {forecast ? (
              forecastIndexes.map((index) => (
                <Card className="forecast-card" key={forecast.daily.time[index]}>
                  <div className="forecast-day">{formatForecastDay(forecast.daily.time[index], index)}</div>
                  <div className="forecast-date">{formatForecastDate(forecast.daily.time[index])}</div>
                  <div className="forecast-icon" aria-hidden="true">
                    {weatherEmoji(forecast.daily.weather_code[index])}
                  </div>
                  <div className="forecast-high">{formatTemperature(forecast.daily.temperature_2m_max[index], unit)}</div>
                  <div className="forecast-low">
                    Low {formatTemperature(forecast.daily.temperature_2m_min[index], unit)}
                  </div>
                  <div className="forecast-rain">
                    <Droplets size={10} aria-hidden="true" /> {forecast.daily.precipitation_probability_max[index] ?? 0}%
                  </div>
                </Card>
              ))
            ) : (
              <div className="forecast-loading">Getting your forecast…</div>
            )}
          </div>
          <div className="metrics-row" aria-label="Current weather details">
            <Card className="metric-card">
              <Wind className="metric-icon wind-icon" size={16} aria-hidden="true" />
              <span className="metric-label">Wind</span>
              <strong>{forecast ? Math.round(forecast.current.wind_speed_10m) : "--"}<small> km/h</small></strong>
            </Card>
            <Card className="metric-card">
              <Droplets className="metric-icon humidity-icon" size={16} aria-hidden="true" />
              <span className="metric-label">Humidity</span>
              <strong>{forecast ? forecast.current.relative_humidity_2m : "--"}<small>%</small></strong>
            </Card>
            <Card className="metric-card">
              <Gauge className="metric-icon pressure-icon" size={16} aria-hidden="true" />
              <span className="metric-label">Pressure</span>
              <strong>{forecast ? Math.round(forecast.current.pressure_msl) : "--"}<small> hPa</small></strong>
            </Card>
            <Card className="metric-card">
              <Sun className="metric-icon uv-icon" size={16} aria-hidden="true" />
              <span className="metric-label">UV index</span>
              <strong>{forecast ? forecast.daily.uv_index_max[0] : "--"}<small> · max</small></strong>
            </Card>
          </div>
        </div>
      </section>

      <section className="lower-grid" aria-label="Hourly precipitation and other cities">
        <Card className="panel precipitation-panel">
          <SectionHeading
            eyebrow="DON’T FORGET YOUR UMBRELLA"
            title="Chance of rain"
            trailing={<span className="panel-note">Next 12 hours</span>}
          />
          <div className="rain-chart" aria-label="Hourly precipitation probability">
            {hourlyForecast.map(({ time, chance }) => (
              <div className="rain-hour" title={`${formatCityHour(time)}: ${chance}% chance of rain`} key={time}>
                <span className="rain-percent">{chance}%</span>
                <div className="rain-track">
                  <div className="rain-bar" style={{ height: `${Math.max(5, chance * 0.72)}%` }} />
                </div>
                <span className="rain-time">{formatCityHour(time)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="panel cities-panel">
          <SectionHeading
            eyebrow="A LITTLE WEATHER TOUR"
            title="Other cities"
            trailing={<span className="panel-note">Around the world</span>}
          />
          <div className="cities-list">
            {cities.length ? (
              cities.map(({ city, forecast: cityForecast }) => (
                <article className="city-card" key={city.name}>
                  <div>
                    <div className="city-country">{city.country}</div>
                    <div className="city-name">{city.name}</div>
                    <div className="city-condition">{weatherDescription(cityForecast.current.weather_code)}</div>
                  </div>
                  <span className="city-icon" aria-hidden="true">
                    {weatherEmoji(cityForecast.current.weather_code, cityForecast.current.is_day === 1)}
                  </span>
                  <strong className="city-temperature">
                    {formatTemperature(cityForecast.current.temperature_2m, unit)}
                  </strong>
                </article>
              ))
            ) : (
              <div className="city-loading">Checking in around the world…</div>
            )}
          </div>
        </Card>
      </section>

      <WorldMap
        location={location}
        forecast={forecast}
        cities={cities}
        unit={unit}
        onSelect={selectLocation}
      />

      <footer className="footer">
        <span>
          <span className="footer-mark" aria-hidden="true">✳</span> A clearer view of your day.
        </span>
        <span>
          Weather data by{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
        </span>
      </footer>
    </main>
  );
}
