// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import verifyLoonCache from "./verify-loon-cache.mjs";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const resourceRef = process.env.WEATHERKIT_RESOURCE_REF || "cache-v3";
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
plugin = plugin.replace(/^#!name = .+$/m, "#!name =  WeatherKit · 稳定性与缓存优化");
plugin = plugin.replace(/^#!homepage = .+$/m, "#!homepage = https://github.com/hhhoratioxu/WeatherKit");
plugin = plugin.replace(/^(#!author = .+)$/m, "$1,hhhoratioxu[https://github.com/hhhoratioxu]");
for (const key of ["RequestCache.TTL", "RequestCache.ForecastTTL", "RequestCache.MinutelyTTL", "RequestCache.AlertsTTL", "RequestCache.BudgetMs", "RequestCache.CooldownSeconds"]) {
    const line = plugin.split("\n").find(line => line.startsWith(`${key} = input,`));
    if (!line) throw new Error(`Missing Loon cache input: ${key}`);
    plugin = plugin.replace(line, line.replace(/(input,"[^"]*",)/, "$1type=string,"));
}
plugin = plugin.replace("RequestCache.Diagnostics = switch,false,", "RequestCache.Diagnostics = switch,false,type=boolean,");
if (!plugin.includes("RequestCache.Diagnostics = switch,false,type=boolean,")) throw new Error("Missing typed diagnostic switch");
const regionLine = plugin.split("\n").find(line => line.startsWith("Region.Fallback = select,"));
if (!regionLine) throw new Error("Missing Loon region selector");
plugin = plugin.replace(regionLine, regionLine.replace(",tag=", ",type=string,tag="));
plugin = plugin.replace(/^(#!system_version = .+)$/m, "$1\n#!loon_version = 3.5.1(983)");
if (plugin.includes(`${upstreamBase}/`)) throw new Error("The fork must load its own optimized scripts");
await writeFile(path.join(output, "WeatherKit.plugin"), plugin);
for (const name of ["request.bundle.js", "response.bundle.js"]) {
    const bytes = await readFile(path.join(root, "dist", name));
    if (bytes.length < 10_000 || bytes.includes(Buffer.from("node:crypto"))) throw new Error(`Invalid native bundle: ${name}`);
    await writeFile(path.join(output, name), bytes);
}
const bundleChecks = await verifyLoonCache(root);
console.log(`Built bundle checks: ${JSON.stringify(bundleChecks)}`);
const notice = `WeatherKit request-cache fork, ${pkg.version}\nUpstream: NSRingo/WeatherKit, Apache-2.0\nModifications: hhhoratioxu, 2026-10-19\nCache key hashing: @noble/hashes 1.8.0, MIT, Paul Miller\nProvider region data: Natural Earth, public domain; source in docs/provider-regions-source.json\nSource and behavioral limits: docs/request-cache.md\n\n`;
await writeFile(path.join(output, "LICENSE.txt"), `${notice}${await readFile(path.join(root, "LICENSE"), "utf8")}\n\n@noble/hashes MIT license:\n${await readFile(path.join(root, "node_modules/@noble/hashes/LICENSE"), "utf8")}`);
const digest = value => createHash("sha256").update(value).digest("hex");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
await writeFile(path.join(output, "build-provenance.json"), `${JSON.stringify({ version: pkg.version, sourceCommit, resourceRef, node: process.version, schemaPackage: schemaPackage.version, bundleChecks, lockfileSHA256: digest(await readFile(path.join(root, "package-lock.json"))) }, null, 2)}\n`);
const files = ["WeatherKit.plugin", "request.bundle.js", "response.bundle.js", "LICENSE.txt", "build-provenance.json"];
const hashes = await Promise.all(files.map(async name => `${digest(await readFile(path.join(output, name)))}  ${name}`));
await writeFile(path.join(output, "SHA256SUMS.txt"), `${hashes.join("\n")}\n`);
console.log(`Generated Loon cache plugin and ${files.length} verified files in Loon/script`);
