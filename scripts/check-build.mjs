import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const outputDirectory = resolve("dist");
const html = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(
  ([, assetPath]) => assetPath,
);

if (assetPaths.length < 2) {
  throw new Error("The production HTML does not reference both a JavaScript and CSS asset.");
}

for (const assetPath of assetPaths) {
  const localAssetPath = new URL(assetPath, "https://weatherly.invalid").pathname;
  const assetSegments = decodeURIComponent(localAssetPath).split("/").filter(Boolean);
  const assetsIndex = assetSegments.lastIndexOf("assets");
  if (assetsIndex === -1) {
    throw new Error(`The production asset is not in the Vite assets directory: ${assetPath}`);
  }
  const filePath = resolve(outputDirectory, ...assetSegments.slice(assetsIndex));
  const relativePath = relative(outputDirectory, filePath);
  if (isAbsolute(relativePath) || relativePath.startsWith("..")) {
    throw new Error(`The production asset path is outside the build output: ${assetPath}`);
  }
  await access(filePath);
  console.log(`Production asset exists: ${assetPath}`);
}

console.log("Production build output is valid.");
