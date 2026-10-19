// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
// Actual Node/V8 measurements with mocked Loon callbacks, not iPhone or native VPN memory.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Session } from "node:inspector";
import path from "node:path";
import vm from "node:vm";
import alias from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { ByteBuffer } from "flatbuffers";
import { rollup } from "rollup";
import WeatherKit2 from "../src/class/WeatherKit2.mjs";

const root = path.resolve(import.meta.dirname, ".."),
    baseline = "24be1f0f03a0cf6a97cead4572873c9bcec166dc";
const digest = value => createHash("sha256").update(value).digest("hex");
const original = file => execFileSync("git", ["show", `${baseline}:${file}`], { cwd: root });
const baseTime = 1792368000;

function weatherFixture() {
    return WeatherKit2.encode(undefined, {
        forecastHourly: {
            metadata: { providerName: "Apple", temporarilyUnavailable: false },
            hours: Array.from({ length: 273 }, (_, n) => ({
                forecastStart: baseTime + n * 3600,
                temperature: 20 + (n % 5),
                humidity: 50,
                windDirection: 90,
                windSpeed: 2,
                precipitationAmountByType: [
                    { precipitationType: "RAIN", expected: 0.1 },
                    { precipitationType: "SNOW", expected: 0 },
                ],
            })),
        },
        forecastNextHour: { metadata: { providerName: "Apple", temporarilyUnavailable: false }, condition: [], summary: [], minutes: Array.from({ length: 85 }, (_, n) => ({ startTime: baseTime + n * 60, precipitationChance: 0.3, precipitationIntensity: 0.1 })) },
    });
}

async function sample(codePath, scenario) {
    assert.equal(typeof global.gc, "function", "Run the child with --expose-gc");
    const code = await readFile(codePath, "utf8"),
        script = new vm.Script(code, { filename: "WeatherKitMeasuredBundle.js" });
    const raw = weatherFixture(),
        persistent = new Map(),
        callbacks = [];
    const stats = { nativeRequests: 0, fixtureJSONParses: 0, fixtureJSONCharactersParsed: 0, doneCalls: 0 };
    const hourly = JSON.stringify({
        code: "200",
        __memoryFixture: true,
        padding: "x".repeat(24000),
        updateTime: "2026-10-19T00:00:00Z",
        hourly: Array.from({ length: 24 }, (_, n) => ({ fxTime: new Date((baseTime + n * 3600) * 1000).toISOString(), temp: "30", text: "晴", cloud: "20", humidity: "50", precip: "0", pop: "10", pressure: "1000", dew: "10", wind360: "90", windSpeed: "2" })),
    });
    const realtime = JSON.stringify({
        status: "ok",
        __memoryFixture: true,
        padding: "x".repeat(24000),
        location: [31.2, 121.5],
        server_time: baseTime,
        result: { server_time: baseTime, alert: { status: "ok", content: [] }, realtime: { status: "ok", temperature: 23, apparent_temperature: 24, cloudrate: 0.2, skycon: "CLEAR_DAY", humidity: 0.8, precipitation: { local: { intensity: 0 } }, pressure: 100000, visibility: 10, wind: { direction: 90, speed: 1 } } },
    });
    let resolve;
    const completion = new Promise(done => {
        resolve = done;
    });
    const context = vm.createContext({
        URL,
        URLSearchParams,
        TextDecoder,
        Uint8Array,
        $loon: "offline memory measurement",
        $script: { startTime: new Date() },
        $argument: { Storage: "Argument", LogLevel: "OFF", DataSets: "forecastHourly", "Weather.Provider": "QWeather" },
        $request: { url: "https://weatherkit.apple.com/api/v2/weather/zh-Hans-CN/31.2/121.5?country=CN&dataSets=forecastHourly", method: "GET", headers: {} },
        $response: { status: 200, headers: { "Content-Type": "application/vnd.apple.flatbuffer" }, body: raw },
        $persistentStore: {
            read: key => persistent.get(key),
            write(value, key) {
                persistent.set(key, value);
                return true;
            },
        },
        $httpClient: {
            get(_request, callback) {
                stats.nativeRequests++;
                callbacks.push(callback);
            },
        },
        console: { log() {}, info() {}, warn() {}, error() {} },
        $done(value) {
            stats.doneCalls++;
            resolve(value);
        },
        __countJSON(text) {
            if (typeof text === "string" && (text.startsWith('{"code":"200","__memoryFixture":') || text.startsWith('{"status":"ok","__memoryFixture":'))) {
                stats.fixtureJSONParses++;
                stats.fixtureJSONCharactersParsed += text.length;
            }
        },
    });
    vm.runInContext("const parse = JSON.parse; JSON.parse = (text, reviver) => { __countJSON(text); return parse(text, reviver); };", context);
    const inspector = new Session();
    inspector.connect();
    const post = (method, params = {}) => new Promise((done, fail) => inspector.post(method, params, (error, result) => (error ? fail(error) : done(result))));
    global.gc();
    const before = process.memoryUsage();
    await post("HeapProfiler.startSampling", { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    script.runInContext(context, { timeout: 2000 });
    if (scenario === "six-json-consumers") {
        vm.runInContext('const provider = new WK.default({latitude:31.2,longitude:121.5,country:"CN",language:"zh-CN",version:"v2"},"offline-fixture"); globalThis.finished = Promise.all(Array.from({length:6}, () => provider.CurrentWeather()));', context);
    }
    await new Promise(done => setImmediate(done));
    assert.equal(callbacks.length, 1);
    const observedBeforeGC = process.memoryUsage().heapUsed - before.heapUsed;
    global.gc();
    const waiting = process.memoryUsage();
    for (const callback of callbacks.splice(0)) callback(null, { status: scenario === "hourly-failure" ? 503 : 200, headers: {} }, scenario === "six-json-consumers" ? realtime : scenario === "hourly-failure" ? "{}" : hourly);
    const output = scenario === "six-json-consumers" ? await context.finished : await completion;
    const observedAfterGCWork = process.memoryUsage().heapUsed - before.heapUsed;
    global.gc();
    const complete = process.memoryUsage();
    const { profile } = await post("HeapProfiler.stopSampling");
    inspector.disconnect();
    const totalSamples = node => node.selfSize + node.children.reduce((sum, child) => sum + totalSamples(child), 0);
    if (scenario === "six-json-consumers") assert.ok(output.every(product => product.temperature === 23));
    else {
        assert.equal(stats.doneCalls, 1);
        if (scenario === "hourly-failure") assert.deepEqual(Array.from(output.body), Array.from(raw));
        else {
            const changed = WeatherKit2.decode(new ByteBuffer(output.body), ["forecastHourly"]).forecastHourly.hours;
            assert.equal(changed[0].temperature, 30);
            assert.equal(changed[24].temperature, 24);
            assert.equal(changed.length, 273);
        }
    }
    return {
        scenario,
        fixtureWeatherBytes: raw.length,
        providerBodyCharacters: scenario === "six-json-consumers" ? realtime.length : scenario === "hourly-success" ? hourly.length : 2,
        ...stats,
        retainedHeapDeltaWhileAwaitingCallback: waiting.heapUsed - before.heapUsed,
        retainedHeapDeltaAfterCompletion: complete.heapUsed - before.heapUsed,
        observedHeapDeltaBeforeWaitingGC: observedBeforeGC,
        observedHeapDeltaBeforeCompletionGC: observedAfterGCWork,
        sampledAllocationBytes: totalSamples(profile.head),
        allocationSamples: profile.samples.length,
        externalBytesDeltaAtCompletion: complete.external - before.external,
        arrayBufferBytesDeltaAtCompletion: complete.arrayBuffers - before.arrayBuffers,
    };
}

if (process.argv[2] === "--sample") {
    console.log(JSON.stringify(await sample(process.argv[3], process.argv[4])));
} else {
    const work = path.join(root, ".cache/memory-work");
    await mkdir(work, { recursive: true });
    await writeFile(path.join(work, "baseline-response.js"), original("Loon/script/response.bundle.js"));
    await writeFile(path.join(work, "optimized-response.js"), await readFile(path.join(root, "Loon/script/response.bundle.js")));
    for (const variant of ["baseline", "optimized"]) {
        const bundle = await rollup({
            input: path.join(root, "src/class/ColorfulClouds.mjs"),
            plugins: [
                {
                    name: "fixed-baseline",
                    load(id) {
                        if (variant === "baseline" && id.startsWith(`${root}/src/`) && id.endsWith(".mjs")) return original(path.relative(root, id)).toString();
                    },
                },
                alias({ entries: [{ find: "@nsringo/weatherkit", replacement: path.join(root, "node_modules/@nsringo/weatherkit/dist/index.js") }] }),
                nodeResolve({ browser: true }),
            ],
        });
        await writeFile(path.join(work, `${variant}-provider.js`), (await bundle.generate({ format: "iife", name: "WK", exports: "named" })).output[0].code);
        await bundle.close();
    }
    const measurements = [];
    for (const scenario of ["hourly-failure", "hourly-success", "six-json-consumers"])
        for (const variant of ["baseline", "optimized"]) {
            const samples = Array.from({ length: 5 }, () => JSON.parse(execFileSync(process.execPath, ["--expose-gc", import.meta.filename, "--sample", path.join(work, `${variant}-${scenario === "six-json-consumers" ? "provider" : "response"}.js`), scenario], { cwd: root, encoding: "utf8", timeout: 15000 })));
            const median = key => samples.map(sample => sample[key]).sort((a, b) => a - b)[2];
            measurements.push({
                scenario,
                implementation: variant === "baseline" ? "cache-v4" : "cache-v5",
                independentProcesses: samples.length,
                nativeRequests: median("nativeRequests"),
                fixtureJSONParses: median("fixtureJSONParses"),
                fixtureJSONCharactersParsed: median("fixtureJSONCharactersParsed"),
                medianRetainedHeapBytesWhileAwaitingCallback: median("retainedHeapDeltaWhileAwaitingCallback"),
                medianRetainedHeapBytesAfterCompletion: median("retainedHeapDeltaAfterCompletion"),
                medianSampledAllocationBytes: median("sampledAllocationBytes"),
                samples,
            });
        }
    assert.deepEqual(
        measurements.filter(row => row.scenario === "six-json-consumers").map(row => row.fixtureJSONParses),
        [13, 6],
    );
    assert.deepEqual(
        measurements.filter(row => row.scenario === "hourly-success").map(row => row.fixtureJSONParses),
        [3, 1],
    );
    const sourceFiles = [
        "src/process/Response.mjs",
        "src/process/Response.dev.mjs",
        "src/class/WeatherKit2.mjs",
        "src/class/AirQuality.mjs",
        "src/class/ProviderRequestCache.mjs",
        "src/class/ColorfulClouds.mjs",
        "src/class/QWeather.mjs",
        "src/class/WAQI.mjs",
        "src/function/mergeForecastCopy.mjs",
        "src/function/weatherMemoryLimits.mjs",
    ];
    const report = {
        measuredDate: "2026-10-19",
        baselineCommit: baseline,
        environment: { node: process.version, platform: process.platform, arch: process.arch, runtime: "Node/V8 independent subprocesses, real compressed response bundles and real provider source bundles, mocked Loon HTTP/storage", samplingIntervalBytes: 4096, includeCollectedAllocations: true, repetitions: 5 },
        method: "Fixtures, vm.Script compilation and VM construction occur before the initial full GC. Retained heap is sampled after full GC while one native callback is pending and after completion. V8 allocation sampling covers script evaluation and async processing including collected allocations, GC probes and harness overhead; it is statistical, not an exact allocation or native-memory total. No device peak-memory claim.",
        measurements,
        optimizedSourceSHA256: Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, digest(await readFile(path.join(root, file)))]))),
        optimizedBundleSHA256: { "response.bundle.js": digest(await readFile(path.join(root, "Loon/script/response.bundle.js"))) },
        liveProviderRequests: false,
        realLoonMemoryMeasurement: false,
        actualDeviceValidation: false,
        limits: "V8 heap excludes Loon/JSC native HTTP and compression buffers. Isolated fixtures are not overall VPN memory, device stability or battery measurements. Estimated allocations and retained-heap deltas can vary or regress; raw samples include both.",
    };
    await writeFile(path.join(root, "docs/memory-work-measurements.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(
        JSON.stringify(
            measurements.map(({ samples, ...summary }) => summary),
            null,
            2,
        ),
    );
}
