import { defineConfig, loadEnv, type Plugin } from "vite";
import { createHotelApi } from "./server/api.ts";

export default defineConfig(({ mode }) => {
  // Only server code reads these values. Never use a VITE_ prefix for secrets.
  const env = { ...loadEnv(mode, process.cwd(), ["OSTROVOK_", "FLYAI_", "YANDEX_"]), ...process.env };
  const hotelApi: Plugin = {
    name: "travelator-hotel-api",
    configureServer(server) { server.middlewares.use(createHotelApi(env)); },
    configurePreviewServer(server) { server.middlewares.use(createHotelApi(env)); },
  };
  return { plugins: [hotelApi] };
});
