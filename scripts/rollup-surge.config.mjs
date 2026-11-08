// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import path from "node:path";
import alias from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import pkg from "../package.json" with { type: "json" };
const entry = name => ({
    input: `src/surge/${name}.js`,
    output: { file: `dist/${name}.surge.bundle.js`, format: "es", banner: `/* WeatherKit ${pkg.version}; Apache-2.0. Build provenance: Surge/script/Surge.build-provenance.json */` },
    plugins: [alias({ entries: [{ find: "@nsringo/weatherkit", replacement: path.resolve(import.meta.dirname, "../node_modules/@nsringo/weatherkit/dist/index.js") }] }), nodeResolve(), terser()],
});
export default ["transport", "availability", "scale", "request", "response"].map(entry);
