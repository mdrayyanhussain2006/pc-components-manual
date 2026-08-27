import { LoadingManager } from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { PC_ANATOMY_ASSET_URL } from "./asset-url";

export interface AssetLoadProgress {
  loaded: number;
  total: number;
  ratio: number | null;
}

export async function loadPcAnatomyAsset(
  onProgress?: (progress: AssetLoadProgress) => void,
): Promise<GLTF> {
  await MeshoptDecoder.ready;

  const manager = new LoadingManager();
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);

  return loader.loadAsync(PC_ANATOMY_ASSET_URL, (event) => {
    onProgress?.({
      loaded: event.loaded,
      total: event.total,
      ratio: event.total > 0 ? event.loaded / event.total : null,
    });
  });
}
