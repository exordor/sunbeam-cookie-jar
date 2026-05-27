import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "_site");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

copyDirectory(path.join(rootDir, "site"), outDir);
copyDirectory(path.join(rootDir, "store-assets"), path.join(outDir, "store-assets"));
copyDirectory(path.join(rootDir, "public", "icons"), path.join(outDir, "icons"));

fs.copyFileSync(path.join(rootDir, "docs", "privacy-policy.md"), path.join(outDir, "privacy-policy.md"));
fs.writeFileSync(path.join(outDir, ".nojekyll"), "");

console.log(`Built GitHub Pages site at ${path.relative(rootDir, outDir)}`);

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}
