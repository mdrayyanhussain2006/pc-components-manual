import {
  Raycaster,
  Vector2,
  Vector3,
  Mesh,
  MeshStandardMaterial,
  Box3,
  type Object3D,
  type Material,
  type Camera,
} from "three";
import { SEMANTIC_COMPONENT_IDS, type SemanticComponentId } from "../core/types";

export interface InteractionSnapshot {
  hovered: SemanticComponentId | null;
  selected: SemanticComponentId | null;
}

export type InteractionSelectHandler = (componentId: SemanticComponentId | null) => void;

interface MeshMaterials {
  original: Material | Material[];
  hover: Material | Material[];
  selected: Material | Material[];
}

export interface SemanticComponentDebugInfo {
  componentId: SemanticComponentId;
  nodeName: string;
  meshCount: number;
  meshNames: string[];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  } | null;
  hasValidBounds: boolean;
}

export type SemanticRegistrySnapshot = Record<SemanticComponentId, SemanticComponentDebugInfo>;

export interface MeshMaterialDebugInfo {
  meshName: string;
  originalMaterialUuid: string | string[];
  currentMaterialUuid: string | string[];
  isCloned: boolean;
  emissiveHex: number | number[];
  emissiveIntensity: number | number[];
}

export interface ComponentMaterialDebugInfo {
  componentId: SemanticComponentId;
  meshes: MeshMaterialDebugInfo[];
}

export class InteractionController {
  readonly #canvas: HTMLCanvasElement;
  readonly #camera: Camera;
  readonly #sceneRoot: Object3D;

  readonly #raycaster = new Raycaster();
  readonly #pointer = new Vector2();
  
  #hoveredComponent: SemanticComponentId | null = null;
  #selectedComponent: SemanticComponentId | null = null;
  
  #meshStates = new Map<Mesh, MeshMaterials>();
  #componentMeshes = new Map<SemanticComponentId, Mesh[]>();
  #componentNodes = new Map<SemanticComponentId, Object3D>();
  #meshToComponent = new Map<Mesh, SemanticComponentId>();
  
  #onSelect: InteractionSelectHandler | null = null;

  // Drag vs Click discrimination
  #pointerDownEvent: PointerEvent | null = null;
  #pointerDownPos = new Vector2();
  
  #disposed = false;

  constructor(canvas: HTMLCanvasElement, camera: Camera, sceneRoot: Object3D) {
    this.#canvas = canvas;
    this.#camera = camera;
    this.#sceneRoot = sceneRoot;

    this.#buildRegistry();
    this.#attachEvents();
  }

  set onSelect(handler: InteractionSelectHandler | null) {
    this.#onSelect = handler;
  }

  get selectedComponent(): SemanticComponentId | null {
    return this.#selectedComponent;
  }

  get hoveredComponent(): SemanticComponentId | null {
    return this.#hoveredComponent;
  }

  getSnapshot(): InteractionSnapshot {
    return {
      hovered: this.#hoveredComponent,
      selected: this.#selectedComponent,
    };
  }

  select(id: SemanticComponentId | null): void {
    if (this.#selectedComponent === id) return;
    
    // Clear old selection visually
    if (this.#selectedComponent) {
      this.#applyMaterialState(this.#selectedComponent, "none");
    }
    
    this.#selectedComponent = id;
    
    // Apply new visual state (either select, or fallback to hover if it's currently hovered)
    if (this.#selectedComponent) {
      this.#applyMaterialState(this.#selectedComponent, "selected");
    }
    
    // Re-apply hover if the hovered item just got deselected
    if (this.#hoveredComponent && this.#hoveredComponent !== this.#selectedComponent) {
      this.#applyMaterialState(this.#hoveredComponent, "hover");
    }

    if (this.#onSelect) {
      this.#onSelect(this.#selectedComponent);
    }
  }

  clear(): void {
    this.select(null);
  }

  getComponentBounds(id: SemanticComponentId): import("three").Box3 | null {
    const meshes = this.#componentMeshes.get(id);
    if (!meshes || meshes.length === 0) return null;
    
    const box = new Box3();
    for (const mesh of meshes) {
      // Temporarily update world matrix to get accurate bounding box
      mesh.updateWorldMatrix(true, false);
      
      const meshBox = new Box3().setFromObject(mesh);
      box.union(meshBox);
    }
    
    return box.isEmpty() ? null : box;
  }

  getSemanticRegistrySnapshot(): SemanticRegistrySnapshot {
    const snapshot: Partial<SemanticRegistrySnapshot> = {};

    for (const id of SEMANTIC_COMPONENT_IDS) {
      const node = this.#componentNodes.get(id);
      const meshes = this.#componentMeshes.get(id) ?? [];
      const bounds = this.getComponentBounds(id);

      let boundsData: SemanticComponentDebugInfo["bounds"] = null;
      let hasValidBounds = false;

      if (bounds && !bounds.isEmpty()) {
        const min: [number, number, number] = [
          Number(bounds.min.x.toFixed(4)),
          Number(bounds.min.y.toFixed(4)),
          Number(bounds.min.z.toFixed(4)),
        ];
        const max: [number, number, number] = [
          Number(bounds.max.x.toFixed(4)),
          Number(bounds.max.y.toFixed(4)),
          Number(bounds.max.z.toFixed(4)),
        ];
        const size: [number, number, number] = [
          Number((bounds.max.x - bounds.min.x).toFixed(4)),
          Number((bounds.max.y - bounds.min.y).toFixed(4)),
          Number((bounds.max.z - bounds.min.z).toFixed(4)),
        ];
        boundsData = { min, max, size };
        hasValidBounds =
          isFinite(min[0]) &&
          isFinite(max[0]) &&
          (size[0] > 0 || size[1] > 0 || size[2] > 0);
      }

      snapshot[id] = {
        componentId: id,
        nodeName: node?.name ?? id,
        meshCount: meshes.length,
        meshNames: meshes.map((m) => m.name || "unnamed_mesh"),
        bounds: boundsData,
        hasValidBounds,
      };
    }

    return snapshot as SemanticRegistrySnapshot;
  }

  getMaterialDebugInfo(componentId: SemanticComponentId): ComponentMaterialDebugInfo | null {
    const meshes = this.#componentMeshes.get(componentId);
    if (!meshes) return null;

    const meshInfos: MeshMaterialDebugInfo[] = meshes.map((mesh) => {
      const state = this.#meshStates.get(mesh);
      const currentMat = mesh.material;
      const originalMat = state?.original ?? currentMat;

      const getUuids = (mat: Material | Material[]): string | string[] => {
        return Array.isArray(mat) ? mat.map((m) => m.uuid) : mat.uuid;
      };

      const getEmissiveHex = (mat: Material | Material[]): number | number[] => {
        if (Array.isArray(mat)) {
          return mat.map((m) => ("emissive" in m && (m as any).emissive?.getHex ? (m as any).emissive.getHex() : 0));
        }
        return "emissive" in mat && (mat as any).emissive?.getHex ? (mat as any).emissive.getHex() : 0;
      };

      const getEmissiveIntensity = (mat: Material | Material[]): number | number[] => {
        if (Array.isArray(mat)) {
          return mat.map((m) => ("emissiveIntensity" in m ? Number((m as any).emissiveIntensity) : 0));
        }
        return "emissiveIntensity" in mat ? Number((mat as any).emissiveIntensity) : 0;
      };

      const isCloned = Array.isArray(currentMat)
        ? (Array.isArray(originalMat) && currentMat.some((m, idx) => m !== originalMat[idx]))
        : currentMat !== originalMat;

      return {
        meshName: mesh.name || "unnamed_mesh",
        originalMaterialUuid: getUuids(originalMat),
        currentMaterialUuid: getUuids(currentMat),
        isCloned,
        emissiveHex: getEmissiveHex(currentMat),
        emissiveIntensity: getEmissiveIntensity(currentMat),
      };
    });

    return {
      componentId,
      meshes: meshInfos,
    };
  }

  resolveMeshToSemanticId(meshOrNodeName: Mesh | Object3D | string): SemanticComponentId | null {
    let targetMesh: Mesh | null = null;
    if (typeof meshOrNodeName === "string") {
      this.#sceneRoot.traverse((child) => {
        if (child.name === meshOrNodeName && child instanceof Mesh) {
          targetMesh = child;
        }
      });
      if (!targetMesh) {
        if (SEMANTIC_COMPONENT_IDS.includes(meshOrNodeName as SemanticComponentId)) {
          return meshOrNodeName as SemanticComponentId;
        }
      }
    } else if (meshOrNodeName instanceof Mesh) {
      targetMesh = meshOrNodeName;
    }

    if (!targetMesh) return null;
    return this.#meshToComponent.get(targetMesh) ?? null;
  }

  getComponentRaycastPoint(componentId: SemanticComponentId): { x: number; y: number } | null {
    const meshes = this.#componentMeshes.get(componentId);
    if (!meshes || meshes.length === 0) return null;

    const bounds = this.getComponentBounds(componentId);
    if (!bounds) return null;

    const size = new Vector3(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    );

    const pointsToTest: Vector3[] = [bounds.getCenter(new Vector3())];

    for (let u = 0.1; u <= 0.9; u += 0.2) {
      for (let v = 0.1; v <= 0.9; v += 0.2) {
        pointsToTest.push(
          new Vector3(
            bounds.min.x + u * size.x,
            bounds.min.y + v * size.y,
            bounds.max.z,
          ),
        );
        pointsToTest.push(
          new Vector3(
            bounds.min.x + u * size.x,
            bounds.max.y,
            bounds.min.z + v * size.z,
          ),
        );
      }
    }

    const rect = this.#canvas.getBoundingClientRect();
    const pointer = new Vector2();
    const interactableMeshes = Array.from(this.#meshToComponent.keys());

    for (const pt of pointsToTest) {
      const projected = pt.clone().project(this.#camera);
      // If outside NDC view frustum, skip
      if (Math.abs(projected.x) > 0.95 || Math.abs(projected.y) > 0.95 || projected.z < 0 || projected.z > 1) {
        continue;
      }
      pointer.x = projected.x;
      pointer.y = projected.y;

      this.#raycaster.setFromCamera(pointer, this.#camera);
      const hits = this.#raycaster.intersectObjects(interactableMeshes, false);
      if (hits.length > 0) {
        const hitMesh = hits[0]?.object as Mesh;
        if (this.#meshToComponent.get(hitMesh) === componentId) {
          return {
            x: ((projected.x + 1) / 2) * rect.width + rect.left,
            y: ((-projected.y + 1) / 2) * rect.height + rect.top,
          };
        }
      }
    }

    // Fallback to projected center
    const center = bounds.getCenter(new Vector3()).project(this.#camera);
    return {
      x: ((center.x + 1) / 2) * rect.width + rect.left,
      y: ((-center.y + 1) / 2) * rect.height + rect.top,
    };
  }
  
  hover(id: SemanticComponentId | null): void {
    if (this.#hoveredComponent === id) return;
    
    if (this.#hoveredComponent && this.#hoveredComponent !== this.#selectedComponent) {
       this.#applyMaterialState(this.#hoveredComponent, "none");
    }
    
    this.#hoveredComponent = id;
    this.#canvas.style.cursor = id ? "pointer" : "default";
    
    if (this.#hoveredComponent && this.#hoveredComponent !== this.#selectedComponent) {
      this.#applyMaterialState(this.#hoveredComponent, "hover");
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#detachEvents();
    
    // Clean up cloned materials
    for (const [_, state] of this.#meshStates) {
      this.#disposeMaterial(state.hover);
      this.#disposeMaterial(state.selected);
    }
    this.#meshStates.clear();
    this.#componentMeshes.clear();
    this.#componentNodes.clear();
    this.#meshToComponent.clear();
  }

  #buildRegistry(): void {
    const validIds = new Set<string>(SEMANTIC_COMPONENT_IDS);

    // 1. Record all semantic root nodes
    this.#sceneRoot.traverse((node) => {
      if (node.name && validIds.has(node.name)) {
        const componentId = node.name as SemanticComponentId;
        this.#componentNodes.set(componentId, node);
      }
    });

    // 2. Assign each mesh to its nearest semantic ancestor
    this.#sceneRoot.traverse((object) => {
      if (object instanceof Mesh) {
        let curr: Object3D | null = object;
        let semanticAncestor: SemanticComponentId | null = null;

        while (curr && curr !== this.#sceneRoot) {
          if (curr.name && validIds.has(curr.name)) {
            semanticAncestor = curr.name as SemanticComponentId;
            break;
          }
          curr = curr.parent;
        }

        if (semanticAncestor) {
          this.#meshToComponent.set(object, semanticAncestor);
          const list = this.#componentMeshes.get(semanticAncestor) ?? [];
          list.push(object);
          this.#componentMeshes.set(semanticAncestor, list);
          this.#meshStates.set(object, this.#createMeshMaterials(object));
        }
      }
    });
  }

  #createMeshMaterials(mesh: Mesh): MeshMaterials {
    const cloneMaterial = (mat: Material, emissiveHex: number) => {
      const clone = mat.clone();
      if (clone instanceof MeshStandardMaterial) {
        clone.emissive.setHex(emissiveHex);
        clone.emissiveIntensity = 0.5;
      }
      return clone;
    };

    const createVariant = (original: Material | Material[], hex: number) => {
      if (Array.isArray(original)) {
        return original.map(m => cloneMaterial(m, hex));
      }
      return cloneMaterial(original, hex);
    };

    return {
      original: mesh.material,
      hover: createVariant(mesh.material, 0x333333),
      selected: createVariant(mesh.material, 0x666666),
    };
  }

  #disposeMaterial(mat: Material | Material[]): void {
    if (Array.isArray(mat)) {
      mat.forEach(m => m.dispose());
    } else {
      mat.dispose();
    }
  }

  #applyMaterialState(id: SemanticComponentId, state: "none" | "hover" | "selected"): void {
    const meshes = this.#componentMeshes.get(id);
    if (!meshes) return;

    for (const mesh of meshes) {
      const materials = this.#meshStates.get(mesh);
      if (!materials) continue;

      if (state === "selected") {
        mesh.material = materials.selected;
      } else if (state === "hover") {
        mesh.material = materials.hover;
      } else {
        mesh.material = materials.original;
      }
    }
  }

  #attachEvents(): void {
    this.#canvas.addEventListener("pointerdown", this.#onPointerDown);
    this.#canvas.addEventListener("pointerup", this.#onPointerUp);
    this.#canvas.addEventListener("pointermove", this.#onPointerMove);
    this.#canvas.addEventListener("pointerleave", this.#onPointerLeave);
  }

  #detachEvents(): void {
    this.#canvas.removeEventListener("pointerdown", this.#onPointerDown);
    this.#canvas.removeEventListener("pointerup", this.#onPointerUp);
    this.#canvas.removeEventListener("pointermove", this.#onPointerMove);
    this.#canvas.removeEventListener("pointerleave", this.#onPointerLeave);
  }

  readonly #onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // Only left click
    this.#pointerDownEvent = e;
    this.#pointerDownPos.set(e.clientX, e.clientY);
  };

  readonly #onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 0 || !this.#pointerDownEvent) return;
    
    // Drag vs Click discrimination (threshold: 5 pixels or 200ms)
    const dx = e.clientX - this.#pointerDownPos.x;
    const dy = e.clientY - this.#pointerDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = e.timeStamp - this.#pointerDownEvent.timeStamp;
    
    this.#pointerDownEvent = null;

    if (dist < 5 && dt < 300) {
      // It's a click
      this.#updatePointer(e);
      const hit = this.#raycast();
      if (hit) {
        // Toggle selection
        if (this.#selectedComponent === hit) {
          this.select(null);
        } else {
          this.select(hit);
        }
      } else {
        this.select(null);
      }
    }
  };

  readonly #onPointerMove = (e: PointerEvent): void => {
    this.#updatePointer(e);
    const hit = this.#raycast();
    this.hover(hit);
  };

  readonly #onPointerLeave = (): void => {
    this.hover(null);
    this.#pointerDownEvent = null;
  };

  #updatePointer(e: PointerEvent): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.#pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  #raycast(): SemanticComponentId | null {
    this.#raycaster.setFromCamera(this.#pointer, this.#camera);

    const interactableMeshes = Array.from(this.#meshToComponent.keys());
    const intersects = this.#raycaster.intersectObjects(interactableMeshes, false);
    if (intersects.length === 0) return null;

    const firstHit = intersects[0];
    if (!firstHit) return null;
    const hitMesh = firstHit.object as Mesh;

    return this.#meshToComponent.get(hitMesh) ?? null;
  }
}
