// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
// Controlled source comparison in Node/V8, not a measurement of Loon/iPhone RAM.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Session } from "node:inspector";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, ".."),
    baseline = "0404e6bf99fb4585d68f032cb2cb09501476bb60",
    work = path.join(root, ".cache/cache-memory-v6");
const hash = value => createHash("sha256").update(value).digest("hex");

async function sample(file, scenario) {
    const { default: Cache } = await import(pathToFileURL(file));
    const content = scenario === "small-json" ? "abc".repeat(200) : scenario === "escaped-text" ? "\0".repeat(90000) : 'weather-"晴天"-'.repeat(6500);
    const bodies = Array.from({ length: 12 }, (_, index) => (scenario === "escaped-text" ? `${content}${index}` : JSON.stringify({ status: "ok", index, content })));
    assert.ok(bodies.every(body => body.length <= 96 * 1024));
    let raw,
        now = 100000,
        requests = 0,
        writes = 0,
        snapshots = 0,
        snapshotCharacters = 0,
        allJSONCharacters = 0,
        largestJSON = 0;
    const store = {
        read: () => raw,
        write: value => {
            raw = value;
            writes++;
            return true;
        },
    };
    const options = {
        format: scenario === "escaped-text" ? "text" : "json",
        validate: value => (scenario === "escaped-text" ? typeof value === "string" : value.status === "ok"),
        fetcher: async request => {
            requests++;
            return { status: 200, headers: {}, body: bodies[Number(new URL(request.url).pathname.slice(1))] };
        },
    };
    const stringify = JSON.stringify;
    JSON.stringify = (value, ...rest) => {
        const text = stringify(value, ...rest);
        allJSONCharacters += text.length;
        largestJSON = Math.max(largestJSON, text.length);
        if (value?.version === 1 && Array.isArray(value.entries)) {
            snapshots++;
            snapshotCharacters += text.length;
        }
        return text;
    };
    const inspector = new Session();
    inspector.connect();
    const post = (method, params = {}) => new Promise((resolve, reject) => inspector.post(method, params, (error, result) => (error ? reject(error) : resolve(result))));
    global.gc();
    const before = process.memoryUsage().heapUsed;
    await post("HeapProfiler.startSampling", { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const cache = new Cache({ store, now: () => now });
    const started = performance.now();
    for (let index = 0; index < 12; index++) {
        now++;
        const response = await cache.fetch({ url: `https://memory.invalid/${index}` }, options);
        assert.equal(response.body, bodies[index]);
    }
    const elapsedMs = performance.now() - started;
    const heapBeforeGC = process.memoryUsage().heapUsed - before;
    global.gc();
    const retainedHeapBytes = process.memoryUsage().heapUsed - before;
    const { profile } = await post("HeapProfiler.stopSampling");
    inspector.disconnect();
    JSON.stringify = stringify;
    const allocations = node => node.selfSize + node.children.reduce((sum, child) => sum + allocations(child), 0);
    const saved = JSON.parse(raw);
    assert.ok(raw.length <= 256 * 1024);
    assert.equal(requests, 12);
    assert.equal(writes, 12);
    // Keep the live cache observable through the measurement and prove every
    // retained product can be read without another request.
    for (let index = 4; index < 12; index++) await cache.fetch({ url: `https://memory.invalid/${index}` }, options);
    assert.equal(requests, 12);
    return { scenario, requests, writes, snapshots, snapshotCharacters, allJSONCharacters, largestJSON, storedCharacters: raw.length, savedEntries: saved.entries.length, savedSHA256: hash(raw), retainedHeapBytes, heapBeforeGC, sampledAllocationBytes: allocations(profile.head), elapsedMs };
}

if (process.argv[2] === "--sample") console.log(JSON.stringify(await sample(process.argv[3], process.argv[4])));
else {
    await mkdir(work, { recursive: true });
    const baselineCode = execFileSync("git", ["show", `${baseline}:src/class/ProviderRequestCache.mjs`], { cwd: root });
    const previous = path.join(work, "baseline.mjs"),
        current = path.join(root, "src/class/ProviderRequestCache.mjs");
    await writeFile(previous, baselineCode);
    const measurements = [];
    for (const scenario of ["small-json", "near-limit-json", "escaped-text"]) {
        const samples = { "cache-v5": [], "cache-v6": [] };
        for (let repetition = 0; repetition < 7; repetition++) {
            // Alternate order to reduce run-order bias; each is a fresh process.
            const variants = repetition % 2 ? ["cache-v6", "cache-v5"] : ["cache-v5", "cache-v6"];
            for (const version of variants) samples[version].push(JSON.parse(execFileSync(process.execPath, ["--expose-gc", import.meta.filename, "--sample", version === "cache-v5" ? previous : current, scenario], { cwd: root, encoding: "utf8", timeout: 15000 })));
        }
        for (const version of ["cache-v5", "cache-v6"]) {
            const median = key => samples[version].map(sample => sample[key]).sort((a, b) => a - b)[3];
            const row = { scenario, version, repetitions: 7, samples: samples[version] };
            for (const key of ["requests", "writes", "snapshots", "snapshotCharacters", "allJSONCharacters", "largestJSON", "storedCharacters", "savedEntries", "retainedHeapBytes", "heapBeforeGC", "sampledAllocationBytes", "elapsedMs"]) row[key] = median(key);
            measurements.push(row);
        }
        assert.equal(samples["cache-v5"][0].savedSHA256, samples["cache-v6"][0].savedSHA256, "Persistence bytes and retained ordering must match the baseline");
    }
    const report = {
        measuredDate: "2026-11-01",
        baselineCommit: baseline,
        baselineSourceSHA256: hash(baselineCode),
        optimizedSourceSHA256: Object.fromEntries(await Promise.all(["src/class/ProviderRequestCache.mjs", "src/function/serializeProviderCache.mjs"].map(async file => [file, hash(await readFile(path.join(root, file)))]))),
        environment: { node: process.version, platform: process.platform, arch: process.arch, runtime: "Node/V8; same installed SHA-256 dependency; source modules without bundler differences", samplingIntervalBytes: 1024 },
        method: "Twelve successful requests per sample; fixtures prepared before GC; full GC before and after processing with the cache and mock storage still reachable. Alternating variants, seven fresh processes each. JSON counters include identity and metadata serializations; heap sampling is statistical and includes harness overhead. Elapsed times include instrumentation and are not a device benchmark.",
        measurements,
        realLoonMemoryMeasurement: false,
        actualDeviceValidation: false,
    };
    await writeFile(path.join(root, "docs/cache-memory-v6-measurements.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(
        JSON.stringify(
            measurements.map(({ samples, ...row }) => row),
            null,
            2,
        ),
    );
}
