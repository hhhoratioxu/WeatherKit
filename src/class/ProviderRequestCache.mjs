// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import { sha256 } from "@noble/hashes/sha2";

// Application bounds, not claims about the host VPN process's memory limits.
export const REQUEST_CACHE_LIMITS = Object.freeze({ entries: 8, bodyCharacters: 96 * 1024, responseCharacters: 1024 * 1024, storageCharacters: 256 * 1024, identityCharacters: 8192, concurrent: 3, pending: 16, maximumTTLSeconds: 300 });
export const REQUEST_CACHE_KEY = "WeatherKit.ProviderResponses.v1";
export const PROVIDER_FAILURE_KEY = "WeatherKit.ProviderFailures.v1";
export function requestCacheTTL(value = 60) {
    if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && value.trim() === "") || !Number.isFinite(Number(value)) || Number(value) < 0) return 60;
    return Math.min(300, Number(value));
}
export function fingerprint(identity) {
    const bytes = new Uint8Array(identity.length * 2);
    for (let index = 0; index < identity.length; index++) {
        const code = identity.charCodeAt(index);
        bytes[index * 2] = code >>> 8;
        bytes[index * 2 + 1] = code & 255;
    }
    return Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
function nativeStore(key) {
    if (typeof $loon !== "string" || typeof $persistentStore === "undefined") return undefined;
    return { read: () => $persistentStore.read(key), write: value => $persistentStore.write(value, key) };
}
function bounded(value, fallback, minimum, maximum) {
    const number = Number(value);
    return value === undefined || value === null || value === "" || !Number.isFinite(number) ? fallback : Math.max(minimum, Math.min(maximum, number));
}
export class ProviderRequestError extends Error {
    constructor(code) {
        super(code === "queue_full" ? "Provider request queue is full" : code === "invalid" ? "Unsupported or oversized provider response" : `WeatherKit provider request: ${code}`);
        this.name = "ProviderRequestError";
        this.code = code;
    }
}
export function providerErrorCode(error) {
    if (error instanceof ProviderRequestError) return error.code;
    return /timeout|timed out|超时/i.test(String(error?.message ?? error ?? "")) ? "timeout" : "network";
}
const copyResponse = response => ({ ...response, headers: { ...response?.headers } });

export default class ProviderRequestCache {
    #memory = new Map();
    #inFlight = new Map();
    #waiting = [];
    #active = 0;
    #failures = new Map();
    #ttl;
    #ttls;
    #now;
    #store;
    #failureStore;
    #startedAt;
    #budget;
    #cooldown;
    #diagnostics;
    #reported = false;
    #stats = { requests: 0, coalesced: 0, memoryHits: 0, persistentHits: 0, stores: 0, failures: 0, cooldownSkips: 0, budgetSkips: 0, peakActive: 0, networkMs: 0, fallbacks: 0, backupAttempts: 0, backupSuccesses: 0, reasons: {}, failureReasons: {} };
    constructor({ ttlSeconds = 60, ttls = {}, now = Date.now, store = nativeStore(REQUEST_CACHE_KEY), failureStore = nativeStore(PROVIDER_FAILURE_KEY), budgetMs = 0, cooldownSeconds = 0, diagnostics = false } = {}) {
        this.#ttl = requestCacheTTL(ttlSeconds);
        this.#ttls = ttls;
        this.#now = now;
        this.#store = store;
        this.#failureStore = failureStore;
        this.#startedAt = now();
        this.#budget = bounded(budgetMs, 0, 0, 15000);
        this.#cooldown = bounded(cooldownSeconds, 0, 0, 120);
        this.#diagnostics = diagnostics === true || diagnostics === "true";
        this.#loadFailures();
    }
    static fromSettings(settings = {}, options = {}) {
        const p = settings.RequestCache ?? {};
        return new ProviderRequestCache({
            ttlSeconds: p.TTL ?? 60,
            ttls: { forecast: bounded(p.ForecastTTL, 180, 0, 300), minutely: bounded(p.MinutelyTTL, 15, 0, 30), alerts: bounded(p.AlertsTTL, 15, 0, 30) },
            budgetMs: bounded(p.BudgetMs, 8000, 1000, 15000),
            cooldownSeconds: bounded(p.CooldownSeconds, 30, 0, 120),
            diagnostics: p.Diagnostics,
            ...options,
        });
    }
    get stats() {
        return { ...this.#stats, reasons: { ...this.#stats.reasons }, failureReasons: { ...this.#stats.failureReasons }, elapsedMs: Math.max(0, this.#now() - this.#startedAt) };
    }
    noteBackup(success) {
        this.#stats.backupAttempts++;
        if (success) this.#stats.backupSuccesses++;
    }
    noteFallback(product = "unknown", reason = "unavailable") {
        this.#stats.fallbacks++;
        const key = /^(currentWeather|forecastDaily|forecastHourly|forecastNextHour|weatherAlerts|airQuality|request)$/.test(product) ? product : "other";
        const code = /^(unavailable|invalid|budget|cooldown|network|timeout|region|http|rate_limit|auth)$/.test(reason) ? reason : "unavailable";
        const label = `${key}:${code}`;
        this.#stats.reasons[label] = (this.#stats.reasons[label] ?? 0) + 1;
    }
    report(label = "response") {
        if (!this.#diagnostics || this.#reported || typeof $loon !== "string") return;
        this.#reported = true;
        // Fixed labels and numeric counters only: never include request identities, bodies or error messages.
        console.log(`[WeatherKit] ${JSON.stringify({ phase: label === "request" ? "request" : "response", ...this.stats })}`);
    }
    #lifetime(kind, maximum) {
        if (this.#ttl === 0) return 0;
        const preferred = this.#ttls[kind] === undefined ? this.#ttl : requestCacheTTL(this.#ttls[kind]);
        return Math.min(preferred, requestCacheTTL(maximum), kind === "alerts" || kind === "minutely" ? 30 : 300);
    }
    async fetch(request, { fetcher, partition = [], product = "", kind = "current", group, maximumTTLSeconds = 300, validate, format = "json", maximumResponseCharacters = REQUEST_CACHE_LIMITS.responseCharacters, cacheable = true, allowNotModified = false } = {}) {
        if (typeof fetcher !== "function") throw new TypeError("Provider cache requires a fetch function");
        const method = String(request.method ?? "GET").toUpperCase();
        const eligible = cacheable && method === "GET" && request.body === undefined && request.bodyBytes === undefined;
        const ttl = this.#lifetime(kind, maximumTTLSeconds),
            key = eligible ? this.#key(request, partition, product) : undefined;
        const valid = body => this.#validBody(body, validate, format);
        if (key && ttl > 0) {
            const memory = this.#memory.get(key);
            if (this.#fresh(memory, ttl) && valid(memory.body)) {
                memory.lastUsedAt = this.#now();
                this.#remember(memory);
                this.#stats.memoryHits++;
                return this.#response(memory);
            }
            this.#memory.delete(key);
            const persisted = this.#read().find(entry => entry.key === key && this.#fresh(entry, ttl));
            if (persisted && valid(persisted.body)) {
                persisted.lastUsedAt = this.#now();
                this.#remember(persisted);
                this.#stats.persistentHits++;
                return this.#response(persisted);
            }
        }
        if (key && this.#inFlight.has(key)) {
            this.#stats.coalesced++;
            return copyResponse(await this.#inFlight.get(key));
        }
        if (this.#inFlight.size >= REQUEST_CACHE_LIMITS.pending) throw new ProviderRequestError("queue_full");
        const owner = key ?? Symbol("uncacheable request");
        const pending = this.#schedule(async () => {
            if (key && this.#cooling(key)) {
                this.#stats.cooldownSkips++;
                throw new ProviderRequestError("cooldown");
            }
            const remaining = this.#budget ? this.#budget - (this.#now() - this.#startedAt) : Number.POSITIVE_INFINITY;
            if (remaining < 250 || (this.#budget > 0 && this.#now() < this.#startedAt)) {
                this.#stats.budgetSkips++;
                throw new ProviderRequestError("budget");
            }
            const outgoing = typeof $loon === "string" ? { ...request, timeout: Math.max(1, Math.floor(Math.min(bounded(request.timeout, 5000, 1, 5000), remaining))) } : request;
            const started = this.#now();
            this.#stats.requests++;
            try {
                // Await the native callback. No detached timer, cancellation or early $done.
                const response = await fetcher(outgoing);
                const maximum = bounded(maximumResponseCharacters, REQUEST_CACHE_LIMITS.responseCharacters, 1, 2 * 1024 * 1024);
                if (typeof response?.body !== "string" || response.body.length > maximum) throw new ProviderRequestError("invalid");
                const status = Number(response.statusCode ?? response.status);
                if (response.ok !== false && Number.isInteger(status) && ((status >= 200 && status < 300) || (allowNotModified && status === 304)) && valid(response.body)) {
                    if (key) this.#success(key);
                    if (key && ttl > 0) this.#save(key, response, ttl, valid, group);
                } else this.#failure(key, status === 429 ? "rate_limit" : status === 401 || status === 403 ? "auth" : status >= 400 ? "http" : "invalid", response.headers);
                return response;
            } catch (error) {
                this.#failure(key, providerErrorCode(error));
                throw new ProviderRequestError(providerErrorCode(error));
            } finally {
                this.#stats.networkMs += Math.max(0, this.#now() - started);
            }
        });
        this.#inFlight.set(owner, pending);
        try {
            return copyResponse(await pending);
        } finally {
            if (this.#inFlight.get(owner) === pending) this.#inFlight.delete(owner);
        }
    }
    #key(request, partition, product) {
        try {
            const fields = Object.entries(request)
                .filter(([key]) => key !== "headers" && key !== "timeout")
                .sort(([a], [b]) => a.localeCompare(b));
            const headers = Object.entries(request.headers ?? {})
                .map(([key, value]) => [key.toLowerCase(), value])
                .sort(([a, av], [b, bv]) => a.localeCompare(b) || String(av).localeCompare(String(bv)));
            const identity = JSON.stringify([partition, product, fields, headers]);
            return identity.length > REQUEST_CACHE_LIMITS.identityCharacters ? undefined : fingerprint(identity);
        } catch {
            return undefined;
        }
    }
    async #schedule(work) {
        if (this.#active >= REQUEST_CACHE_LIMITS.concurrent) await new Promise(resolve => this.#waiting.push(resolve));
        else this.#active++;
        this.#stats.peakActive = Math.max(this.#stats.peakActive, this.#active);
        try {
            return await work();
        } finally {
            const next = this.#waiting.shift();
            if (next) next();
            else this.#active--;
        }
    }
    #fresh(entry, ttl = 300) {
        const now = this.#now();
        return (
            entry &&
            /^[a-f0-9]{64}$/.test(entry.key) &&
            Number.isFinite(entry.storedAt) &&
            Number.isFinite(entry.expiresAt) &&
            entry.expiresAt <= entry.storedAt + 300000 &&
            Number.isInteger(entry.status) &&
            entry.status >= 200 &&
            entry.status < 300 &&
            typeof entry.body === "string" &&
            entry.body.length <= REQUEST_CACHE_LIMITS.bodyCharacters &&
            now >= entry.storedAt &&
            now < entry.expiresAt &&
            now - entry.storedAt < ttl * 1000
        );
    }
    #validBody(body, validate, format) {
        if (typeof validate !== "function") return false;
        try {
            return validate(format === "text" ? body : JSON.parse(body)) === true;
        } catch {
            return false;
        }
    }
    #read() {
        if (!this.#store) return [];
        try {
            const raw = this.#store.read();
            if (typeof raw !== "string" || raw.length > REQUEST_CACHE_LIMITS.storageCharacters) return [];
            const parsed = JSON.parse(raw);
            if (parsed?.version !== 1 || !Array.isArray(parsed.entries) || parsed.entries.length > 8) return [];
            return parsed.entries
                .filter(entry => this.#fresh(entry))
                .map(({ key, storedAt, expiresAt, status, body, group, lastUsedAt }) => ({ key, storedAt, expiresAt, status, body, group: /^[a-f0-9]{64}$/.test(group) ? group : key, lastUsedAt: Number.isFinite(lastUsedAt) && lastUsedAt >= storedAt && lastUsedAt <= this.#now() ? lastUsedAt : storedAt }));
        } catch {
            return [];
        }
    }
    #select(entries) {
        // Round-robin by hashed city, with the most recently used city and products first.
        const groups = new Map();
        for (const entry of [...entries].sort((a, b) => (b.lastUsedAt ?? b.storedAt) - (a.lastUsedAt ?? a.storedAt))) {
            const key = entry.group ?? entry.key;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(entry);
        }
        const selected = [];
        while (selected.length < 8 && groups.size)
            for (const [key, queue] of groups) {
                selected.push(queue.shift());
                if (!queue.length) groups.delete(key);
                if (selected.length === 8) break;
            }
        return selected;
    }
    #save(key, response, ttl, valid, group) {
        if (response.body.length > REQUEST_CACHE_LIMITS.bodyCharacters) return;
        const headers = Object.fromEntries(Object.entries(response.headers ?? {}).map(([name, value]) => [name.toLowerCase(), String(value)]));
        if (/\b(no-store|no-cache)\b/i.test(headers["cache-control"] ?? "") || headers.vary?.split(",").some(value => value.trim() === "*")) return;
        const maxAge = headers["cache-control"]?.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i)?.[1];
        if (maxAge !== undefined) ttl = Math.min(ttl, Math.max(0, Number(maxAge) - Math.max(0, Number(headers.age) || 0)));
        if (ttl <= 0 || !valid(response.body)) return;
        const storedAt = this.#now(),
            entry = { key, storedAt, lastUsedAt: storedAt, expiresAt: storedAt + ttl * 1000, status: Number(response.statusCode ?? response.status), body: response.body, group: group ? fingerprint(JSON.stringify(group)) : key };
        this.#remember(entry);
        if (!this.#store) return;
        const merged = new Map(this.#read().map(item => [item.key, item]));
        for (const item of this.#memory.values()) if (this.#fresh(item)) merged.set(item.key, item);
        const entries = this.#select(merged.values());
        let serialized = JSON.stringify({ version: 1, entries });
        while (entries.length && serialized.length > REQUEST_CACHE_LIMITS.storageCharacters) {
            entries.pop();
            serialized = JSON.stringify({ version: 1, entries });
        }
        try {
            if (this.#store.write(serialized) === true) this.#stats.stores++;
        } catch {
            /* Optional storage must not break a successful response. */
        }
    }
    #remember(entry) {
        this.#memory.delete(entry.key);
        this.#memory.set(entry.key, entry);
        if (this.#memory.size > 8) this.#memory = new Map(this.#select(this.#memory.values()).map(item => [item.key, item]));
    }
    #response(entry) {
        return { status: entry.status, statusCode: entry.status, ok: true, headers: {}, body: entry.body };
    }
    #loadFailures() {
        if (!this.#cooldown || !this.#failureStore) return;
        try {
            const raw = this.#failureStore.read();
            if (typeof raw !== "string" || raw.length > 8192) return;
            const data = JSON.parse(raw);
            if (data?.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 32) return;
            for (const entry of data.entries)
                if (/^[a-f0-9]{64}$/.test(entry.key) && Number.isFinite(entry.at) && entry.at <= this.#now() && this.#now() - entry.at < 120000 && Number.isFinite(entry.until) && entry.until <= entry.at + 120000 && Number.isInteger(entry.count) && entry.count > 0 && entry.count <= 2)
                    this.#failures.set(entry.key, { key: entry.key, at: entry.at, until: entry.until, count: entry.count });
        } catch {
            /* Corrupt optional cooldown state is ignored. */
        }
    }
    #persistFailures() {
        if (!this.#failureStore || !this.#cooldown) return;
        // Merge other completed executions' state before writing; no transaction is assumed.
        const own = new Map(this.#failures);
        this.#loadFailures();
        for (const [key, value] of own) this.#failures.set(key, value);
        const entries = [...this.#failures.values()]
            .filter(e => this.#now() >= e.at && this.#now() - e.at < 120000)
            .sort((a, b) => b.at - a.at)
            .slice(0, 32);
        this.#failures = new Map(entries.map(entry => [entry.key, entry]));
        try {
            this.#failureStore.write(JSON.stringify({ version: 1, entries }));
        } catch {
            /* A failed write can only cause a later extra request. */
        }
    }
    #cooling(key) {
        const value = this.#failures.get(key);
        return value && this.#now() >= value.at && this.#now() < value.until;
    }
    #failure(key, reason, headers = {}) {
        this.#stats.failures++;
        const code = /^(timeout|network|http|rate_limit|auth|invalid)$/.test(reason) ? reason : "network";
        this.#stats.failureReasons[code] = (this.#stats.failureReasons[code] ?? 0) + 1;
        if (!key || !this.#cooldown) return;
        const at = this.#now(),
            previous = this.#failures.get(key),
            count = previous && at >= previous.at && at - previous.at < 120000 ? Math.min(2, previous.count + 1) : 1;
        const retry = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === "retry-after")?.[1];
        const retrySeconds = Number.isFinite(Number(retry)) ? Number(retry) : Number.isFinite(Date.parse(retry)) ? (Date.parse(retry) - at) / 1000 : 0;
        const seconds = reason === "rate_limit" ? Math.min(120, Math.max(this.#cooldown, retrySeconds)) : this.#cooldown;
        this.#failures.set(key, { key, at, count, until: at + (count >= 2 || reason === "rate_limit" || reason === "auth" ? seconds * 1000 : 0) });
        this.#persistFailures();
    }
    #success(key) {
        if (this.#failures.has(key)) {
            this.#failures.delete(key);
            if (this.#failureStore) {
                try {
                    const entries = [...this.#failures.values()];
                    this.#failureStore.write(JSON.stringify({ version: 1, entries }));
                } catch {}
            }
        }
    }
}
