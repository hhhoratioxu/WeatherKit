// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import { sha256 } from "@noble/hashes/sha2";

// Application limits, not claims about the host VPN process's memory limit.
export const REQUEST_CACHE_LIMITS = Object.freeze({
    entries: 8,
    bodyCharacters: 96 * 1024,
    responseCharacters: 1024 * 1024,
    storageCharacters: 256 * 1024,
    identityCharacters: 8192,
    concurrent: 3,
    pending: 16,
    maximumTTLSeconds: 300,
});
export const REQUEST_CACHE_KEY = "WeatherKit.ProviderResponses.v1";

export function requestCacheTTL(value = 60) {
    if ((typeof value !== "number" && typeof value !== "string") || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) return 60;
    return Math.min(REQUEST_CACHE_LIMITS.maximumTTLSeconds, Number(value));
}

function loonStore() {
    if (typeof $loon !== "string" || typeof $persistentStore === "undefined") return undefined;
    return {
        read: () => $persistentStore.read(REQUEST_CACHE_KEY),
        write: value => $persistentStore.write(value, REQUEST_CACHE_KEY),
    };
}

function fingerprint(identity) {
    // Hash UTF-16 code units directly; this needs neither TextEncoder nor a host crypto API.
    const bytes = new Uint8Array(identity.length * 2);
    for (let index = 0; index < identity.length; index++) {
        const code = identity.charCodeAt(index);
        bytes[index * 2] = code >>> 8;
        bytes[index * 2 + 1] = code & 255;
    }
    return Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

function copyResponse(response) {
    return { ...response, headers: { ...response?.headers } };
}

export default class ProviderRequestCache {
    #memory = new Map();
    #inFlight = new Map();
    #waiting = [];
    #active = 0;
    #ttl;
    #now;
    #store;
    #stats = { requests: 0, coalesced: 0, memoryHits: 0, persistentHits: 0, stores: 0 };

    constructor({ ttlSeconds = 60, now = Date.now, store = loonStore() } = {}) {
        this.#ttl = requestCacheTTL(ttlSeconds);
        this.#now = now;
        this.#store = store;
    }

    get stats() {
        return { ...this.#stats };
    }

    async fetch(request, { fetcher, partition = [], product = "", maximumTTLSeconds = 300, validate } = {}) {
        if (typeof fetcher !== "function") throw new TypeError("Provider cache requires a fetch function");
        const method = String(request.method ?? "GET").toUpperCase();
        if (method !== "GET" || request.body !== undefined) return fetcher(request);
        const ttl = Math.min(this.#ttl, requestCacheTTL(maximumTTLSeconds));
        const key = this.#key(request, partition, product);
        if (key && ttl > 0) {
            const memory = this.#memory.get(key);
            if (this.#fresh(memory, ttl)) {
                this.#stats.memoryHits++;
                return this.#response(memory);
            }
            this.#memory.delete(key);
            const persisted = this.#read().find(entry => entry.key === key && this.#fresh(entry, ttl));
            if (persisted && this.#validBody(persisted.body, validate)) {
                this.#remember(persisted);
                this.#stats.persistentHits++;
                return this.#response(persisted);
            }
        }

        // The map belongs to this execution. Loon's separate script executions do not share Promises.
        if (key && this.#inFlight.has(key)) {
            this.#stats.coalesced++;
            return copyResponse(await this.#inFlight.get(key));
        }
        if (this.#inFlight.size >= REQUEST_CACHE_LIMITS.pending) throw new Error("Provider request queue is full");
        const owner = key ?? Symbol("uncacheable request");
        const pending = this.#schedule(async () => {
            this.#stats.requests++;
            // Wait for the native completion callback, rather than racing a detached JS timer.
            const response = await fetcher(request);
            if (typeof response?.body !== "string" || response.body.length > REQUEST_CACHE_LIMITS.responseCharacters) throw new Error("Unsupported or oversized provider JSON response");
            if (key && ttl > 0) this.#save(key, response, ttl, validate);
            return response;
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
                .filter(([key]) => key !== "headers")
                .sort(([left], [right]) => left.localeCompare(right));
            const headers = Object.entries(request.headers ?? {})
                .map(([key, value]) => [key.toLowerCase(), value])
                .sort(([left, leftValue], [right, rightValue]) => left.localeCompare(right) || String(leftValue).localeCompare(String(rightValue)));
            const identity = JSON.stringify([partition, product, fields, headers]);
            if (identity.length > REQUEST_CACHE_LIMITS.identityCharacters) return undefined;
            return fingerprint(identity);
        } catch {
            return undefined;
        }
    }

    async #schedule(work) {
        if (this.#active >= REQUEST_CACHE_LIMITS.concurrent) await new Promise(resolve => this.#waiting.push(resolve));
        else this.#active++;
        try {
            return await work();
        } finally {
            const next = this.#waiting.shift();
            if (next)
                next(); // Transfer the occupied slot directly to the next waiter.
            else this.#active--;
        }
    }

    #fresh(entry, ttl = REQUEST_CACHE_LIMITS.maximumTTLSeconds) {
        const now = this.#now();
        return (
            entry &&
            /^[a-f0-9]{64}$/.test(entry.key) &&
            Number.isFinite(entry.storedAt) &&
            Number.isFinite(entry.expiresAt) &&
            entry.expiresAt <= entry.storedAt + REQUEST_CACHE_LIMITS.maximumTTLSeconds * 1000 &&
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

    #validBody(body, validate) {
        if (typeof validate !== "function") return false;
        try {
            return validate(JSON.parse(body)) === true;
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
            if (parsed?.version !== 1 || !Array.isArray(parsed.entries) || parsed.entries.length > REQUEST_CACHE_LIMITS.entries) return [];
            return parsed.entries.filter(entry => this.#fresh(entry));
        } catch {
            return [];
        }
    }

    #save(key, response, ttl, validate) {
        const status = Number(response.statusCode ?? response.status);
        if (response.ok === false || status < 200 || status >= 300 || !Number.isFinite(status) || response.body.length > REQUEST_CACHE_LIMITS.bodyCharacters) return;
        const headers = Object.fromEntries(Object.entries(response.headers ?? {}).map(([name, value]) => [name.toLowerCase(), String(value)]));
        if (/\b(no-store|no-cache)\b/i.test(headers["cache-control"] ?? "") || headers.vary?.split(",").some(value => value.trim() === "*")) return;
        const maxAge = headers["cache-control"]?.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i)?.[1];
        if (maxAge !== undefined) ttl = Math.min(ttl, Math.max(0, Number(maxAge) - Math.max(0, Number(headers.age) || 0)));
        if (ttl <= 0 || !this.#validBody(response.body, validate)) return;
        const storedAt = this.#now();
        const entry = { key, storedAt, expiresAt: storedAt + ttl * 1000, status, body: response.body };
        this.#remember(entry);
        if (!this.#store) return;
        // Re-read before each synchronous write so completed requests merge with the latest snapshot.
        // Separate Loon runtimes can still overwrite cache entries; that only causes a cache miss.
        const merged = new Map(this.#read().map(item => [item.key, item]));
        for (const item of this.#memory.values()) if (this.#fresh(item)) merged.set(item.key, item);
        const entries = [...merged.values()].sort((left, right) => right.storedAt - left.storedAt).slice(0, REQUEST_CACHE_LIMITS.entries);
        let serialized = JSON.stringify({ version: 1, entries });
        while (entries.length && serialized.length > REQUEST_CACHE_LIMITS.storageCharacters) {
            entries.pop();
            serialized = JSON.stringify({ version: 1, entries });
        }
        try {
            if (this.#store.write(serialized) === true) this.#stats.stores++;
        } catch {
            // Storage failure must not turn a successful provider response into a failed request.
        }
    }

    #remember(entry) {
        this.#memory.delete(entry.key);
        this.#memory.set(entry.key, entry);
        while (this.#memory.size > REQUEST_CACHE_LIMITS.entries) this.#memory.delete(this.#memory.keys().next().value);
    }

    #response(entry) {
        // Only successful JSON bodies and timestamps are persisted. No URLs, tokens or cookies.
        return { status: entry.status, statusCode: entry.status, ok: true, headers: {}, body: entry.body };
    }
}
