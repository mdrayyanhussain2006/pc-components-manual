import {
  Color,
  Material,
  Object3D,
  Scene,
  Texture,
  type BufferGeometry,
} from "three";

export function createExperienceScene(): Scene {
  const scene = new Scene();
  scene.background = new Color(0xd4d8dd);
  return scene;
}

export function disposeObjectTree(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    const candidate = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    if (candidate.geometry) geometries.add(candidate.geometry);
    const objectMaterials = Array.isArray(candidate.material)
      ? candidate.material
      : candidate.material
        ? [candidate.material]
        : [];
    for (const material of objectMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value);
      }
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
