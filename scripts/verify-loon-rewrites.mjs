// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
// Checks the emitted expressions and jq program. This is not a Loon parser or device test.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export function readLoonRules(plugin) {
    const lines = plugin.split("\n");
    const availability = lines.find(line => line.startsWith("response if ") && line.includes("response.json.jq("));
    const scale = lines.find(line => line.startsWith("request if ") && line.includes("url.replace("));
    assert.ok(availability && scale, "Both native Rewrite actions must be present");
    const jq = JSON.parse(availability.slice(availability.indexOf("response.json.jq(") + "response.json.jq(".length, -1));
    const expression = scale.match(/\$\{url\} ~= \/((?:\\.|[^/])*)\/([i]*) as scale then url\.replace\("\$\{scale\.1\}"\)$/);
    assert.ok(expression, "Use the documented named capture and a unique required URL guard");
    assert.ok(scale.startsWith(`request if (\${request.method} == "GET" || \${request.method} == "HEAD" || \${request.method} == "OPTIONS") && `));
    const regex = new RegExp(expression[1], expression[2]);
    const scripts = lines
        .filter(line => /^http-(request|response) /.test(line))
        .map(line => {
            const [stage, pattern] = line.split(" ");
            return { stage, regex: new RegExp(pattern), line };
        });
    return {
        jq,
        scripts,
        normalizeScale(url, method = "GET") {
            return ["GET", "HEAD", "OPTIONS"].includes(method) ? url.replace(regex, (_match, prefix) => prefix) : url;
        },
        mergeAvailability(value) {
            return JSON.parse(execFileSync("jq", ["-c", jq], { input: JSON.stringify(value), encoding: "utf8", maxBuffer: 1024 * 1024 }));
        },
        matchingScripts(url, stage = "http-request") {
            return scripts.filter(script => script.stage === stage && script.regex.test(url));
        },
    };
}

export default function verifyLoonRewrites(plugin) {
    const rules = readLoonRules(plugin),
        scenarios = [];
    assert.equal(rules.scripts.length, 4);
    const base = "https://weatherkit.apple.com/api/v1/airQualityScale/zh-Hans-CN/";
    for (const [suffix, expected] of [
        ["EU.EAQI.2604", "EU.EAQI"],
        ["US.AQI.12?lang=en-US&v=1#s", "US.AQI?lang=en-US&v=1#s"],
        ["HK.AQHI.8", "HK.AQHI"],
        ["CN.AQHI.8", "CN.AQHI"],
        ["EU.EAQI", "EU.EAQI"],
        ["EU.EAQI.preview", "EU.EAQI.preview"],
    ]) {
        assert.equal(rules.normalizeScale(base + suffix), base + expected);
        scenarios.push(`native scale URL: ${suffix}`);
    }
    assert.equal(rules.normalizeScale(`${base}EU.EAQI.12`, "POST"), `${base}EU.EAQI.12`);
    assert.equal(rules.normalizeScale(`${base.replace("weatherkit.apple.com", "example.com")}EU.EAQI.12`), `${base.replace("weatherkit.apple.com", "example.com")}EU.EAQI.12`);
    scenarios.push("URL normalization preserves POST and unrelated hosts");
    for (const suffix of ["EU.EAQI.2604", "US.AQI.12", "HK.AQHI.8", "CN.AQHI.8"]) {
        const url = rules.normalizeScale(base + suffix);
        assert.equal(rules.matchingScripts(url).length, /^(HK|CN)/.test(suffix) ? 1 : 0);
    }
    assert.equal(rules.matchingScripts("https://weatherkit.apple.com/api/v1/availability/en-US/31.2/121.5", "http-response").length, 0);
    scenarios.push("availability and ordinary scales start no JavaScript; custom scales use the small entry");
    for (const prefix of ["", "lang=zh-CN&"]) {
        for (const ids of ["fixture-101190110", "31.2,121.5", "-31.2,-121.5"]) assert.equal(rules.matchingScripts(`https://weatherkit.apple.com/api/v1/weatherAlerts?${prefix}ids=${ids}`).length, 1);
    }
    scenarios.push("alert routes accept first or subsequent ids parameters");
    const merged = rules.mergeAvailability(["currentWeather", "weatherMaps", "currentWeather"]);
    assert.deepEqual(merged.slice(0, 2), ["currentWeather", "weatherMaps"]);
    assert.equal(new Set(merged).size, merged.length);
    assert.ok(merged.includes("forecastNextHour") && merged.includes("weatherAlerts"));
    scenarios.push("native jq keeps Apple ordering and unknown capabilities without duplicates");
    for (const value of [{ error: "fixture" }, ["currentWeather", { future: true }], null, 7]) assert.deepEqual(rules.mergeAvailability(value), value);
    assert.ok(rules.mergeAvailability([]).includes("airQuality"));
    scenarios.push("native jq preserves unknown shapes and handles an empty capability list");
    return { pass: scenarios.length, fail: 0, scenarios, validation: "emitted expressions, JavaScript regex fixtures and system jq; not a Loon parser", deviceValidation: false };
}
