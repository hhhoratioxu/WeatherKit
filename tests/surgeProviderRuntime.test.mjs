// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
globalThis.$environment = { "surge-version": "fixture" };
const [{ default: fetchProvider }, { default: ProviderRequestCache }, { hasNativeProviderRuntime }] = await Promise.all([import("../src/function/fetchProvider.mjs"), import("../src/class/ProviderRequestCache.mjs"), import("../src/function/nativeProviderRuntime.mjs")]);
for (const milliseconds of [250, 499, 500, 501, 999, 1499, 5000]) test(`Surge converts ${milliseconds} internal milliseconds to native seconds without rounding`, async () => {
    globalThis.$httpClient = { get(request, callback) { assert.equal(request.timeout, milliseconds / 1000);callback(null, { status: 200, headers: {} }, "{}"); } };
    assert.equal((await fetchProvider({ url: "https://provider.example/weather", timeout: milliseconds })).status, 200);
});
test("Surge copies supported HTTP fields and caller headers without passing Loon fields", async () => {
    const request = { url: "https://provider.example/weather", headers: { HOST: "old", "Content-Length": "1", Authorization: "fixture" }, node: "Loon-only", policy: "DIRECT", "auto-cookie": false };
    globalThis.$httpClient = { get(outgoing, callback) { assert.deepEqual(outgoing.headers, { Authorization: "fixture" });assert.equal(outgoing.policy, "DIRECT");assert.equal(outgoing.node, undefined);assert.equal(outgoing["auto-cookie"], false);callback(null, { status: 304, headers: {} }); } };
    const actual = await fetchProvider(request);assert.equal(actual.body, "");assert.equal(request.headers.HOST, "old");
});
test("Surge persistent responses survive executions and retain the remaining dispatch budget", async () => {
    const stored = new Map();globalThis.$persistentStore = { read: key => stored.get(key), write: (value, key) => { stored.set(key, value);return true; } };
    let now = 100000, calls = 0;
    const options = { now: () => now, budgetMs: 1000, cooldownSeconds: 30 };
    const first = new ProviderRequestCache(options);now += 600;
    const request = { url: "https://provider.example/weather?token=fixture-secret" }, extra = { validate: value => value?.ok === true, fetcher: async outgoing => { calls++;assert.equal(outgoing.timeout, 400);return { status: 200, headers: {}, body: '{"ok":true}' }; } };
    await first.fetch(request, extra);await new ProviderRequestCache(options).fetch(request, extra);
    assert.equal(calls, 1);assert.ok(stored.size > 0);assert.doesNotMatch([...stored.values()].join(""), /fixture-secret|provider\.example/);
});
test("unrecognized clients never opt into native provider storage", () => {
    const original = globalThis.$environment;delete globalThis.$environment;assert.equal(hasNativeProviderRuntime(), false);globalThis.$environment = original;
});
