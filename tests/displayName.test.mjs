import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const pkg = JSON.parse(await read("package.json"));
const displayName = content => {
    const first = content.split(/\r?\n/, 1)[0];
    if (first.startsWith("#!name = ")) return first.slice("#!name = ".length);
    const yamlName = first.match(/^name: (["'])(.*)\1$/);
    assert.ok(yamlName, `Missing display name: ${first}`);
    return yamlName[2];
};

test("WeatherKit has one plain display name while retaining its package identity", async () => {
    assert.equal(pkg.displayName, "WeatherKit");
    assert.equal((await read("README.md")).split(/\r?\n/, 1)[0], "# WeatherKit");
    assert.equal(pkg.name, "@nsringo/weatherkit");
    assert.equal(pkg.organizationName, " iRingo");
    assert.equal(pkg.openUrl, "http://boxjs.com/#/app/iRingo.WeatherKit");
    assert.equal(pkg.license, "Apache-2.0");
});

test("release, development and Rewrite templates add no display-name suffix", async () => {
    const templates = (await readdir(new URL("template/", root))).filter(name => name.endsWith(".handlebars"));
    assert.ok(templates.length >= 13);
    for (const name of templates) {
        assert.equal(displayName(await read(`template/${name}`)), "{{@package 'displayName'}}", name);
    }
    assert.doesNotMatch(await read("rollup.dev.config.mjs"), /\$\{pkg\.displayName\}\s*β/);
});

test("maintained import files show WeatherKit and retain compatibility filenames and authors", async () => {
    const loon = ["iRingo.WeatherKit.lpx", "WeatherKit.lpx", "WeatherKit.plugin"];
    const surge = ["iRingo.WeatherKit.sgmodule", "WeatherKit.sgmodule"];
    for (const [directory, aliases] of [["Loon/script", loon], ["Surge/script", surge]]) {
        const canonical = await read(`${directory}/${aliases[0]}`);
        for (const alias of aliases) {
            const content = await read(`${directory}/${alias}`);
            assert.equal(displayName(content), "WeatherKit", alias);
            assert.equal(content, canonical, `Compatibility alias differs: ${alias}`);
            assert.ok(content.includes(`#!version = ${pkg.version}`), alias);
            assert.ok(content.includes(`#!openUrl = ${pkg.openUrl}`), alias);
            assert.ok(content.includes(`#!homepage = ${pkg.homepage}`), alias);
            assert.match(content, /^#!author = .*VirgilClyne\[https:\/\/github\.com\/VirgilClyne\].*hhhoratioxu\[https:\/\/github\.com\/hhhoratioxu\]/m, alias);
        }
    }
    const modules = await readdir(new URL("modules/", root));
    for (const name of modules) assert.equal(displayName(await read(`modules/${name}`)), "WeatherKit", name);
});

test("development publication descriptions retain the same plain display name", async () => {
    const descriptions = [...(await read(".github/workflows/deploy.yml")).matchAll(/^\s+gist_description: "([^"]+)"$/gm)].map(match => match[1]);
    assert.equal(descriptions.length, 6);
    assert.deepEqual([...new Set(descriptions)], ["WeatherKit"]);
});
