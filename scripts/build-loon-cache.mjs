// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import verifyLoonCache from "./verify-loon-cache.mjs";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const resourceRef = process.env.WEATHERKIT_RESOURCE_REF || `v${pkg.version}`;
if (!/^[A-Za-z0-9._/-]+$/.test(resourceRef)) throw new Error("Invalid resource ref");
const schemaPackage = JSON.parse(await readFile(path.join(root, "node_modules/@nsringo/weatherkit/package.json"), "utf8"));
if (schemaPackage.version !== "1.1.2") throw new Error("Expected the upstream WeatherKit 1.1.2 schema package");
execFileSync(process.execPath, [path.join(root, "node_modules/@iringo/arguments-builder/dist/lib/bin.js"), "loon", "-c", "arguments-builder.release.config.ts"], { cwd: root, stdio: "inherit" });

const output = path.join(root, "Loon/script");
await mkdir(output, { recursive: true });
const runtimeBase = `https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/${resourceRef}/Loon/script`;
let plugin = await readFile(path.join(root, "dist/iRingo.WeatherKit.lpx"), "utf8");
const upstreamBase = `https://github.com/NSRingo/WeatherKit/releases/download/v${pkg.version}`;
if (plugin.split(`${upstreamBase}/`).length !== 6) throw new Error("Unexpected generated Loon script count");
plugin = plugin.replaceAll(`${upstreamBase}/`, `${runtimeBase}/`);
// Read the display name from package.json; preserve the upstream description
// and homepage while retaining the Fork's distribution URLs and contributor credit.
plugin = plugin.replace(/^(#!author = .+)$/m, "$1,hhhoratioxu[https://github.com/hhhoratioxu]");
plugin = plugin.replace(/^(#!system_version = .+)$/m, "$1\n#!loon_version = 3.5.1(983)");
if (plugin.includes(`${upstreamBase}/`)) throw new Error("The fork must load its own optimized scripts");
await writeFile(path.join(output, "iRingo.WeatherKit.lpx"), plugin);
// Existing subscriptions remain byte-identical compatibility aliases.
await writeFile(path.join(output, "WeatherKit.lpx"), plugin);
await writeFile(path.join(output, "WeatherKit.plugin"), plugin);
for (const name of ["request.bundle.js", "response.bundle.js", "scale.bundle.js"]) {
    const bytes = await readFile(path.join(root, "dist", name));
    if (bytes.length < 1000 || bytes.includes(Buffer.from("node:crypto"))) throw new Error(`Invalid native bundle: ${name}`);
    await writeFile(path.join(output, name), bytes);
}
const bundleChecks = await verifyLoonCache(root);
console.log(`Built bundle checks: ${JSON.stringify(bundleChecks)}`);
const notice = `WeatherKit ${pkg.version}\nUpstream: NSRingo/WeatherKit, Apache-2.0\nFork distribution: hhhoratioxu/WeatherKit\nModifications: hhhoratioxu, 2026-10-19 onward\nSource and behavioral limits: docs/remove-extra-controls-2026-11-13.md\n\n`;
await writeFile(path.join(output, "LICENSE.txt"), `${notice}${await readFile(path.join(root, "LICENSE"), "utf8")}`);
const digest = value => createHash("sha256").update(value).digest("hex");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
await writeFile(path.join(output, "build-provenance.json"), `${JSON.stringify({ version: pkg.version, sourceCommit, resourceRef, node: process.version, schemaPackage: schemaPackage.version, bundleChecks, lockfileSHA256: digest(await readFile(path.join(root, "package-lock.json"))) }, null, 2)}\n`);
const files = ["iRingo.WeatherKit.lpx", "WeatherKit.lpx", "WeatherKit.plugin", "request.bundle.js", "response.bundle.js", "scale.bundle.js", "LICENSE.txt", "build-provenance.json"];
const hashes = await Promise.all(files.map(async name => `${digest(await readFile(path.join(output, name)))}  ${name}`));
await writeFile(path.join(output, "SHA256SUMS.txt"), `${hashes.join("\n")}\n`);
console.log(`Generated Loon plugin and ${files.length} verified files in Loon/script`);
