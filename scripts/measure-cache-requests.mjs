// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";

const root = path.resolve(import.meta.dirname, "..");
const baseline = "c40e8f8a13c8304a7ef500cb74acc5948af14b3f";
const original = execFileSync("git", ["show", `${baseline}:src/class/WAQI.mjs`], { cwd: root, encoding: "utf8" });
const originalID = path.join(root, "src/class/__baseline_WAQI.mjs");
const reports = [];
for (const optimized of [false, true]) {
    const bundle = await rollup({ input: optimized ? path.join(root, "src/class/WAQI.mjs") : originalID, plugins: [{ name: "official-baseline", resolveId: id => (id === originalID ? originalID : null), load: id => (id === originalID ? original : null) }, nodeResolve({ browser: true })] });
    const { output } = await bundle.generate({ format: "iife", name: "WeatherProvider" });
    await bundle.close();
    let calls = 0;
    const callbacks = [];
    const storage = new Map();
    const context = vm.createContext({
        $loon: "Mac simulated Loon",
        $persistentStore: {
            read: key => storage.get(key),
            write: (value, key) => {
                storage.set(key, value);
                return true;
            },
        },
        $httpClient: {
            get(_request, callback) {
                calls++;
                callbacks.push(() => callback(null, { status: 200, headers: {} }, JSON.stringify({ status: "ok", data: { city: { name: "Fixture", geo: [31.2, 121.5] }, aqi: "42", dominentpol: "pm25", time: { v: 1_790_000_000 }, idx: 123 } })));
            },
        },
        console: { log() {}, error() {}, warn() {} },
    });
    vm.runInContext(output[0].code, context);
    const start = `const provider = new WeatherProvider({latitude:31.2,longitude:121.5,country:"CN",language:"zh-CN",version:"v2"}, "fixture-token");
        globalThis.result = Promise.all(Array.from({length:6}, () => provider.AQI2()));`;
    vm.runInContext(start, context);
    const cold = calls;
    for (const callback of callbacks.splice(0)) callback();
    assert.ok((await context.result).every(item => item.index === 42));
    vm.runInContext("globalThis.result = Promise.all(Array.from({length:6}, () => provider.AQI2()));", context);
    const warm = calls - cold;
    for (const callback of callbacks.splice(0)) callback();
    assert.ok((await context.result).every(item => item.index === 42));
    reports.push({ implementation: optimized ? "optimized" : "upstream", coldConcurrentConsumers: 6, coldNativeRequests: cold, warmConcurrentConsumers: 6, warmNativeRequests: warm });
}
assert.equal(reports[0].coldNativeRequests, 6);
assert.equal(reports[1].coldNativeRequests, 1);
assert.equal(reports[1].warmNativeRequests, 0);
const hashes = {};
for (const file of ["src/class/WAQI.mjs", "src/class/ProviderRequestCache.mjs"])
    hashes[file] = createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex");
const report = { environment: "Node VM, browser bundles, simulated Loon callbacks and storage", liveWeatherRequests: false, deviceVPNValidation: false, baselineCommit: baseline, optimizedSourceSHA256: hashes, cases: reports };
await writeFile(path.join(root, "docs/cache-request-measurements.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
