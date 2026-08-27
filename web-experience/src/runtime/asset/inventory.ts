import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SEMANTIC_COMPONENT_IDS, type AssetInventory } from "../core/types";

const EXPECTED_INVENTORY: AssetInventory = {
  rawGltfNodes: 51,
  namedLogicalNodes: 29,
  semanticComponents: 19,
  meshes: 25,
  materials: 17,
  animations: 21,
};

interface GltfJsonNode {
  name?: string;
}

interface GltfParserJson {
  nodes?: GltfJsonNode[];
  meshes?: unknown[];
  materials?: unknown[];
  animations?: unknown[];
}

export class AssetInventoryError extends Error {
  readonly inventory: AssetInventory;
  readonly discrepancies: string[];

  constructor(inventory: AssetInventory, discrepancies: string[]) {
    super(`PC anatomy asset contract failed: ${discrepancies.join("; ")}`);
    this.name = "AssetInventoryError";
    this.inventory = inventory;
    this.discrepancies = discrepancies;
  }
}

export function validateAssetInventory(gltf: GLTF): AssetInventory {
  const json = gltf.parser.json as GltfParserJson;
  const nodes = json.nodes ?? [];
  const namedNodes = nodes
    .map((node) => node.name?.trim())
    .filter((name): name is string => Boolean(name));
  const namedNodeSet = new Set(namedNodes);
  const presentSemanticIds = SEMANTIC_COMPONENT_IDS.filter((id) => namedNodeSet.has(id));

  const inventory: AssetInventory = {
    rawGltfNodes: nodes.length,
    namedLogicalNodes: namedNodes.length,
    semanticComponents: presentSemanticIds.length,
    meshes: (json.meshes ?? []).length,
    materials: (json.materials ?? []).length,
    animations: gltf.animations.length,
  };

  const discrepancies: string[] = [];
  for (const [key, expected] of Object.entries(EXPECTED_INVENTORY) as [keyof AssetInventory, number][]) {
    const actual = inventory[key];
    if (actual !== expected) {
      discrepancies.push(`${key}: expected ${expected}, received ${actual}`);
    }
  }

  const missingSemanticIds = SEMANTIC_COMPONENT_IDS.filter((id) => !namedNodeSet.has(id));
  if (missingSemanticIds.length > 0) {
    discrepancies.push(`missing semantic components: ${missingSemanticIds.join(", ")}`);
  }

  const duplicateNames = namedNodes.filter((name, index) => namedNodes.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    discrepancies.push(`duplicate named logical nodes: ${[...new Set(duplicateNames)].join(", ")}`);
  }

  if (discrepancies.length > 0) {
    throw new AssetInventoryError(inventory, discrepancies);
  }

  return inventory;
}
