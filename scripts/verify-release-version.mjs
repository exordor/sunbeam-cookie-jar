import fs from "node:fs";

const tag = process.env.RELEASE_TAG ?? process.argv[2] ?? "";
if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`Release tag must use stable SemVer format vX.Y.Z. Received: ${tag || "(empty)"}`);
}

const version = tag.slice(1);
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));

if (pkg.version !== version) {
  throw new Error(`package.json version ${pkg.version} does not match release tag ${tag}.`);
}

if (manifest.version !== version) {
  throw new Error(`public/manifest.json version ${manifest.version} does not match release tag ${tag}.`);
}

console.log(`Release version check passed for ${tag}.`);
