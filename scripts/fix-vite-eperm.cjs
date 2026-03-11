const fs = require("node:fs");
const path = require("node:path");

const viteChunkPath = path.join(
  process.cwd(),
  "node_modules",
  "vite",
  "dist",
  "node",
  "chunks",
  "config.js",
);

function run() {
  if (!fs.existsSync(viteChunkPath)) {
    return;
  }

  const source = fs.readFileSync(viteChunkPath, "utf8");
  if (source.includes("try {\n\t\texec(\"net use\"")) {
    return;
  }

  const target = "exec(\"net use\", (error$1, stdout) => {\n\t\tif (error$1) return;\n\t\tconst lines = stdout.split(\"\\n\");\n\t\tfor (const line of lines) {\n\t\t\tconst m = parseNetUseRE.exec(line);\n\t\t\tif (m) windowsNetworkMap.set(m[2], m[1]);\n\t\t}\n\t\tif (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;\n\t\telse safeRealpathSync = windowsMappedRealpathSync;\n\t});";
  if (!source.includes(target)) {
    return;
  }

  const replacement = "try {\n\t\texec(\"net use\", (error$1, stdout) => {\n\t\t\tif (error$1) return;\n\t\t\tconst lines = stdout.split(\"\\n\");\n\t\t\tfor (const line of lines) {\n\t\t\t\tconst m = parseNetUseRE.exec(line);\n\t\t\t\tif (m) windowsNetworkMap.set(m[2], m[1]);\n\t\t\t}\n\t\t\tif (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;\n\t\t\telse safeRealpathSync = windowsMappedRealpathSync;\n\t\t});\n\t} catch {\n\t\tsafeRealpathSync = fs.realpathSync.native;\n\t}";
  const patched = source.replace(target, replacement);
  fs.writeFileSync(viteChunkPath, patched, "utf8");
}

run();
