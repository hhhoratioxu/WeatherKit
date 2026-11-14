// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
// Actual compiled entries in a documented Surge host fixture, not a native parser/device test.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

export default async function verifySurge(root) {
    const directory = path.join(root, "Surge/script"),
        code = {};
    for (const name of ["transport", "availability", "scale", "request", "response"]) code[name] = await readFile(path.join(directory, `${name}.surge.bundle.js`), "utf8");
    const module = await readFile(path.join(directory, "iRingo.WeatherKit.sgmodule"), "utf8");
    assert.equal(await readFile(path.join(directory, "WeatherKit.sgmodule"), "utf8"), module);
    assert.doesNotMatch(module, /\[Argument\]|request if |response if |requires_body=|binary_body_mode=/);
    assert.match(module, /hostname = %APPEND% weatherkit\.apple\.com/);
    const table = module.match(/^#!arguments = (.+)$/m)?.[1];
    const defaults = new Map([...table.matchAll(/(?:^|,)([A-Za-z0-9_]+):("[^"]*"|true|false|\d+)/g)].map(([, key, value]) => [key, JSON.parse(value)]));
    assert.equal(defaults.size, 12);
    for (const text of [module, ...Object.values(code)]) assert.doesNotMatch(text, /RequestCache|ProviderFallback|Region\.Fallback|WeatherKit\.Provider(?:Cache|Cooldown)/);
    const original = JSON.parse(await readFile(path.join(root, "tests/fixtures/upstream-intent.json"), "utf8"));
    for (const [key, value] of Object.entries(original.originalArgumentDefaults)) assert.equal(defaults.get(key.replaceAll(".", "_")), value);
    for (const [, name] of module.matchAll(/\{\{\{([^}]+)\}\}\}/g)) assert.ok(defaults.has(name), `Undeclared Surge parameter ${name}`);
    const lines = module.split("\n").filter(line => line.includes(" = type=http-"));
    assert.equal(lines.length, 7);
    const scripts = lines.map(line => ({ line, stage: line.match(/type=(http-[a-z]+)/)[1], pattern: new RegExp(line.match(/pattern="([^"]+)"/)[1]) }));
    const matching = (url, stage) => scripts.filter(s => s.stage === stage && s.pattern.test(url));
    const v3 = "https://weatherkit.apple.com/api/v3/weather/en-US/31.2/121.5?country=CN&dataSets=currentWeather";
    assert.equal(matching(v3, "http-request").length, 1);
    assert.equal(matching(v3, "http-response").length, 1);
    assert.equal(matching(v3.replace("/v3/", "/v2/"), "http-response").length, 1);
    const v2line = matching(v3.replace("/v3/", "/v2/"), "http-response")[0].line;
    assert.match(v2line, /binary-body-mode=true/);
    for (const script of scripts) {
        assert.match(script.line, /engine=(?:jsc|webview)/);
        if (script.stage === "http-response") assert.match(script.line, /requires-body=true, (?:binary-body-mode=true, )?max-size=(?:65536|4194304)/);
    }
    for (const prefix of ["", "lang=en-US&"]) for (const id of ["fixture-101190110", "31.2,121.5", "-31.2,-121.5"]) assert.equal(matching(`https://weatherkit.apple.com/api/v1/weatherAlerts?${prefix}ids=${id}`, "http-request").length, 1);
    const argumentLine = matching(v3, "http-response")[0].line.split(", argument=")[1];
    const emittedArgument = argumentLine.replace(/\{\{\{([^}]+)\}\}\}/g, (_, key) => String(defaults.get(key)));
    assert.match(emittedArgument, /Storage="Argument"/);
    assert.doesNotMatch(emittedArgument, /RequestCache|ProviderFallback|Region\.Fallback/);
    const scenarios = ["seven native script declarations, disjoint routes and all twelve parameter bindings", "original twelve argument defaults and identifier-only Surge parameter names"];
    const storage = new Map();
    const noNetwork = () => {
        throw new Error("Unexpected provider request");
    };
    async function run(name, request, response, argument = {}, http = noNetwork) {
        let done = 0,
            active = 0,
            network = 0,
            output,
            resolve,
            reject;
        const complete = new Promise((yes, no) => {
            resolve = yes;
            reject = no;
        });
        const timer = setTimeout(() => reject(Error(`Surge fixture timed out: ${name}`)), 3000);
        const messages = [];
        const context = vm.createContext({
            ...(name === "request" || name === "response" ? { URL, URLSearchParams, TextDecoder, TextEncoder } : {}),
            Uint8Array,
            $environment: { "surge-version": "fixture", system: "iOS" },
            $script: { startTime: Date.now() / 1000 },
            $argument:
                emittedArgument +
                "&LogLevel=OFF&" +
                Object.entries(argument)
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                    .join("&"),
            $request: request,
            $response: response,
            $persistentStore: {
                read: key => storage.get(key) ?? null,
                write: (value, key) => {
                    storage.set(key, value);
                    return true;
                },
            },
            $httpClient: {
                get: (request, callback) => {
                    network++;
                    active++;
                    assert.ok(request.timeout > 0 && request.timeout <= 5, "Surge HTTP timeout is seconds");
                    Promise.resolve()
                        .then(() =>
                            http(request, (...args) => {
                                active--;
                                callback(...args);
                            }),
                        )
                        .catch(reject);
                },
            },
            console: { log: x => messages.push(String(x)), warn() {}, info() {}, error() {} },
            $done: value => {
                done++;
                assert.equal(active, 0, "Wait for every native callback");
                output = value;
                resolve();
            },
        });
        try {
            vm.runInContext(code[name], context, { timeout: 2000 });
            await complete;
            await new Promise(yes => setImmediate(yes));
            assert.equal(done, 1);
            assert.equal(context.process, undefined);
            assert.equal(context.$loon, undefined);
            return { output, network, messages };
        } finally {
            clearTimeout(timer);
        }
    }
    const agent = "WeatherKit_Weather_iOS_Version 27.3 (Build fixture)";
    const request = (products = "currentWeather") => ({ url: v3.replace("dataSets=currentWeather", "dataSets=" + products), method: "GET", headers: { "User-Agent": agent } });
    const response = body => ({ status: 200, headers: { "Content-Type": "application/json", ETag: "fixture", "Content-Length": "1", "X-Apple": "keep" }, body: typeof body === "string" ? body : JSON.stringify(body) });
    for (const system of ["iOS", "macOS"]) {
        const originalRequest = { ...request(), headers: { "uSeR-aGeNt": agent.replace("iOS", system), accept: "application/vnd.apple.flatbuffer", Authorization: "fixture-only" } };
        const { output, network } = await run("transport", originalRequest);
        assert.equal(output.headers.Accept, "application/json");
        assert.equal(output.headers.accept, undefined);
        assert.equal(output.headers.Authorization, "fixture-only");
        assert.equal(originalRequest.headers.accept, "application/vnd.apple.flatbuffer");
        assert.equal(network, 0);
        scenarios.push(`${system} main Weather app negotiates JSON without body, WebAPI or network access`);
    }
    for (const r of [
        { ...request(), method: "POST" },
        { ...request(), url: v3.replace("https:", "http:") },
        { ...request(), url: v3.replace("weatherkit.apple.com", "example.com") },
        { ...request(), headers: { "User-Agent": "WeatherKit_WeatherWidget_macOS_Version 27.3" } },
        { ...request(), headers: {} },
    ])
        assert.equal(Object.keys((await run("transport", r)).output).length, 0);
    scenarios.push("other methods, hosts, background clients and missing agents preserve original transport");
    const available = await run("availability", { ...request(), url: "https://weatherkit.apple.com/api/v1/availability/en-US/31.2/121.5" }, response(["futureAppleProduct", "currentWeather", "currentWeather"]));
    assert.deepEqual(JSON.parse(available.output.body), ["futureAppleProduct", "currentWeather", ...original.capabilities.filter(x => x !== "currentWeather")]);
    assert.equal(available.output.headers.ETag, undefined);
    for (const value of [{ future: true }, ["currentWeather", 1], original.capabilities]) assert.equal(Object.keys((await run("availability", { ...request(), url: "https://weatherkit.apple.com/api/v1/availability/en-US/31.2/121.5" }, response(value))).output).length, 0);
    scenarios.push("small JSC availability preserves unknown capabilities, ordering and unknown shapes");
    const scaleBase = "https://weatherkit.apple.com/api/v1/airQualityScale/en-US/";
    for (const suffix of ["EU.EAQI.2604?lang=en-US", "US.AQI.8"]) assert.equal((await run("scale", { ...request(), url: scaleBase + suffix })).output.url, scaleBase + suffix.replace(/\.\d+(?=\?|$)/, ""));
    for (const scale of ["HK.AQHI", "CN.AQHI"]) assert.equal((await run("scale", { ...request(), url: scaleBase + scale + ".12" })).output.response.status, 200);
    assert.equal(Object.keys((await run("scale", { ...request(), method: "POST", url: scaleBase + "EU.EAQI.12" })).output).length, 0);
    scenarios.push("small JSC scale entry normalizes versions, supplies HK/CN legends and preserves POST");
    const pollutants = () =>
        [
            ["PM2_5", 35],
            ["PM10", 60],
            ["OZONE", 90],
            ["NO2", 35],
            ["SO2", 15],
            ["CO", 700],
        ].map(([pollutantType, amount]) => ({ pollutantType, amount, units: "MICROGRAMS_PER_CUBIC_METER" }));
    const aq = () => ({ metadata: { temporarilyUnavailable: false, providerName: "Apple fixture" }, scale: "HJ6332012", index: 42, categoryIndex: 1, primaryPollutant: "PM2_5", previousDayComparison: "SIMILAR", pollutants: pollutants() });
    for (const algorithm of ["UBA", "EU_EAQI", "WAQI_InstantCast_US", "WAQI_InstantCast_CN", "WAQI_InstantCast_CN_25_DRAFT", "CA_AQHI", "HK_AQHI", "AQHI_Multi_CN", "AQHI_Multi_CN_HK", "CN_DEATH_AQHI", "CN_DEATH_HK_AQHI", "None"]) {
        const input = response({ airQuality: aq(), futureProduct: { keep: true } });
        const result = await run("response", request("airQuality"), input, { DataSets: "airQuality", "AirQuality.Calculate.Algorithm": algorithm });
        const actual = JSON.parse(result.output.body ?? input.body).airQuality;
        assert.equal(actual.pollutants.length, 6);
        assert.equal(actual.pollutants.find(p => p.pollutantType === "CO").amount, 700);
        assert.ok(Number.isInteger(actual.index) && actual.index >= 0);
        assert.ok(Number.isInteger(actual.categoryIndex) && actual.categoryIndex >= 1);
        assert.equal(actual.previousDayComparison, "SIMILAR");
        assert.equal(result.network, 0);
        if (algorithm === "None") {
            assert.equal(actual.index, 42);
            assert.equal(Object.keys(result.output).length, 0);
        } else assert.match(actual.metadata.providerName, /iRingo/);
        scenarios.push(`${algorithm}: six physical concentrations, original trend and no extra provider query`);
    }
    const nativeCO = aq();
    nativeCO.metadata.providerName = "QWeather";
    nativeCO.pollutants.find(p => p.pollutantType === "CO").amount = 0.7;
    const co = await run("response", request("airQuality"), response({ airQuality: nativeCO }), { DataSets: "airQuality", "AirQuality.Calculate.Algorithm": "None" });
    assert.equal(JSON.parse(co.output.body).airQuality.pollutants.find(p => p.pollutantType === "CO").amount, 700);
    scenarios.push("Apple QWeather CO is repaired once at ingress even with local index conversion disabled");
    const outside = aq();
    outside.scale = "UK_DAQI";
    assert.equal(Object.keys((await run("response", request("airQuality"), response({ airQuality: outside }), { DataSets: "airQuality", "AirQuality.Calculate.Algorithm": "CA_AQHI" })).output).length, 0);
    scenarios.push("nonmatching target keeps Apple index and validators");
    const uuid = "00112233-4455-6677-8899-aabbccddeeff",
        bytes = [0, 17, 34, 51, 68, 85, 102, 119, 136, 153, 170, 187, 204, 221, 238, 255];
    const warnings = { weatherAlerts: { metadata: { temporarilyUnavailable: false }, alerts: [{ id: { bytes }, description: "Fixture warning", detailsUrl: "https://example.com/fixture" }] }, futureProduct: { id: { bytes } } };
    for (const settings of [{ DataSets: "" }, { DataSets: "weatherAlerts", "WeatherAlerts.Provider": "WeatherKit" }]) {
        const result = await run("response", request("weatherAlerts"), response(warnings), settings);
        const actual = JSON.parse(result.output.body);
        assert.equal(actual.weatherAlerts.alerts[0].id, uuid);
        assert.equal(actual.weatherAlerts.alerts[0].description, "Fixture warning");
        assert.deepEqual(actual.futureProduct, warnings.futureProduct);
        assert.equal(result.network, 0);
        scenarios.push(`retained Apple warning UUID stays readable: ${settings.DataSets || "processing disabled"}`);
    }
    const originalBody = '  {"currentWeather":{"metadata":{"temporarilyUnavailable":false},"temperature":18,"conditionCode":"CLOUDY"},"futureProduct":true}\n';
    storage.clear();
    const failure = await run("response", request(), response(originalBody), { DataSets: "currentWeather", "Weather.Provider": "QWeather" }, (_r, callback) => setImmediate(() => callback("native fixture timeout", {}, "")));
    assert.equal(Object.keys(failure.output).length, 0);
    assert.equal(failure.network, 1);
    assert.equal(failure.messages.filter(x => x.startsWith("[WeatherKit]")).length, 0);
    scenarios.push("provider failure completes after native callback and preserves bytes without runtime statistics");
    storage.clear();
    const replaced = await run("response", request(), response(originalBody), { DataSets: "currentWeather", "Weather.Provider": "QWeather" }, (_r, callback) =>
        setImmediate(() => callback(null, { status: 200, headers: {} }, JSON.stringify({ code: "200", updateTime: "2026-10-19T00:00:00Z", now: { temp: "23", icon: "100", text: "晴", feelsLike: "24", cloud: "20", humidity: "50", precip: "0", pressure: "1000", dew: "10", vis: "10", wind360: "90", windSpeed: "2" } }))),
    );
    assert.equal(JSON.parse(replaced.output.body).currentWeather.temperature, 23);
    assert.equal(replaced.output.headers.ETag, undefined);
    assert.equal(replaced.output.headers["Content-Length"], undefined);
    scenarios.push("healthy weather replacement and native response framing use Surge body and headers");
    for (const [r, res] of [
        [{ ...request(), headers: { "User-Agent": "WeatherKit_WeatherWidget_macOS_Version 27.3" } }, response(originalBody)],
        [request(), { ...response(originalBody), status: 503 }],
        [request(), { status: 200, headers: { "Content-Type": "application/vnd.apple.flatbuffer;messageType=WK3.Weather" }, body: new Uint8Array([1, 2, 3, 4]) }],
        [request(), response("{invalid")],
    ])
        assert.equal(Object.keys((await run("response", r, res)).output).length, 0);
    scenarios.push("background, failed, malformed and opaque WK3 responses use untouched passthrough");
    storage.clear();
    const alertRequest = { ...request(), url: "https://weatherkit.apple.com/api/v1/weatherAlerts?ids=fixture-101190110&lang=en-US" };
    const html = '<html><h1 class="c-submenu__location">Fixture</h1><div class="c-city-warning-events warning--orange"><h3>Fixture warning</h3><p>Issue date: 2026-10-19T00:00:00Z</p></div></html>';
    const page = await run("request", alertRequest, undefined, {}, (_r, callback) => callback(null, { status: 200, headers: { "Content-Type": "text/html" } }, html));
    assert.equal(page.output.response.status, 200);
    assert.ok(JSON.parse(page.output.response.body).length > 0);
    const repeated = await run("request", alertRequest, undefined, {}, (_r, callback) => callback(null, { status: 200, headers: { "Content-Type": "text/html" } }, html));
    assert.equal(repeated.network, 1);
    assert.equal(repeated.output.response.body, page.output.response.body);
    scenarios.push("warning details accept ids first and fetch again on repeated execution");
    storage.clear();
    assert.equal(Object.keys((await run("request", alertRequest, undefined, {}, (_r, callback) => callback("fixture failure", {}, ""))).output).length, 0);
    scenarios.push("failed warning detail request preserves the Apple response path");
    const { default: WeatherKit2 } = await import(new URL("../src/class/WeatherKit2.mjs", import.meta.url));
    const { ByteBuffer } = await import("flatbuffers");
    const binary = WeatherKit2.encode(undefined, { currentWeather: { metadata: { providerName: "Apple", temporarilyUnavailable: false }, temperature: 27, conditionCode: "CLEAR" } });
    assert.equal(WeatherKit2.decode(new ByteBuffer(binary), ["currentWeather"]).currentWeather.temperature, 27);
    const kept = await run("response", { ...request(), url: v3.replace("/v3/", "/v2/") }, { status: 200, headers: { "Content-Type": "application/vnd.apple.flatbuffer" }, body: binary }, { DataSets: "", "Weather.Provider": "WeatherKit" });
    assert.equal(Object.keys(kept.output).length, 0);
    assert.equal(kept.network, 0);
    scenarios.push("WK2 binary passthrough retains the native typed array without reencoding");
    for (const product of ["forecastPeriodic", "weatherChanges"]) {
        const input = response({ [product]: { metadata: {}, forecasts: [{ conditionCode: ["RAIN"], precipitationAmountByType: [{ expected: 0.4 }] }] }, futureProduct: { conditionCode: ["OPAQUE"] } });
        const result = await run("response", request(product), input, { DataSets: "" });
        const body = JSON.parse(result.output.body);
        assert.equal(body[product].forecasts[0].conditionCode, "RAIN");
        assert.equal(body[product].forecasts[0].precipitationAmount, 0.4);
        assert.deepEqual(body.futureProduct.conditionCode, ["OPAQUE"]);
        assert.equal(result.network, 0);
        scenarios.push(`${product}-only JSON is adapted without provider work`);
    }
    for (const invalid of [false, true]) {
        storage.clear();
        const result = await run("response", request("forecastNextHour"), response(originalBody), { DataSets: "forecastNextHour", "NextHour.Provider": "ColorfulClouds" }, (_request, callback) =>
            callback(null, { status: 200, headers: {} }, JSON.stringify({ status: "ok", server_time: 1800000000, result: { minutely: { status: "ok", description: "未来有小雨", probability: [0.8, 0.8, 0.8, 0.8], precipitation_2h: invalid ? [] : Array.from({ length: 120 }, (_, i) => (i < 70 ? 0 : 1)) } } })),
        );
        assert.equal(result.network, 1);
        if (invalid) assert.equal(Object.keys(result.output).length, 0);
        else {
            const product = JSON.parse(result.output.body).forecastNextHour;
            assert.equal(product.minutes.length, 85);
            assert.deepEqual(
                product.summary.map(item => item.clear),
                [true, false],
            );
            assert.equal(product.condition.length, 2);
        }
        scenarios.push(invalid ? "empty provider minutes preserve native passthrough" : "last-minute rain transition survives the compiled provider path");
    }
    const retainedDetails = await run("request", { ...request(), url: "https://weatherkit.apple.com/api/v1/weatherAlerts?ids=31.2,121.5" }, undefined, { "WeatherAlerts.Provider": "WeatherKit" });
    assert.equal(Object.keys(retainedDetails.output).length, 0);
    assert.equal(retainedDetails.network, 0);
    scenarios.push("WeatherKit-selected coordinate warning details use untouched passthrough");
    storage.clear();
    const paddedBinary = new Uint8Array(binary.length + 29).fill(0xa5);
    paddedBinary.set(binary, 13);
    const binaryView = paddedBinary.subarray(13, 13 + binary.length);
    const modifiedBinary = await run(
        "response",
        { ...request(), url: v3.replace("/v3/", "/v2/") },
        { status: 200, headers: { "Content-Type": "application/vnd.apple.flatbuffer", ETag: "old", "Content-Encoding": "gzip", "Content-Length": "1" }, body: binaryView },
        { DataSets: "currentWeather", "Weather.Provider": "QWeather" },
        (_request, callback) => callback(null, { status: 200, headers: {} }, JSON.stringify({ code: "200", updateTime: "2026-11-13T00:00:00Z", now: { temp: "23", text: "晴", feelsLike: "24", cloud: "20", humidity: "50", precip: "0", pressure: "1000", dew: "10", vis: "10", wind360: "90", windSpeed: "2" } })),
    );
    assert.ok(modifiedBinary.output.body instanceof Uint8Array);
    assert.equal(modifiedBinary.network, 1);
    assert.equal(WeatherKit2.decode(new ByteBuffer(modifiedBinary.output.body), ["currentWeather"]).currentWeather.temperature, 23);
    for (const name of ["ETag", "Content-Encoding", "Content-Length"]) assert.equal(modifiedBinary.output.headers[name], undefined);
    assert.equal(modifiedBinary.output.headers["Cache-Control"], "no-store");
    assert.deepEqual(Array.from(binaryView), Array.from(binary));
    assert.equal(paddedBinary[0], 0xa5);
    assert.equal(paddedBinary.at(-1), 0xa5);
    scenarios.push("modified WK2 binary invalidates original entity headers");
    const unavailableBody = response({ weatherAlerts: { metadata: { temporarilyUnavailable: true }, alerts: [] } });
    const unavailable = await run("response", request("weatherAlerts"), unavailableBody, { DataSets: "weatherAlerts", "WeatherAlerts.Provider": "QWeather" }, (_, callback) => callback(null, { status: 200, headers: {} }, JSON.stringify({ metadata: {}, alerts: [] })));
    assert.equal(unavailable.network, 1);
    assert.equal(Object.keys(unavailable.output).length, 0);
    scenarios.push("no native warning merge retains unavailable Apple data through Surge passthrough");
    const futureContainer = { conditionCode: ["OPAQUE"], index: "future", precipitationAmount: { expected: 8 } };
    const opaqueNested = await run("response", request(), response({ currentWeather: { metadata: {}, conditionCode: ["RAIN"], future: futureContainer } }), { DataSets: "" });
    const opaqueProduct = JSON.parse(opaqueNested.output.body).currentWeather;
    assert.equal(opaqueProduct.conditionCode, "RAIN");
    assert.deepEqual(opaqueProduct.future, futureContainer);
    scenarios.push("Surge JSON adaptation leaves unknown nested payloads unchanged");
    const populatedUnavailable = await run(
        "response",
        request("weatherAlerts"),
        response({ weatherAlerts: { metadata: { temporarilyUnavailable: true }, alerts: [{ id: "00112233-4455-6677-8899-aabbccddeeff", description: "Apple fixture warning" }] } }),
        { DataSets: "weatherAlerts", "WeatherAlerts.Provider": "QWeather" },
        (_, callback) => callback(null, { status: 200, headers: {} }, JSON.stringify({ metadata: {}, alerts: [] })),
    );
    assert.equal(populatedUnavailable.network, 1);
    assert.equal(Object.keys(populatedUnavailable.output).length, 0);
    scenarios.push("metadata-only warning supplementation preserves populated Apple alerts through Surge passthrough");
    // Both inputs fit independently; the real provider conversion makes their combined output exceed 1 Mi characters.
    const oversizedApple = {
        currentWeather: { metadata: { temporarilyUnavailable: false }, temperature: 18, conditionCode: ["CLOUDY"] },
        forecastPeriodic: { metadata: {}, forecasts: [{ periods: [{ conditionCode: ["RAIN"], precipitationAmountByType: [{ expected: 2, precipitationType: ["RAIN"] }] }] }] },
        futureProduct: { padding: "x".repeat(768 * 1024) },
    };
    const oversizedOriginal = JSON.stringify(oversizedApple);
    const oversizedProviderBody = JSON.stringify({ code: "200", fxLink: `https://fixture.example/${"p".repeat(384 * 1024)}`, now: { pubTime: "2026-11-14T00:00:00Z", temp: "23", text: "晴", feelsLike: "24", cloud: "20", humidity: "50", precip: "0", pressure: "1000", dew: "10", vis: "10", wind360: "90", windSpeed: "2" } });
    const oversizedProvider = (_, callback) => callback(null, { status: 200, headers: {} }, oversizedProviderBody);
    const acceptedControl = await run("response", request(), response({ currentWeather: oversizedApple.currentWeather }), { DataSets: "currentWeather", "Weather.Provider": "QWeather" }, oversizedProvider);
    const acceptedBody = JSON.parse(acceptedControl.output.body);
    assert.equal(acceptedControl.network, 1);
    assert.equal(acceptedBody.currentWeather.temperature, 23, "The overflow fixture must be a valid provider replacement before combining it with the large Apple payload");
    assert.ok(acceptedBody.currentWeather.metadata.attributionUrl.length > 384 * 1024);
    const outputFallback = await run(
        "response",
        request(),
        response(oversizedOriginal),
        { DataSets: "currentWeather", "Weather.Provider": "QWeather" },
        oversizedProvider,
    );
    const fallbackBody = JSON.parse(outputFallback.output.body);
    assert.equal(outputFallback.network, 1);
    assert.equal(fallbackBody.currentWeather.temperature, 18);
    assert.equal(fallbackBody.currentWeather.conditionCode, "CLOUDY");
    assert.equal(fallbackBody.forecastPeriodic.forecasts[0].periods[0].conditionCode, "RAIN");
    assert.equal(fallbackBody.forecastPeriodic.forecasts[0].periods[0].precipitationAmount, 2);
    assert.deepEqual(fallbackBody.futureProduct, oversizedApple.futureProduct);
    assert.ok(outputFallback.output.body.length < 1024 * 1024);
    assert.equal(outputFallback.output.headers.ETag, undefined);
    assert.equal(outputFallback.output.headers["Cache-Control"], "no-store");
    assert.equal(JSON.stringify(oversizedApple), oversizedOriginal);
    scenarios.push("provider output overflow returns normalized Apple weather and periodic data through the compiled Surge script");
    return { pass: scenarios.length, fail: 0, scenarios, originalArgumentDefaultsVerified: 12, scriptDeclarations: 7, parameterBindings: 12, completionExactlyOnce: true, nativeCallbacksAwaited: true, nativeSurgeValidation: false, liveWeatherRequests: false };
}
