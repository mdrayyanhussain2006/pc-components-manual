import {
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { disposeObjectTree } from "./scene-utils";

export class LightingRig {
  readonly #scene: Scene;
  readonly #group = new Group();
  readonly #environmentTarget: WebGLRenderTarget;
  readonly #ground: Mesh<PlaneGeometry, MeshStandardMaterial>;

  constructor(renderer: WebGLRenderer, scene: Scene, bounds: Box3) {
    this.#scene = scene;
    this.#group.name = "RUNTIME_LIGHTING";

    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const radius = Math.max(size.length() * 0.5, 0.25);

    const room = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    this.#environmentTarget = pmrem.fromScene(room, 0.04);
    pmrem.dispose();
    disposeObjectTree(room);

    scene.environment = this.#environmentTarget.texture;
    scene.environmentIntensity = 0.55;

    const hemisphere = new HemisphereLight(0xf7fbff, 0x66717d, 0.85);
    hemisphere.name = "RUNTIME_HEMISPHERE";
    this.#group.add(hemisphere);

    const key = new DirectionalLight(0xfffdf8, 2.6);
    key.name = "RUNTIME_KEY";
    key.position.copy(center).add(new Vector3(-2.4, 3.2, 2.8).multiplyScalar(radius));
    key.target.position.copy(center);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = radius * 0.15;
    key.shadow.camera.far = radius * 12;
    const shadowExtent = radius * 2.2;
    key.shadow.camera.left = -shadowExtent;
    key.shadow.camera.right = shadowExtent;
    key.shadow.camera.top = shadowExtent;
    key.shadow.camera.bottom = -shadowExtent;
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.015;
    this.#group.add(key, key.target);

    const fill = new DirectionalLight(0xdbeaff, 0.85);
    fill.name = "RUNTIME_FILL";
    fill.position.copy(center).add(new Vector3(-2.8, 1.1, -2.2).multiplyScalar(radius));
    fill.target.position.copy(center);
    this.#group.add(fill, fill.target);

    const rim = new DirectionalLight(0xffead4, 0.75);
    rim.name = "RUNTIME_RIM";
    rim.position.copy(center).add(new Vector3(2.4, 2.3, -2.6).multiplyScalar(radius));
    rim.target.position.copy(center);
    this.#group.add(rim, rim.target);

    const interior = new DirectionalLight(0xf4f8ff, 0.95);
    interior.name = "RUNTIME_INTERIOR_FILL";
    interior.position.copy(center).add(new Vector3(-2.6, 0.45, 0.35).multiplyScalar(radius));
    interior.target.position.copy(center).add(new Vector3(0, size.y * 0.08, 0));
    this.#group.add(interior, interior.target);

    const groundSize = radius * 12;
    this.#ground = new Mesh(
      new PlaneGeometry(groundSize, groundSize),
      new MeshStandardMaterial({
        color: 0xd9dce0,
        metalness: 0,
        roughness: 0.96,
      }),
    );
    this.#ground.name = "RUNTIME_GROUND";
    this.#ground.rotation.x = -Math.PI / 2;
    this.#ground.position.set(center.x, bounds.min.y - Math.max(size.y * 0.006, 0.001), center.z);
    this.#ground.receiveShadow = true;
    this.#group.add(this.#ground);

    scene.add(this.#group);
  }

  dispose(): void {
    this.#scene.remove(this.#group);
    this.#scene.environment = null;
    disposeObjectTree(this.#group);
    this.#environmentTarget.dispose();
  }
}
