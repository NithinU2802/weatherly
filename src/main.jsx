import React from "react";
import { createRoot } from "react-dom/client";
import WeatherDashboard from "@/components/weather-dashboard";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WeatherDashboard />
  </React.StrictMode>,
);
