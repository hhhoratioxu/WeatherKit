// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
// v3 JSON is negotiated with Apple; never feed WK3 bytes into the WK2 schema.
import { Console } from "@nsnanocat/util";
import ProviderRequestCache, { providerErrorCode } from "../class/ProviderRequestCache.mjs";
import createProviderEnvironment from "../function/createProviderEnvironment.mjs";
import database from "../function/database.mjs";
import parseWeatherKitURL from "../function/parseWeatherKitURL.mjs";
import planWeatherProducts from "../function/planWeatherProducts.mjs";
import { cloneWeatherProduct, weatherProductsEqual } from "../function/providerRecovery.mjs";
import setENV from "../function/setENV.mjs";
import utf8Length from "../function/utf8Length.mjs";
import { MAX_DECODED_VECTOR_ENTRIES, MAX_WEATHER_BODY_BYTES } from "../function/weatherMemoryLimits.mjs";

export const MAX_WEATHER_JSON_CHARACTERS = 1024 * 1024;
const productNames = ["airQuality", "currentWeather", "forecastDaily", "forecastHourly", "forecastNextHour", "weatherAlerts"];
const providerMethods = new Set(["WeatherNow", "CurrentWeather", "Hourly", "ForecastHourly", "Daily", "Minutely", "WeatherAlert", "WeatherAlertWeb"]);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);

// Share the existing per-product vector budget. Reject before starting provider work.
export function boundedWeatherJSON(value) {
    let entries = 0, nodes = 0;
    function visit(item, depth) {
        if (++nodes > 100000 || depth > 64) throw new RangeError("Weather JSON exceeds traversal bounds");
        if (!item || typeof item !== "object") return;
        if (Array.isArray(item)) {
            entries += item.length;
            if (entries > MAX_DECODED_VECTOR_ENTRIES) throw new RangeError("Weather product exceeds vector decoding budget");
            for (const child of item) visit(child, depth + 1);
        } else for (const key of Object.keys(item)) visit(item[key], depth + 1);
    }
    visit(value, 0);
    return value;
}

// Provider graphs are owned by their consumer. Apple input graphs stay read-only.
export function adaptV3ProviderProduct(product) {
    if (!object(product)) return product;
    boundedWeatherJSON(product);
    function visit(value) {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
            for (const child of value) visit(child);
            return;
        }
        for (const key of Object.keys(value)) {
            let item = value[key];
            if (typeof item === "number" && !Number.isFinite(item)) {
                delete value[key];
                continue;
            }
            if ((key === "conditionCode" || key === "precipitationType" || key === "condition") && typeof item === "string") value[key] = item = [item];
            if ((key === "precipitationAmount" || key === "snowfallAmount") && typeof item === "number") {
                // WK3 uses statistics tables. A provider point value has equal bounds.
                value[key] = item = { expected: item, minimum: item, maximum: item };
            }
            if (key === "metadata" && object(item)) {
                for (const coordinate of ["latitude", "longitude"]) if (typeof item[coordinate] === "string") {
                    const number = Number(item[coordinate]);
                    if (item[coordinate].trim() && Number.isFinite(number)) item[coordinate] = number;
                    else delete item[coordinate];
                }
            }
            visit(item);
        }
    }
    visit(product);
    return product;
}

function v3Environment(environment) {
    function wrap(provider) {
        return new Proxy(provider, {
            get(target, key) {
                const value = Reflect.get(target, key, target);
                if (typeof value !== "function") return value;
                if (providerMethods.has(key)) return async (...args) => adaptV3ProviderProduct(await value.apply(target, args));
                return value.bind(target);
            },
        });
    }
    let colorfulClouds, qWeather;
    return {
        country: environment.country,
        requestCache: environment.requestCache,
        get colorfulClouds() { return colorfulClouds ??= wrap(environment.colorfulClouds); },
        get qWeather() { return qWeather ??= wrap(environment.qWeather); },
        get waqi() { return environment.waqi; },
    };
}

export default async function ResponseJSONV3(request, response, injectors) {
    const url = new URL(request.url);
    if (url.hostname !== "weatherkit.apple.com" || !/^\/api\/v3\/weather\//.test(url.pathname) || (request.method && request.method !== "GET") || (response.status !== undefined && response.status !== 200)) return response;
    const raw = response.body;
    if (typeof raw !== "string" || raw.length > MAX_WEATHER_JSON_CHARACTERS || utf8Length(raw, MAX_WEATHER_BODY_BYTES) > MAX_WEATHER_BODY_BYTES) return response;
    const parameters = parseWeatherKitURL(url);
    const latitude = Number(parameters.latitude), longitude = Number(parameters.longitude);
    if (!parameters.version || parameters.latitude === undefined || parameters.longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return response;
    let body;
    try { body = JSON.parse(raw); } catch { return response; }
    if (!object(body) || !productNames.some(name => object(body[name]) && object(body[name].metadata))) return response;
    const { Settings, Caches } = setENV("iRingo", "WeatherKit", database);
    Console.logLevel = Settings.LogLevel;
    const regionParameters = parseWeatherKitURL(url, { fallback: Settings.Region?.Fallback ?? "Auto" });
    const requested = regionParameters.dataSets.filter(name => Settings.DataSets.includes(name));
    const selected = planWeatherProducts(requested, Settings, regionParameters.country, Boolean(body.forecastNextHour));
    const eligible = selected.filter(name => {
        try {
            if (body[name] !== undefined && (!object(body[name]) || !object(body[name].metadata))) return false;
            boundedWeatherJSON(body[name]);
            return typeof injectors[name] === "function";
        } catch { return false; }
    });
    if (!eligible.length) return response;
    const cache = ProviderRequestCache.fromSettings(Settings);
    const environment = v3Environment(createProviderEnvironment({ ...regionParameters, weatherKitLanguage: body.weatherAlerts?.metadata?.language }, Settings, cache));
    let modified = false;
    try {
        await Promise.all(eligible.map(async name => {
            const original = body[name];
            try {
                const input = name === "airQuality" ? cloneWeatherProduct(original) : original;
                const value = name === "airQuality" ? await injectors[name](input, Settings, Caches, environment) : await injectors[name](input, Settings, environment);
                if (!weatherProductsEqual(value, original)) {
                    // AQI and warning injectors can also add numeric metadata fields.
                    body[name] = adaptV3ProviderProduct(value);
                    modified = true;
                }
            } catch (error) {
                body[name] = original;
                cache.noteFallback(name, providerErrorCode(error));
            }
        }));
        if (!modified) return response;
        let encoded;
        try { encoded = JSON.stringify(body); } catch { return response; }
        if (encoded.length > MAX_WEATHER_JSON_CHARACTERS || utf8Length(encoded, MAX_WEATHER_BODY_BYTES) > MAX_WEATHER_BODY_BYTES) return response;
        const headers = { ...response.headers };
        for (const name of Object.keys(headers)) if (["etag", "last-modified", "content-md5", "digest", "content-length"].includes(name.toLowerCase())) delete headers[name];
        for (const name of Object.keys(headers)) if (name.toLowerCase() === "cache-control") delete headers[name];
        headers["Cache-Control"] = "no-store";
        return { ...response, headers, body: encoded };
    } finally { cache.report("response-v3-json"); }
}
