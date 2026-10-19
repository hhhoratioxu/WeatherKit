// Copyright 2026 hhhoratioxu. SPDX-License-Identifier: Apache-2.0
import path from "node:path";
import alias from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import pkg from "../package.json" with { type: "json" };

const entry = (input, name) => ({
    input,
    output: { file: `dist/${name}.bundle.js`, format: "es", banner: `/* WeatherKit ${pkg.version}; Apache-2.0. Build provenance: Loon/script/build-provenance.json */` },
    plugins: [alias({ entries: [{ find: "@nsringo/weatherkit", replacement: path.resolve(import.meta.dirname, "../node_modules/@nsringo/weatherkit/dist/index.js") }] }), nodeResolve(), terser()],
});
export default [entry("src/loon/request.js", "request"), entry("src/loon/response.js", "response"), entry("src/loon/scale.js", "scale")];
