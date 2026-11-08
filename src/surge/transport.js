// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
// JSC entry: no WebAPI, storage, provider work, or body buffering.
let result = {};
try {
    const request = $request;
    const agent = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === "user-agent")?.[1];
    if (request.method === "GET" && /^https:\/\/weatherkit\.apple\.com\/api\/v3\/weather\//.test(request.url) && /^WeatherKit_Weather_(iOS|macOS)_/.test(agent ?? "")) {
        const headers = { ...request.headers };
        for (const key of Object.keys(headers)) if (key.toLowerCase() === "accept") delete headers[key];
        headers.Accept = "application/json";
        result = { headers };
    }
} catch { /* Preserve unknown request shapes. */ }
$done(result);
