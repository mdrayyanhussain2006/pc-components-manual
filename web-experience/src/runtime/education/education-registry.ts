import { SEMANTIC_COMPONENT_IDS, type SemanticComponentId } from "../core/types";
import type { StageId } from "../animation/types";
import { COMPONENT_EDUCATION_DATA } from "./content-registry";
import type { EducationContentModel, ComponentConnection, DisassemblyActionMetadata } from "./types";

export class EducationRegistry {
  readonly #data: Record<SemanticComponentId, EducationContentModel>;

  constructor(customData?: Record<SemanticComponentId, EducationContentModel>) {
    this.#data = customData ?? COMPONENT_EDUCATION_DATA;
  }

  /** Retrieve the educational model for a component. Throws if invalid ID. */
  get(id: SemanticComponentId): EducationContentModel {
    const entry = this.#data[id];
    if (!entry) {
      throw new Error(`EducationRegistry: No educational entry found for semantic component '${id}'`);
    }
    return entry;
  }

  /** Check if an educational entry exists for a component ID. */
  has(id: string): id is SemanticComponentId {
    return id in this.#data;
  }

  /** Retrieve all connections for a given component. */
  getConnections(id: SemanticComponentId): readonly ComponentConnection[] {
    return this.get(id).connections;
  }

  /** Retrieve all unique related component IDs for a given component. */
  getRelated(id: SemanticComponentId): readonly SemanticComponentId[] {
    return this.get(id).relatedComponents;
  }

  /** Retrieve the disassembly action metadata for a given component. */
  getDisassemblyMetadata(id: SemanticComponentId): DisassemblyActionMetadata {
    return this.get(id).disassembly;
  }

  /** Retrieve the primary disassembly stage for a given component. */
  getDisassemblyStage(id: SemanticComponentId): StageId | undefined {
    return this.get(id).disassembly.disassemblyStage;
  }

  /** Retrieve the early disconnect stage for cables (e.g. MOTHERBOARD_OUT). */
  getDisconnectStage(id: SemanticComponentId): StageId | undefined {
    return this.get(id).disassembly.disconnectStage;
  }

  /** Get all component IDs associated with a specific disassembly or disconnect stage. */
  getComponentsForStage(stageId: StageId): SemanticComponentId[] {
    const matched: SemanticComponentId[] = [];
    for (const id of SEMANTIC_COMPONENT_IDS) {
      const dis = this.#data[id]?.disassembly;
      if (dis?.disassemblyStage === stageId || dis?.disconnectStage === stageId) {
        matched.push(id);
      }
    }
    return matched;
  }

  /** List all 19 semantic component educational entries. */
  getAllEntries(): EducationContentModel[] {
    return SEMANTIC_COMPONENT_IDS.map((id) => this.get(id));
  }

  /** Validate registry completeness and relational integrity across all 19 components. */
  validateIntegrity(): {
    valid: boolean;
    missingIds: string[];
    invalidConnectionTargets: string[];
    invalidRelatedTargets: string[];
  } {
    const missingIds: string[] = [];
    const invalidConnectionTargets: string[] = [];
    const invalidRelatedTargets: string[] = [];

    for (const id of SEMANTIC_COMPONENT_IDS) {
      if (!this.has(id)) {
        missingIds.push(id);
        continue;
      }
      const entry = this.get(id);
      for (const conn of entry.connections) {
        if (!this.has(conn.target)) {
          invalidConnectionTargets.push(`${id} -> ${conn.target}`);
        }
      }
      for (const rel of entry.relatedComponents) {
        if (!this.has(rel)) {
          invalidRelatedTargets.push(`${id} -> ${rel}`);
        }
      }
    }

    return {
      valid: missingIds.length === 0 && invalidConnectionTargets.length === 0 && invalidRelatedTargets.length === 0,
      missingIds,
      invalidConnectionTargets,
      invalidRelatedTargets,
    };
  }
}
