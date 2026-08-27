import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const canonicalUrl = new URL("../../build/export/pc_anatomy_web_final.glb", import.meta.url);
const builtUrl = new URL("../dist/assets/models/pc_anatomy_web_final.glb", import.meta.url);
const expectedHash = "221d028bbaa5820ae7957ceb26a1e0ce88f98f682d37fb58d018d892f7846e7c";
const semanticIds = [
  "CASE", "CASE_SIDE_PANEL", "MOTHERBOARD", "CPU", "CPU_COOLER",
  "RAM_01", "RAM_02", "RAM_03", "RAM_04", "GPU", "M2_SSD",
  "STORAGE", "PSU", "CASE_FAN_01", "CASE_FAN_02", "CASE_FAN_03",
  "CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER",
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function parseGlbJson(buffer) {
  const magic = buffer.toString("utf8", 0, 4);
  if (magic !== "glTF") throw new Error(`Invalid GLB magic: ${magic}`);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.toString("utf8", 16, 20);
  if (jsonType !== "JSON") throw new Error(`Missing GLB JSON chunk: ${jsonType}`);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
}

const [canonical, built] = await Promise.all([readFile(canonicalUrl), readFile(builtUrl)]);
const canonicalHash = sha256(canonical);
const builtHash = sha256(built);

if (canonicalHash !== expectedHash) {
  throw new Error(`Canonical asset hash changed: expected ${expectedHash}, received ${canonicalHash}`);
}
if (builtHash !== canonicalHash) {
  throw new Error(`Built asset differs from canonical asset: ${builtHash} !== ${canonicalHash}`);
}

const json = parseGlbJson(built);
const named = (json.nodes ?? []).filter((node) => Boolean(node.name));
const names = new Set(named.map((node) => node.name));
const inventory = {
  rawGltfNodes: (json.nodes ?? []).length,
  namedLogicalNodes: named.length,
  semanticComponents: semanticIds.filter((id) => names.has(id)).length,
  meshes: (json.meshes ?? []).length,
  materials: (json.materials ?? []).length,
  animations: (json.animations ?? []).length,
};
const expected = {
  rawGltfNodes: 51,
  namedLogicalNodes: 29,
  semanticComponents: 19,
  meshes: 25,
  materials: 17,
  animations: 21,
};

for (const [key, value] of Object.entries(expected)) {
  if (inventory[key] !== value) {
    throw new Error(`Built inventory mismatch for ${key}: expected ${value}, received ${inventory[key]}`);
  }
}

console.log("DIST_ASSET_OK", fileURLToPath(builtUrl));
console.log("DIST_ASSET_SHA256", builtHash);
console.log("DIST_INVENTORY", JSON.stringify(inventory));
