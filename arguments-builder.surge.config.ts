// Build only Surge; do not transform this native module into other clients.
import { defineConfig } from "@iringo/arguments-builder";
import { airQuality, api, calculate, dataSets, logLevel, nextHour, storage, weather, weatherAlerts } from "./arguments-builder.full.config";
export default defineConfig({
    output: { surge: { path: "./dist/iRingo.WeatherKit.sgmodule", template: "./template/surge.native.handlebars", transformEgern: { enable: false } } },
    args: [...dataSets, ...weather, ...weatherAlerts, ...nextHour, ...airQuality, ...calculate, ...api, ...storage, ...logLevel],
});
