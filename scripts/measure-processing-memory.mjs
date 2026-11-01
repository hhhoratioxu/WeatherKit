// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
// Published CI bundles in independent Node/V8 processes; no real Loon/device claim.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Session } from "node:inspector";
import path from "node:path";
import vm from "node:vm";
import { ByteBuffer } from "flatbuffers";
import WeatherKit2 from "../src/class/WeatherKit2.mjs";
import { weatherFixture, weatherNow } from "../tests/fixtures/processingMemoryFixture.mjs";

const root = path.resolve(import.meta.dirname, ".."),
    baseline = "1495f2464c792741fe357518fcb2f62b9fb82599";
const hash = value => createHash("sha256").update(value).digest("hex");
async function sample(file, scenario, mode) {
    const raw = scenario === "mixed-weather" ? weatherFixture(273, 4) : scenario === "alerts-failure" ? weatherFixture(0, 48) : weatherFixture(0, 0);
    const original = raw.slice(),
        nowBody = JSON.stringify(weatherNow),
        stored = new Map(),
        callbacks = [];
    const products = scenario === "mixed-weather" ? "currentWeather,forecastHourly,weatherAlerts" : scenario === "alerts-failure" ? "weatherAlerts" : "currentWeather";
    let doneCalls = 0,
        requests = 0,
        reads = 0,
        writes = 0,
        resolve;
    const finished = new Promise(done => {
        resolve = done;
    });
    const fixedTime = Date.UTC(2026, 10, 1);
    class FixtureDate extends Date {
        constructor(...args) {
            super(...(args.length ? args : [fixedTime]));
        }
        static now() {
            return fixedTime;
        }
    }
    const script = new vm.Script(await readFile(file, "utf8"));
    const context = vm.createContext({
        URL,
        URLSearchParams,
        TextDecoder,
        Uint8Array,
        Date: FixtureDate,
        $loon: "offline processing measurement",
        $script: { startTime: new FixtureDate() },
        $argument: { Storage: "Argument", LogLevel: "OFF", DataSets: products, "Weather.Provider": "QWeather", "WeatherAlerts.Provider": "ColorfulClouds" },
        $request: { url: `https://weatherkit.apple.com/api/v2/weather/zh-Hans-CN/32.39/119.499?country=CN&dataSets=${products}`, method: "GET", headers: {} },
        $response: { status: 200, headers: { "Content-Type": "application/vnd.apple.flatbuffer" }, body: raw },
        $persistentStore: {
            read(key) {
                reads++;
                return stored.get(key);
            },
            write(value, key) {
                writes++;
                stored.set(key, value);
                return true;
            },
        },
        $httpClient: {
            get(request, callback) {
                requests++;
                callbacks.push({ request, callback });
            },
        },
        console: { log() {}, info() {}, warn() {}, error() {} },
        $done(value) {
            doneCalls++;
            resolve(value);
        },
    });
    const inspector = mode === "memory" ? new Session() : undefined;
    inspector?.connect();
    const post = (method, params = {}) => new Promise((done, fail) => inspector.post(method, params, (error, result) => (error ? fail(error) : done(result))));
    global.gc();
    const before = process.memoryUsage();
    if (inspector) await post("HeapProfiler.startSampling", { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const started = performance.now(),
        cpuStart = process.cpuUsage();
    script.runInContext(context, { timeout: 2000 });
    await new Promise(done => setImmediate(done));
    const expectedRequests = scenario === "mixed-weather" ? 3 : 1;
    assert.equal(callbacks.length, expectedRequests);
    let waitingHeapBytes;
    if (inspector) {
        global.gc();
        waitingHeapBytes = process.memoryUsage().heapUsed - before.heapUsed;
    }
    for (const { request, callback } of callbacks.splice(0)) {
        const success = request.url.includes("/weather/now");
        callback(null, { status: success ? 200 : 503, headers: {} }, success ? nowBody : "{}");
    }
    const result = await finished;
    const cpu = process.cpuUsage(cpuStart),
        elapsedMs = performance.now() - started;
    let retainedHeapBytes, arrayBufferBytes, sampledAllocationBytes;
    if (inspector) {
        global.gc();
        const complete = process.memoryUsage();
        retainedHeapBytes = complete.heapUsed - before.heapUsed;
        arrayBufferBytes = complete.arrayBuffers - before.arrayBuffers;
        const { profile } = await post("HeapProfiler.stopSampling");
        const allocated = node => node.selfSize + node.children.reduce((sum, child) => sum + allocated(child), 0);
        sampledAllocationBytes = allocated(profile.head);
        inspector.disconnect();
    }
    assert.equal(doneCalls, 1);
    assert.equal(requests, expectedRequests);
    assert.equal(callbacks.length, 0);
    assert.deepEqual(raw, original);
    if (scenario === "alerts-failure") assert.strictEqual(result.body, raw);
    else {
        const decoded = WeatherKit2.decode(new ByteBuffer(result.body), ["currentWeather", "forecastHourly", "weatherAlerts"]);
        assert.equal(decoded.currentWeather.temperature, 23);
        const preserved = WeatherKit2.decode(new ByteBuffer(raw), ["forecastHourly", "weatherAlerts"]);
        assert.deepEqual(decoded.forecastHourly, preserved.forecastHourly);
        assert.deepEqual(decoded.weatherAlerts, preserved.weatherAlerts);
    }
    return { scenario, mode, inputBytes: raw.length, outputBytes: result.body.length, requests, reads, writes, doneCalls, waitingHeapBytes, retainedHeapBytes, arrayBufferBytes, sampledAllocationBytes, cpuMicros: cpu.user + cpu.system, elapsedMs };
}

if (process.argv[2] === "--sample") console.log(JSON.stringify(await sample(process.argv[3], process.argv[4], process.argv[5])));
else {
    const work = path.join(root, ".cache/processing-memory-v7");
    await mkdir(work, { recursive: true });
    const old = execFileSync("git", ["show", `${baseline}:Loon/script/response.bundle.js`], { cwd: root });
    const current = await readFile(path.join(root, "Loon/script/response.bundle.js"));
    const provenance = JSON.parse(await readFile(path.join(root, "Loon/script/build-provenance.json"), "utf8"));
    assert.equal(provenance.resourceRef, "cache-v7", "Measure the downloaded v7 CI artifact");
    const oldLock = JSON.parse(execFileSync("git", ["show", `${baseline}:package-lock.json`], { cwd: root }));
    const newLock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
    delete oldLock.version;
    delete newLock.version;
    delete oldLock.packages[""].version;
    delete newLock.packages[""].version;
    assert.deepEqual(newLock, oldLock, "Compiler and runtime dependency locks must match");
    await writeFile(path.join(work, "baseline.js"), old);
    await writeFile(path.join(work, "optimized.js"), current);
    const measurements = [];
    for (const scenario of ["current-only", "mixed-weather", "alerts-failure"])
        for (const mode of ["cpu", "memory"]) {
            const samples = { "cache-v6": [], "cache-v7": [] };
            for (let repetition = 0; repetition < 7; repetition++)
                for (const version of repetition % 2 ? ["cache-v7", "cache-v6"] : ["cache-v6", "cache-v7"]) {
                    samples[version].push(JSON.parse(execFileSync(process.execPath, ["--expose-gc", import.meta.filename, "--sample", path.join(work, version === "cache-v6" ? "baseline.js" : "optimized.js"), scenario, mode], { cwd: root, encoding: "utf8", timeout: 15000 })));
                }
            for (const version of ["cache-v6", "cache-v7"]) {
                const row = { scenario, mode, version, repetitions: 7, samples: samples[version] };
                const fields = mode === "memory" ? ["waitingHeapBytes", "retainedHeapBytes", "arrayBufferBytes", "sampledAllocationBytes"] : ["cpuMicros", "elapsedMs"];
                for (const key of ["inputBytes", "outputBytes", "requests", "reads", "writes", "doneCalls", ...fields]) row[key] = samples[version].map(sample => sample[key]).sort((a, b) => a - b)[3];
                measurements.push(row);
            }
        }
    const report = {
        measuredDate: "2026-11-01",
        baselineCommit: baseline,
        optimizedSourceCommit: provenance.sourceCommit,
        bundles: { "cache-v6": hash(old), "cache-v7": hash(current) },
        environment: { node: process.version, platform: process.platform, arch: process.arch, runtime: "Node/V8 running actual CI-minified bundles with mocked Loon callbacks", unchangedDependencyLock: true },
        method: "Seven independent subprocesses per version/scenario/mode, alternating order. Fixtures and VM compilation precede the initial GC. CPU mode has no inspector or mid-run GC. Memory mode uses full GC while native callbacks wait and after completion; allocation sampling interval 4096 bytes includes collected objects and harness overhead. One script execution per process; CPU and elapsed times include script initialization and callback dispatch.",
        measurements,
        liveProviderRequests: false,
        realLoonMemoryMeasurement: false,
        batteryMeasurement: false,
        actualDeviceValidation: false,
    };
    await writeFile(path.join(root, "docs/processing-memory-v7-measurements.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(
        JSON.stringify(
            measurements.map(({ samples, ...row }) => row),
            null,
            2,
        ),
    );
}
