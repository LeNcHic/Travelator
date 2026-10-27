import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./redesign.css";
import "./components/plan-redesign.css";
import "./components/travel-calendar.css";
import "./components/route-comparison.css";
import "./components/city-days.css";
import "./components/simple-trip.css";
import "./components/weather.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
