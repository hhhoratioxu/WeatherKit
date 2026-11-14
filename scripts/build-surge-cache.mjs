// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import verifySurge from "./verify-surge-bundles.mjs";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const resourceRef = process.env.WEATHERKIT_RESOURCE_REF || `v${pkg.version}`;
if (!/^[A-Za-z0-9._/-]+$/.test(resourceRef)) throw new Error("Invalid resource ref");
execFileSync(process.execPath, [path.join(root, "node_modules/@iringo/arguments-builder/dist/lib/bin.js"), "surge", "-c", "arguments-builder.surge.config.ts"], { cwd: root, stdio: "inherit" });
const output = path.join(root, "Surge/script");
await mkdir(output, { recursive: true });
let plugin = await readFile(path.join(root, "dist/iRingo.WeatherKit.sgmodule"), "utf8");
const upstreamBase = `https://github.com/NSRingo/WeatherKit/releases/download/v${pkg.version}`;
if (plugin.split(`${upstreamBase}/`).length !== 8) throw new Error("Unexpected Surge script count");
plugin = plugin.replaceAll(`${upstreamBase}/`, `https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/${resourceRef}/Surge/script/`);
plugin = plugin.replace(/^(#!author = .+)$/m, "$1,hhhoratioxu[https://github.com/hhhoratioxu]");
// Surge parameter table names are identifiers; the script's settings retain
// their original dotted paths and values. Use a reversible, collision-free map.
const header = plugin.match(/^#!arguments = (.+)$/m)?.[1];
if (!header) throw new Error("Surge argument table missing");
const mapping = [...header.matchAll(/(?:^|,)([^,:]+):("[^"]*"|true|false|\d+)/g)].map(([, key]) => [key, key.replaceAll(".", "_")]);
if (mapping.length !== 13 || new Set(mapping.map(([, name]) => name)).size !== mapping.length) throw new Error("Unexpected or colliding Surge arguments");
let normalized = header;
for (const [key, name] of mapping) {
    normalized = normalized.replace(`${key}:`, `${name}:`);
    plugin = plugin.replaceAll(`{{{${key}}}}`, `{{{${name}}}}`);
}
plugin = plugin.replace(header, normalized);
await writeFile(path.join(output, "iRingo.WeatherKit.sgmodule"), plugin);
await writeFile(path.join(output, "WeatherKit.sgmodule"), plugin);
for (const name of ["transport", "availability", "scale", "request", "response"]) {
    const bytes = await readFile(path.join(root, "dist", `${name}.surge.bundle.js`));
    if (bytes.includes(Buffer.from("node:crypto"))) throw new Error(`Invalid native bundle: ${name}`);
    await writeFile(path.join(output, `${name}.surge.bundle.js`), bytes);
}
const checks = await verifySurge(root);
console.log(`Built Surge bundle checks: ${JSON.stringify(checks)}`);
await writeFile(path.join(output, "Surge.LICENSE.txt"), await readFile(path.join(root, "Loon/script/LICENSE.txt")));
const digest = value => createHash("sha256").update(value).digest("hex");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
await writeFile(path.join(output, "Surge.build-provenance.json"), `${JSON.stringify({ version: pkg.version, sourceCommit, resourceRef, node: process.version, bundleChecks: checks, argumentNames: Object.fromEntries(mapping), lockfileSHA256: digest(await readFile(path.join(root, "package-lock.json"))) }, null, 2)}\n`);
const files = ["iRingo.WeatherKit.sgmodule", "WeatherKit.sgmodule", ...["transport", "availability", "scale", "request", "response"].map(name => `${name}.surge.bundle.js`), "Surge.LICENSE.txt", "Surge.build-provenance.json"];
const hashes = await Promise.all(files.map(async name => `${digest(await readFile(path.join(output, name)))}  ${name}`));
await writeFile(path.join(output, "Surge.SHA256SUMS.txt"), `${hashes.join("\n")}\n`);
