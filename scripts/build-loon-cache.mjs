// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const resourceRef = process.env.WEATHERKIT_RESOURCE_REF || "cache-v1";
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
plugin = plugin.replace(/^#!name = .+$/m, "#!name =  WeatherKit · 请求缓存优化");
plugin = plugin.replace(/^#!homepage = .+$/m, "#!homepage = https://github.com/hhhoratioxu/WeatherKit");
plugin = plugin.replace(/^(#!author = .+)$/m, "$1,hhhoratioxu[https://github.com/hhhoratioxu]");
plugin = plugin.replace('RequestCache.TTL = input,"60",', 'RequestCache.TTL = input,"60",type=string,');
if (!plugin.includes('RequestCache.TTL = input,"60",type=string,')) throw new Error("Cache TTL must be a native Loon String argument");
if (plugin.includes(`${upstreamBase}/`)) throw new Error("The fork must load its own optimized scripts");
await writeFile(path.join(output, "WeatherKit.plugin"), plugin);
for (const name of ["request.bundle.js", "response.bundle.js"]) {
    const bytes = await readFile(path.join(root, "dist", name));
    if (bytes.length < 10_000 || bytes.includes(Buffer.from("node:crypto"))) throw new Error(`Invalid native bundle: ${name}`);
    await writeFile(path.join(output, name), bytes);
}
const notice = `WeatherKit request-cache fork, ${pkg.version}\nUpstream: NSRingo/WeatherKit, Apache-2.0\nModifications: hhhoratioxu, 2026-10-19\nCache key hashing: @noble/hashes 1.8.0, MIT, Paul Miller\nSource and behavioral limits: docs/request-cache.md\n\n`;
await writeFile(path.join(output, "LICENSE.txt"), `${notice}${await readFile(path.join(root, "LICENSE"), "utf8")}\n\n@noble/hashes MIT license:\n${await readFile(path.join(root, "node_modules/@noble/hashes/LICENSE"), "utf8")}`);
const digest = value => createHash("sha256").update(value).digest("hex");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
await writeFile(path.join(output, "build-provenance.json"), `${JSON.stringify({ version: pkg.version, sourceCommit, resourceRef, node: process.version, schemaPackage: schemaPackage.version, lockfileSHA256: digest(await readFile(path.join(root, "package-lock.json"))) }, null, 2)}\n`);
const files = ["WeatherKit.plugin", "request.bundle.js", "response.bundle.js", "LICENSE.txt", "build-provenance.json"];
const hashes = await Promise.all(files.map(async name => `${digest(await readFile(path.join(output, name)))}  ${name}`));
await writeFile(path.join(output, "SHA256SUMS.txt"), `${hashes.join("\n")}\n`);
console.log(`Generated Loon cache plugin and ${files.length} verified files in Loon/script`);
