// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import mergeWeatherKitAvailability from "../function/mergeWeatherKitAvailability.mjs";

let result = {};
try {
    if ($request.method === "GET" && $response.status === 200 && /^https:\/\/weatherkit\.apple\.com\/api\/v1\/availability\//.test($request.url) && typeof $response.body === "string" && $response.body.length <= 65536) {
        const type = Object.entries($response.headers ?? {}).find(([key]) => key.toLowerCase() === "content-type")?.[1]?.split(";")[0].trim().toLowerCase();
        const value = type === "application/json" ? JSON.parse($response.body) : undefined;
        if (Array.isArray(value) && value.length <= 1024 && value.every(item => typeof item === "string")) {
            const merged = mergeWeatherKitAvailability(value, ["airQuality", "currentWeather", "forecastDaily", "forecastHourly", "forecastPeriodic", "historicalComparisons", "weatherChanges", "forecastNextHour", "weatherAlerts", "weatherAlertNotifications", "news"]);
            if (merged.length !== value.length || merged.some((item, index) => item !== value[index])) {
                const headers = { ...$response.headers };
                for (const key of Object.keys(headers)) if (["content-length", "content-encoding", "transfer-encoding", "etag", "last-modified", "content-md5", "digest", "cache-control"].includes(key.toLowerCase())) delete headers[key];
                headers["Cache-Control"] = "no-store";
                result = { body: JSON.stringify(merged), headers };
            }
        }
    }
} catch { /* Unknown/oversized availability stays opaque. */ }
$done(result);
