// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import { Response } from "../process/Response.mjs";

(async () => {
    const request = $request, response = $response;
    if (request.method !== "GET" || response.status !== 200) return {};
    const url = new URL(request.url);
    if (url.hostname !== "weatherkit.apple.com" || url.protocol !== "https:") return {};
    const type = Object.entries(response.headers ?? {}).find(([key]) => key.toLowerCase() === "content-type")?.[1]?.split(";")[0].trim().toLowerCase();
    if (url.pathname.startsWith("/api/v3/weather/")) {
        const agent = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === "user-agent")?.[1];
        if (!/^WeatherKit_Weather_(iOS|macOS)_/.test(agent ?? "") || type !== "application/json" || typeof response.body !== "string") return {};
    } else if (!url.pathname.startsWith("/api/v2/weather/") || type !== "application/vnd.apple.flatbuffer" || !(response.body instanceof Uint8Array)) return {};
    const originalBody = response.body;
    const result = await Response(request, response);
    if (result.body === originalBody) return {};
    const headers = { ...result.headers };
    for (const key of Object.keys(headers)) if (["content-length", "content-encoding", "transfer-encoding", "etag", "last-modified", "content-md5", "digest", "cache-control"].includes(key.toLowerCase())) delete headers[key];
    headers["Cache-Control"] = "no-store";
    return { body: result.body, headers };
})().then(value => $done(value), () => $done({}));
