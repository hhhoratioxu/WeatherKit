// Synthetic protocol fixtures; never commit captured phone responses or credentials.
import assert from "node:assert/strict";
import test from "node:test";

globalThis.$loon = "simulated Loon";
globalThis.$persistentStore = { read: () => null, write: () => true };
globalThis.$argument = { Storage: "Argument", LogLevel: "OFF" };
const [{ Response }, { Response: ResponseDev }, { default: QWeather }, { default: ColorfulClouds }, { default: ResponseJSONV3, adaptV3ProviderProduct }] = await Promise.all([
    import("../src/process/Response.mjs"), import("../src/process/Response.dev.mjs"), import("../src/class/QWeather.mjs"), import("../src/class/ColorfulClouds.mjs"), import("../src/process/ResponseJSONV3.mjs"),
]);
const { qs } = await import("@nsnanocat/util/polyfill/qs.mjs");
const metadata = () => ({ latitude: 31.2, longitude: 121.5, temporarilyUnavailable: false, sourceType: "MODELED", futureMetadata: true });
const current = () => ({ metadata: metadata(), temperature: 18, conditionCode: ["CLOUDY"], futureCurrent: { retain: true } });
const request = (products = "currentWeather") => globalThis.$request = { url: `https://weatherkit.apple.com/api/v3/weather/zh-Hans-CN/31.2/121.5?country=CN&dataSets=${products}`, method: "GET" };
const response = body => ({ status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ETag: "apple", "cOnTeNt-LeNgTh": "1", "cache-control": "max-age=60", "X-Apple": "retain" }, body: typeof body === "string" ? body : JSON.stringify(body) });
const settings = overrides => globalThis.$argument = qs.parse({ Storage: "Argument", LogLevel: "OFF", DataSets: "currentWeather,forecastHourly,forecastDaily,forecastNextHour,weatherAlerts", "Weather.Provider": "QWeather", "WeatherAlerts.Provider": "WeatherKit", ...overrides });

for (const [name, processResponse] of [["release", Response], ["development", ResponseDev]]) {
    test(`${name}: v3 changes provider fields while retaining unknown Apple data and native JSON types`, async t => {
        settings();
        t.mock.method(QWeather.prototype, "WeatherNow", async () => ({ metadata: { providerName: "Fixture", latitude: "31.2", longitude: "121.5" }, temperature: 23, conditionCode: "CLEAR", windGust: NaN }));
        t.mock.method(QWeather.prototype, "Hourly", async () => ({ metadata: { providerName: "Fixture" }, hours: [{ forecastStart: 100, temperature: 24, conditionCode: "RAIN", precipitationType: "RAIN", precipitationAmount: 0.4, snowfallAmount: 0 }] }));
        const body = { currentWeather: current(), forecastHourly: { metadata: metadata(), hours: [100, 200].map(forecastStart => ({ forecastStart, temperature: 17, conditionCode: ["CLOUDY"], precipitationAmount: { expected: 0.1, minimum: 0, maximum: 0.2 }, newHourField: true })) }, futureProduct: { untouched: [1, 2] } };
        const original = JSON.stringify(body);
        const result = await processResponse(request("currentWeather,forecastHourly"), response(body));
        const updated = JSON.parse(result.body);
        assert.equal(updated.currentWeather.temperature, 23);
        assert.deepEqual(updated.currentWeather.conditionCode, ["CLEAR"]);
        assert.equal(updated.currentWeather.metadata.latitude, 31.2);
        assert.equal(updated.currentWeather.windGust, undefined);
        assert.deepEqual(updated.currentWeather.futureCurrent, { retain: true });
        assert.equal(updated.currentWeather.metadata.futureMetadata, true);
        assert.deepEqual(updated.forecastHourly.hours[0].precipitationAmount, { expected: 0.4, minimum: 0.4, maximum: 0.4 });
        assert.deepEqual(updated.forecastHourly.hours[0].conditionCode, ["RAIN"]);
        assert.deepEqual(updated.forecastHourly.hours[1], body.forecastHourly.hours[1]);
        assert.deepEqual(updated.futureProduct, body.futureProduct);
        assert.equal(JSON.stringify(body), original);
        assert.deepEqual(result.headers, { "Content-Type": "application/json; charset=utf-8", "X-Apple": "retain", "Cache-Control": "no-store" });
    });
    test(`${name}: missing provider data and Apple-only settings retain exact original response`, async t => {
        settings();
        t.mock.method(QWeather.prototype, "WeatherNow", async () => undefined);
        const original = response(`  ${JSON.stringify({ currentWeather: current() })}\n`);
        assert.strictEqual(await processResponse(request(), original), original);
        settings({ "Weather.Provider": "WeatherKit" });
        t.mock.method(ColorfulClouds.prototype, "CurrentWeather", () => { throw new Error("must not start"); });
        assert.strictEqual(await processResponse(request(), original), original);
    });
    test(`${name}: v3 binary stays opaque rather than using a WK2 decoder`, async () => {
        settings();
        const original = { ...response("opaque WK3"), headers: { "Content-Type": "application/vnd.apple.flatbuffer;messageType=WK3.Weather" } };
        assert.strictEqual(await processResponse(request(), original), original);
    });
}

test("JSON provider adapter covers daily periods and minute summary without changing supported condition records", () => {
    const value = adaptV3ProviderProduct({ metadata: { latitude: "31.2", longitude: "invalid" }, days: [{ conditionCode: "RAIN", precipitationType: "RAIN", snowfallAmount: 2, daytimeForecast: { conditionCode: "CLOUDY" } }], summary: [{ condition: "CLEAR" }], condition: [{ beginCondition: "CLEAR", endCondition: "RAIN", parameters: [] }] });
    assert.deepEqual(value.days[0].daytimeForecast.conditionCode, ["CLOUDY"]);
    assert.deepEqual(value.days[0].snowfallAmount, { expected: 2, minimum: 2, maximum: 2 });
    assert.deepEqual(value.summary[0].condition, ["CLEAR"]);
    assert.equal(value.condition[0].beginCondition, "CLEAR");
    assert.equal(value.metadata.longitude, undefined);
});

test("v3 limits, invalid JSON, HTTP failures and unrelated URLs never start injectors", async () => {
    settings();
    const good = { currentWeather: current() };
    const deep = current(); let tail = deep;
    for (let i = 0; i < 66; i++) tail = tail.nested = {};
    const candidates = [response("{"), response(" ".repeat(1024 * 1024 + 1)), response({ currentWeather: { ...current(), huge: Array(8193).fill(0) } }), response({ currentWeather: deep }), response({ error: "not weather" }), { ...response(good), status: 503 }];
    let calls = 0;
    const injectors = { currentWeather: () => { calls++; throw new Error("unexpected work"); } };
    for (const original of candidates) assert.strictEqual(await ResponseJSONV3(request(), original, injectors), original);
    for (const url of [request().url.replace("weatherkit.apple.com", "example.com"), request().url.replace("/31.2/", "/91.2/")]) {
        const original = response(good);
        assert.strictEqual(await ResponseJSONV3({ url, method: "GET" }, original, injectors), original);
    }
    assert.equal(calls, 0);
});

test("a failed hourly product preserves its exact fields while a healthy current product changes", async t => {
    settings();
    t.mock.method(QWeather.prototype, "WeatherNow", async () => ({ metadata: { providerName: "Fixture" }, temperature: 23 }));
    t.mock.method(QWeather.prototype, "Hourly", async () => { throw new Error("provider failed"); });
    const body = { currentWeather: current(), forecastHourly: { metadata: metadata(), hours: [{ forecastStart: 100, futureValue: [1, 2] }] } };
    const result = JSON.parse((await Response(request("currentWeather,forecastHourly"), response(body))).body);
    assert.equal(result.currentWeather.temperature, 23);
    assert.deepEqual(result.forecastHourly, body.forecastHourly);
});

test("v3 air-quality calculation uses symbolic enums and leaves unrelated Apple products intact", async () => {
    settings({ DataSets: "airQuality", "AirQuality.Calculate.Algorithm": "UBA", "AirQuality.Current.Index.Replace": "HJ6332012" });
    const body = { airQuality: { metadata: metadata(), scale: "HJ6332012", index: 50, categoryIndex: 1, primaryPollutant: "PM2_5", previousDayComparison: "SIMILAR", pollutants: [{ pollutantType: "PM2_5", amount: 30, units: "MICROGRAMS_PER_CUBIC_METER" }, { pollutantType: "PM10", amount: 40, units: "MICROGRAMS_PER_CUBIC_METER" }] }, currentWeather: current(), futureProduct: { version: 3 } };
    const updated = JSON.parse((await Response(request("airQuality"), response(body))).body);
    assert.notEqual(updated.airQuality.scale, "HJ6332012");
    assert.ok(Number.isFinite(updated.airQuality.index));
    assert.equal(typeof updated.airQuality.primaryPollutant, "string");
    assert.equal(updated.airQuality.pollutants[0].units, "MICROGRAMS_PER_CUBIC_METER");
    assert.deepEqual(updated.currentWeather, body.currentWeather);
    assert.deepEqual(updated.futureProduct, body.futureProduct);
});
