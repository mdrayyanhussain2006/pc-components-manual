import {
  Box3,
  MathUtils,
  PerspectiveCamera,
  Sphere,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CameraSnapshot, CameraStateName } from "../core/types";

interface CameraPose {
  position: Vector3;
  target: Vector3;
}

interface CameraTransition {
  elapsed: number;
  duration: number;
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
  finalState: Exclude<CameraStateName, "transitioning">;
}

export interface CameraControllerOptions {
  camera: PerspectiveCamera;
  controls: OrbitControls;
  bounds: Box3;
  width: number;
  height: number;
  reducedMotion: boolean;
  onStateChange?: (state: CameraStateName) => void;
}

const HERO_DIRECTION = new Vector3(-1.2, 0.76, 1.48).normalize();
const OPEN_DIRECTION = new Vector3(-1.68, 0.38, 0.62).normalize();

interface FocusProfile {
  direction: Vector3;
  margin?: number;
}

const COMPONENT_FOCUS_PROFILES: Record<string, FocusProfile> = {
  GPU: { direction: new Vector3(-1.3, 0.45, 1.2).normalize(), margin: 1.2 },
  MOTHERBOARD: { direction: new Vector3(-1.7, 0.25, 0.6).normalize(), margin: 1.15 },
  CPU: { direction: new Vector3(-1.6, 0.35, 0.5).normalize(), margin: 1.35 },
  CPU_COOLER: { direction: new Vector3(-1.4, 0.5, 0.9).normalize(), margin: 1.25 },
  RAM_01: { direction: new Vector3(-1.2, 0.85, 0.6).normalize(), margin: 1.3 },
  RAM_02: { direction: new Vector3(-1.2, 0.85, 0.6).normalize(), margin: 1.3 },
  RAM_03: { direction: new Vector3(-1.2, 0.85, 0.6).normalize(), margin: 1.3 },
  RAM_04: { direction: new Vector3(-1.2, 0.85, 0.6).normalize(), margin: 1.3 },
  M2_SSD: { direction: new Vector3(-1.4, 0.7, 0.8).normalize(), margin: 1.4 },
  PSU: { direction: new Vector3(-1.5, -0.05, 1.1).normalize(), margin: 1.2 },
  STORAGE: { direction: new Vector3(-1.2, 0.2, 1.3).normalize(), margin: 1.25 },
  CASE_FAN_01: { direction: new Vector3(-1.5, 0.4, -0.2).normalize(), margin: 1.3 },
  CASE_FAN_02: { direction: new Vector3(0.5, 0.3, 1.8).normalize(), margin: 1.3 },
  CASE_FAN_03: { direction: new Vector3(0.5, 0.3, 1.8).normalize(), margin: 1.3 },
  CABLE_24PIN: { direction: new Vector3(-1.4, 0.3, 1.0).normalize(), margin: 1.3 },
  CABLE_CPU_POWER: { direction: new Vector3(-1.5, 0.6, 0.5).normalize(), margin: 1.3 },
  CABLE_GPU_POWER: { direction: new Vector3(-1.2, 0.3, 1.4).normalize(), margin: 1.3 },
  CASE_SIDE_PANEL: { direction: new Vector3(-1.68, 0.38, 0.62).normalize(), margin: 1.2 },
  CASE: { direction: HERO_DIRECTION.clone(), margin: 1.2 },
};

export class CameraController {
  readonly #camera: PerspectiveCamera;
  readonly #controls: OrbitControls;
  readonly #bounds: Box3;
  readonly #sphere: Sphere;
  readonly #size: Vector3;
  readonly #onStateChange?: (state: CameraStateName) => void;
  readonly #reducedMotion: boolean;
  #state: CameraStateName = "hero";
  #transition: CameraTransition | null = null;

  constructor(options: CameraControllerOptions) {
    this.#camera = options.camera;
    this.#controls = options.controls;
    this.#bounds = options.bounds.clone();
    this.#sphere = this.#bounds.getBoundingSphere(new Sphere());
    this.#size = this.#bounds.getSize(new Vector3());
    this.#onStateChange = options.onStateChange;
    this.#reducedMotion = options.reducedMotion;

    this.#camera.fov = 42;
    this.#camera.aspect = options.width / Math.max(1, options.height);
    this.#camera.near = Math.max(this.#sphere.radius / 80, 0.001);
    this.#camera.far = Math.max(this.#sphere.radius * 60, 20);
    this.#camera.updateProjectionMatrix();

    this.#controls.enableDamping = true;
    this.#controls.dampingFactor = 0.075;
    this.#controls.enablePan = true;
    this.#controls.screenSpacePanning = true;
    this.#controls.zoomToCursor = true;
    this.#controls.minDistance = this.#sphere.radius * 0.72;
    this.#controls.maxDistance = this.#sphere.radius * 7.5;
    this.#controls.minPolarAngle = MathUtils.degToRad(8);
    this.#controls.maxPolarAngle = MathUtils.degToRad(164);

    this.#controls.addEventListener("start", () => {
      if (!this.#transition) this.#setState("custom");
    });

    this.hero(true);
  }

  get state(): CameraStateName {
    return this.#state;
  }

  hero(immediate = false): void {
    this.#moveTo(this.#createPose("hero"), "hero", immediate);
  }

  open(immediate = false): void {
    this.#moveTo(this.#createPose("open"), "open", immediate);
  }

  reset(immediate = false): void {
    this.hero(immediate);
  }

  focusOn(bounds: Box3, componentId?: string, immediate = false): void {
    const sphere = bounds.getBoundingSphere(new Sphere());
    const target = sphere.center.clone();
    
    const profile = componentId ? COMPONENT_FOCUS_PROFILES[componentId] : undefined;
    const baseMargin = profile?.margin ?? 1.15;
    const margin = this.#camera.aspect < 0.75 ? baseMargin * 1.1 : baseMargin;
    
    const verticalFov = MathUtils.degToRad(this.#camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.#camera.aspect);
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const distance = Math.max((sphere.radius / Math.sin(limitingFov / 2)) * margin, this.#sphere.radius * 0.72);
    
    let focusDirection: Vector3;
    if (profile) {
      focusDirection = profile.direction.clone();
    } else {
      focusDirection = this.#camera.position.clone().sub(this.#controls.target).normalize();
      if (focusDirection.lengthSq() < 0.001) {
        focusDirection.copy(HERO_DIRECTION);
      }
    }
    
    const position = target.clone().addScaledVector(focusDirection, distance);
    this.#moveTo({ target, position }, "custom", immediate);
  }

  resize(width: number, height: number): void {
    this.#camera.aspect = width / Math.max(1, height);
    this.#camera.updateProjectionMatrix();
    if (this.#state === "hero") this.hero(true);
    if (this.#state === "open") this.open(true);
  }

  update(deltaSeconds: number): void {
    if (!this.#transition) return;
    const transition = this.#transition;
    transition.elapsed += deltaSeconds;
    const progress = Math.min(transition.elapsed / transition.duration, 1);
    const eased = progress * progress * (3 - 2 * progress);
    this.#camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    this.#controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
    this.#controls.update();

    if (progress >= 1) {
      this.#transition = null;
      this.#controls.enabled = true;
      this.#setState(transition.finalState);
    }
  }

  getSnapshot(): CameraSnapshot {
    return {
      state: this.#state,
      position: this.#camera.position.toArray(),
      target: this.#controls.target.toArray(),
      distance: this.#camera.position.distanceTo(this.#controls.target),
    };
  }

  #createPose(kind: "hero" | "open"): CameraPose {
    const target = this.#sphere.center.clone();
    target.y += this.#size.y * (kind === "hero" ? 0.035 : 0.08);
    const narrowViewport = this.#camera.aspect < 0.75;
    const margin = kind === "hero"
      ? narrowViewport ? 1.28 : 1.12
      : narrowViewport ? 1.14 : 0.9;
    const direction = kind === "hero" ? HERO_DIRECTION : OPEN_DIRECTION;
    const distance = this.#fitDistance(margin);
    return {
      target,
      position: target.clone().addScaledVector(direction, distance),
    };
  }

  #fitDistance(margin: number): number {
    const verticalFov = MathUtils.degToRad(this.#camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.#camera.aspect);
    const limitingFov = Math.min(verticalFov, horizontalFov);
    return (this.#sphere.radius / Math.sin(limitingFov / 2)) * margin;
  }

  #moveTo(
    pose: CameraPose,
    finalState: Exclude<CameraStateName, "transitioning">,
    immediate: boolean,
  ): void {
    this.#clearControlMomentum();
    if (immediate || this.#reducedMotion) {
      this.#transition = null;
      this.#controls.enabled = true;
      this.#camera.position.copy(pose.position);
      this.#controls.target.copy(pose.target);
      this.#controls.update();
      this.#setState(finalState);
      return;
    }

    this.#transition = {
      elapsed: 0,
      duration: 0.85,
      fromPosition: this.#camera.position.clone(),
      fromTarget: this.#controls.target.clone(),
      toPosition: pose.position,
      toTarget: pose.target,
      finalState,
    };
    this.#controls.enabled = false;
    this.#setState("transitioning");
  }

  #clearControlMomentum(): void {
    const dampingEnabled = this.#controls.enableDamping;
    this.#controls.enableDamping = false;
    this.#controls.update();
    this.#controls.enableDamping = dampingEnabled;
  }

  #setState(state: CameraStateName): void {
    this.#state = state;
    this.#onStateChange?.(state);
  }
}
