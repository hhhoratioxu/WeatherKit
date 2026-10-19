// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
// Offline work counts and Node timings. These do not measure iPhone energy or VPN behavior.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import alias from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { ByteBuffer } from "flatbuffers";
import { rollup } from "rollup";
import WeatherKit2 from "../src/class/WeatherKit2.mjs";
import { readLoonRules } from "./verify-loon-rewrites.mjs";

const root = path.resolve(import.meta.dirname, ".."),
    baseline = "6e5a73124e4ff7e45d263e954f365d87af5095c8";
const original = file => execFileSync("git", ["show", `${baseline}:${file}`], { cwd: root });
const current = file => readFile(path.join(root, file));
const bundleFiles = ["WeatherKit.plugin", "request.bundle.js", "response.bundle.js", "scale.bundle.js"];
const baselineFiles = Object.fromEntries(bundleFiles.filter(name => name !== "scale.bundle.js").map(name => [name, original(`Loon/script/${name}`)]));
const optimizedFiles = Object.fromEntries(await Promise.all(bundleFiles.map(async name => [name, await current(`Loon/script/${name}`)])));
const modules = ["src/class/ProviderRequestCache.mjs", "src/class/ColorfulClouds.mjs", "src/function/resolveWeatherRegion.mjs"];
const builds = [];
for (const optimized of [false, true]) {
    const code = {};
    for (const file of modules) {
        const bundle = await rollup({
            input: path.join(root, file),
            plugins: [
                {
                    name: "fixed-baseline-source",
                    load(id) {
                        if (!optimized && id.startsWith(`${root}/src/`) && id.endsWith(".mjs")) return original(path.relative(root, id)).toString();
                    },
                },
                alias({ entries: [{ find: "@nsringo/weatherkit", replacement: path.join(root, "node_modules/@nsringo/weatherkit/dist/index.js") }] }),
                nodeResolve({ browser: true }),
            ],
        });
        code[file] = (await bundle.generate({ format: "iife", name: "WK", exports: "named" })).output[0].code;
        await bundle.close();
    }
    builds.push(code);
}
function context({ storage = new Map(), now = Date.UTC(2026, 9, 19, 0, 0, 10) } = {}) {
    const stats = { persistentReads: 0, persistentWrites: 0, nativeRequests: 0, logMessages: 0 },
        time = { now };
    const ctx = vm.createContext({
        URL,
        URLSearchParams,
        TextDecoder,
        Uint8Array,
        Date: class extends Date {
            constructor(...args) {
                super(...(args.length ? args : [time.now]));
            }
            static now() {
                return time.now;
            }
        },
        $loon: "offline measurement",
        $script: { startTime: new Date() },
        $argument: { Storage: "Argument", LogLevel: "OFF" },
        $persistentStore: {
            read(key) {
                stats.persistentReads++;
                return storage.get(key);
            },
            write(value, key) {
                stats.persistentWrites++;
                storage.set(key, value);
                return true;
            },
        },
        $httpClient: {
            get(_request, callback) {
                stats.nativeRequests++;
                callback(null, { status: 200, headers: {} }, JSON.stringify({ status: "ok", result: { hourly: { status: "ok", air_quality: { aqi: [{ value: { usa: 42, chn: 40 } }] } } } }));
            },
        },
        console: {
            log() {
                stats.logMessages++;
            },
            info() {
                stats.logMessages++;
            },
            warn() {
                stats.logMessages++;
            },
            error() {
                stats.logMessages++;
            },
        },
    });
    return { ctx, stats, time, storage };
}
const snapshot = [],
    yesterday = [],
    regionWrites = [];
for (let variant = 0; variant < 2; variant++) {
    const cacheCode = builds[variant][modules[0]],
        state = context();
    vm.runInContext(cacheCode, state.ctx);
    const options = { product: "fixture", validate: body => body.status === "ok", fetcher: async () => ({ status: 200, headers: {}, body: '{"status":"ok"}' }) };
    const requests = Array.from({ length: 6 }, (_, n) => ({ url: `https://fixture.invalid/data?item=${n}` }));
    const seed = new state.ctx.WK.default();
    for (const request of requests) await seed.fetch(request, options);
    state.stats.persistentReads = 0;
    const fresh = new state.ctx.WK.default();
    for (const request of requests) await fresh.fetch(request, options);
    snapshot.push({ implementation: variant ? "cache-v4" : "cache-v3", consumers: 6, snapshotReads: state.stats.persistentReads, persistentHits: fresh.stats.persistentHits });
    const store = new Map();
    let nativeRequests = 0;
    for (let n = 0; n < 6; n++) {
        const run = context({ storage: store, now: Date.UTC(2026, 9, 19, 0, 0, 10 + n * 10) });
        vm.runInContext(builds[variant][modules[1]], run.ctx);
        const cache = new state.ctx.WK.default({
            ttls: { forecast: 180 },
            now: () => run.time.now,
            store: {
                read: () => store.get("cache"),
                write: value => {
                    store.set("cache", value);
                    return true;
                },
            },
        });
        const provider = new run.ctx.WK.default({ latitude: 31.2, longitude: 121.5, country: "CN", language: "zh-CN", version: "v2" }, "offline-fixture", cache);
        assert.equal((await provider.YesterdayAirQuality()).index, 42);
        nativeRequests += run.stats.nativeRequests;
    }
    yesterday.push({ implementation: variant ? "cache-v4" : "cache-v3", freshExecutions: 6, intervalSeconds: 10, forecastTTLSeconds: 180, nativeRequests });
    const region = context();
    vm.runInContext(builds[variant][modules[2]], region.ctx);
    for (let n = 0; n < 6; n++) {
        assert.equal(region.ctx.WK.default({ latitude: 32.39, longitude: 119.499, explicitCountry: "CN", now: () => region.time.now }), "CN");
        region.time.now += 10000;
    }
    regionWrites.push({ implementation: variant ? "cache-v4" : "cache-v3", refreshes: 6, hintWrites: region.stats.persistentWrites });
}
assert.deepEqual(
    snapshot.map(r => r.snapshotReads),
    [6, 1],
);
assert.deepEqual(
    yesterday.map(r => r.nativeRequests),
    [6, 1],
);
assert.deepEqual(
    regionWrites.map(r => r.hintWrites),
    [6, 1],
);

const minute = { condition: [], summary: [], metadata: { providerName: "Apple", temporarilyUnavailable: false }, minutes: Array.from({ length: 85 }, (_, n) => ({ startTime: 1792368000 + n * 60, precipitationIntensity: 0.1, precipitationChance: 0.5, precipitationType: "RAIN" })) };
const hourly = { metadata: { providerName: "Apple", temporarilyUnavailable: false }, hours: Array.from({ length: 273 }, (_, n) => ({ forecastStart: 1792368000 + n * 3600, temperature: 23 + (n % 7), precipitationAmountByType: [], snowfallAmount: 0 })) };
const raw = WeatherKit2.encode(undefined, { forecastNextHour: minute, forecastHourly: hourly });
assert.equal(WeatherKit2.decode(new ByteBuffer(raw), ["forecastNextHour"]).forecastNextHour.minutes.length, 85);
assert.equal(WeatherKit2.decode(new ByteBuffer(raw), ["forecastHourly"]).forecastHourly.hours.length, 273);
const timings = [];
for (const [implementation, files] of [
    ["cache-v3", baselineFiles],
    ["cache-v4", optimizedFiles],
]) {
    const script = new vm.Script(files["response.bundle.js"].toString()),
        samples = [],
        cpu = process.cpuUsage();
    let logMessages = 0;
    for (let n = 0; n < 45; n++) {
        const run = context();
        Object.assign(run.ctx, {
            $argument: { Storage: "Argument", LogLevel: "OFF", DataSets: "forecastHourly,forecastNextHour", "Weather.Provider": "WeatherKit", "NextHour.Provider": "WeatherKit" },
            $request: { url: "https://weatherkit.apple.com/api/v2/weather/en-US/31.2/121.5?country=CN&dataSets=forecastHourly,forecastNextHour", headers: {}, method: "GET" },
            $response: { status: 200, headers: { "Content-Type": "application/vnd.apple.flatbuffer" }, body: raw },
        });
        let output,
            calls = 0;
        const complete = new Promise(resolve => {
            run.ctx.$done = value => {
                calls++;
                output = value;
                resolve();
            };
        });
        const start = performance.now();
        script.runInContext(run.ctx, { timeout: 2000 });
        await complete;
        const elapsed = performance.now() - start;
        assert.equal(calls, 1);
        assert.equal(run.stats.nativeRequests, 0);
        assert.deepEqual(Array.from(output.body), Array.from(raw));
        if (n >= 5) samples.push(elapsed);
        logMessages += run.stats.logMessages;
    }
    samples.sort((a, b) => a - b);
    const used = process.cpuUsage(cpu);
    timings.push({
        implementation,
        fixtureBytes: raw.length,
        fixtureHours: 273,
        fixtureMinutes: 85,
        samples: samples.length,
        discardedWarmups: 5,
        medianScriptMilliseconds: Number(samples[20].toFixed(3)),
        p95ScriptMilliseconds: Number(samples[38].toFixed(3)),
        totalProcessCpuMillisecondsIncludingContextsAndAssertions: (used.user + used.system) / 1000,
        originalBytesPreserved: true,
        totalLogMessagesWithLogLevelOFF: logMessages,
    });
}
const rules = readLoonRules(optimizedFiles["WeatherKit.plugin"].toString());
const startup = [
    { route: "availability", beforeJavaScriptStarts: 1, afterJavaScriptStarts: rules.matchingScripts("https://weatherkit.apple.com/api/v1/availability/en-US/31.2/121.5", "http-response").length, beforeScriptBytes: baselineFiles["response.bundle.js"].length, afterScriptBytes: 0 },
    { route: "ordinary scale", beforeJavaScriptStarts: 1, afterJavaScriptStarts: rules.matchingScripts(rules.normalizeScale("https://weatherkit.apple.com/api/v1/airQualityScale/zh-Hans-CN/EU.EAQI.2604")).length, beforeScriptBytes: baselineFiles["request.bundle.js"].length, afterScriptBytes: 0 },
    { route: "custom HK/CN scale", beforeJavaScriptStarts: 1, afterJavaScriptStarts: 1, beforeScriptBytes: baselineFiles["request.bundle.js"].length, afterScriptBytes: optimizedFiles["scale.bundle.js"].length },
    { route: "alert details", beforeJavaScriptStarts: 1, afterJavaScriptStarts: 1, beforeScriptBytes: baselineFiles["request.bundle.js"].length, afterScriptBytes: optimizedFiles["request.bundle.js"].length },
];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const report = {
    measuredDate: "2026-10-19",
    environment: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        runtime: "Node VM with real modules and compiled bundles; mocked Loon storage and HTTP",
        timingScope: "script evaluation and async completion; VM creation and precompilation excluded from per-script latency",
        nativeRewriteScope: "emitted configuration, regex fixtures and system jq, not Loon execution",
    },
    baselineCommit: baseline,
    optimizedSourceSHA256: Object.fromEntries(await Promise.all([...modules, "src/process/Response.mjs", "template/loon.handlebars"].map(async file => [file, digest(await current(file))]))),
    optimizedBundleSHA256: Object.fromEntries(Object.entries(optimizedFiles).map(([file, bytes]) => [file, digest(bytes)])),
    startup,
    persistedProductReads: snapshot,
    yesterdayAirQuality: yesterday,
    coordinateHintWrites: regionWrites,
    unchangedForecast: timings,
    liveProviderRequests: false,
    actualBatteryMeasurement: false,
    actualLoonDeviceValidation: false,
    limits: "Work counts are reproducible fixtures, not traffic-wide or energy savings. Timing and CPU results depend on Node, host load and fixture. Native Rewrite still costs Loon CPU. Default freshness, concurrency and cache capacity are unchanged.",
};
await writeFile(path.join(root, "docs/power-work-measurements.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
