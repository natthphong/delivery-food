const { execSync } = require("node:child_process");
const { rmSync, existsSync, mkdirSync, symlinkSync } = require("node:fs");
const path = require("node:path");

const outDir = path.resolve(__dirname, "../.test-dist");
const tscPath = path.resolve(__dirname, "../node_modules/.bin/tsc");

function run(command, options = {}) {
    execSync(command, { stdio: "inherit", ...options });
}

try {
    if (existsSync(outDir)) {
        rmSync(outDir, { recursive: true, force: true });
    }
    run(`${tscPath} --project tsconfig.test.json`);
    const nodeModulesDir = path.join(outDir, "node_modules");
    mkdirSync(nodeModulesDir, { recursive: true });

    const aliasLinks = [
        { alias: "@utils", target: path.join(outDir, "src/utils") },
        { alias: "@store", target: path.join(outDir, "src/store") },
    ];

    for (const { alias, target } of aliasLinks) {
        const linkPath = path.join(nodeModulesDir, alias);
        try {
            symlinkSync(target, linkPath, "dir");
        } catch (error) {
            if (error.code !== "EEXIST") throw error;
        }
    }

    const scopeDir = path.join(nodeModulesDir, "@");
    mkdirSync(scopeDir, { recursive: true });
    const scopeLinks = [
        { name: "store", target: path.join(outDir, "src/store") },
        { name: "utils", target: path.join(outDir, "src/utils") },
    ];
    for (const { name, target } of scopeLinks) {
        const linkPath = path.join(scopeDir, name);
        try {
            symlinkSync(target, linkPath, "dir");
        } catch (error) {
            if (error.code !== "EEXIST") throw error;
        }
    }

    run(`node --test ${path.join(outDir, "tests")}`);
} finally {
    if (existsSync(outDir)) {
        rmSync(outDir, { recursive: true, force: true });
    }
}
