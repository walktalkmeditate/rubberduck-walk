import { test } from "node:test";
import assert from "node:assert/strict";
import { mapWeatherCode, formatWeather } from "../src/weather.ts";

test("mapWeatherCode 0 → clear", () => {
  assert.equal(mapWeatherCode(0), "clear");
});

test("mapWeatherCode 45 and 48 → fog", () => {
  assert.equal(mapWeatherCode(45), "fog");
  assert.equal(mapWeatherCode(48), "fog");
});

test("mapWeatherCode rain codes", () => {
  assert.equal(mapWeatherCode(51), "light rain");
  assert.equal(mapWeatherCode(63), "rain");
  assert.equal(mapWeatherCode(81), "showers");
});

test("mapWeatherCode snow codes", () => {
  assert.equal(mapWeatherCode(73), "snow");
});

test("mapWeatherCode thunderstorm", () => {
  assert.equal(mapWeatherCode(95), "thunderstorm");
});

test("mapWeatherCode unknown → clear (safe default)", () => {
  assert.equal(mapWeatherCode(9999), "clear");
});

test("formatWeather combines code and temperature", () => {
  assert.equal(formatWeather(0, 15.5), "clear, 16°C");
  assert.equal(formatWeather(61, 8.0), "light rain, 8°C");
});
