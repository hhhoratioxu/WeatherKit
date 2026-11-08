// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import AirQualityScale from "../class/AirQualityScale.mjs";
let result = {};
try {
    const match = $request.url.match(/^(https:\/\/weatherkit\.apple\.com\/api\/v1\/airQualityScale\/)([A-Z0-9]+(?:-[A-Z0-9]+)*)\/([^\/?#]+)([?#].*)?$/i);
    if (match && ["GET", "HEAD", "OPTIONS"].includes($request.method)) {
        const scale = match[3].replace(/\.\d+$/, "");
        const response = /^(HK|CN)\.AQHI$/.test(scale) ? new AirQualityScale().Build(match[2], scale) : undefined;
        if (response) result = { response };
        else if (scale !== match[3]) result = { url: `${match[1]}${match[2]}/${scale}${match[4] ?? ""}` };
    }
} catch { /* Preserve unknown scales and methods. */ }
$done(result);
