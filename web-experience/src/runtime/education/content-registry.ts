import type { SemanticComponentId } from "../core/types";
import type { EducationContentModel, ComponentConnection } from "./types";

/** Base educational template for DDR system memory modules (RAM_01 through RAM_04). */
function createRamEntry(id: SemanticComponentId, slotIndex: number): EducationContentModel {
  return {
    id,
    displayName: `Memory Module (RAM Slot ${slotIndex})`,
    category: "memory",
    shortDescription: "High-speed volatile memory providing immediate workspace for the operating system and active applications.",
    purpose: "Holds active program code, execution stacks, and runtime data buffers with high-bandwidth, low-latency access directly from the CPU memory controller.",
    connections: [
      {
        target: "MOTHERBOARD",
        type: "mounts_on",
        description: `Latches into motherboard DIMM slot ${slotIndex} with dual retention clips.`,
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (RAM_OUT removal)"],
      },
      {
        target: "CPU",
        type: "communicates_with",
        description: "Direct memory bus trace connection to integrated memory controller (IMC).",
        status: "review_required",
        sourceRefs: ["hardware_architecture_standard"],
      },
    ],
    keyLearningPoints: [
      "Volatile storage: contents clear when system power is disconnected.",
      "Populating paired slots enables multi-channel memory bandwidth.",
      "Extracted sequentially in the RAM_OUT stage after releasing slot retention clips.",
    ],
    relatedComponents: ["MOTHERBOARD", "CPU"],
    disassembly: {
      actionType: "eject_sequential",
      disassemblyStage: "RAM_OUT",
      mechanicalDescription: `Ejects outward from DIMM slot ${slotIndex} sequentially along the -X axis during RAM_OUT.`,
      sourceRefs: ["build/disassembly_manifest.json", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (RAM_01-04 sequential ejection)",
      "build/animation_stages.json (RAM_OUT stage)",
      "ASSET_CONTRACT.md",
    ],
    instanceMetadata: {
      index: slotIndex,
      total: 4,
      slotLabel: `DIMM_${slotIndex}`,
    },
  };
}

/** Complete educational registry entries for all 19 semantic components. */
export const COMPONENT_EDUCATION_DATA: Record<SemanticComponentId, EducationContentModel> = {
  CASE: {
    id: "CASE",
    displayName: "Computer Chassis (Case)",
    category: "chassis",
    shortDescription: "Structural enclosure that mounts internal hardware, establishes airflow channels, and shields electromagnetic interference.",
    purpose: "Provides rigid mounting points, standoff screw posts to prevent PCB electrical shorts, drive trays, and isolated thermal compartments.",
    connections: [
      {
        target: "CASE_SIDE_PANEL",
        type: "enclosed_by",
        description: "Sealed along side opening via thumbscrew/sliding rail mounts.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json"],
      },
      {
        target: "MOTHERBOARD",
        type: "mounts_on",
        description: "Anchors motherboard via elevated brass standoff posts to prevent short circuits.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (MOTHERBOARD_OUT standoff lift)"],
      },
      {
        target: "PSU",
        type: "encloses",
        description: "Houses power supply unit in isolated lower floor tunnel with rear mounting flange.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (PSU_OUT)"],
      },
      {
        target: "CASE_FAN_01",
        type: "mounts_on",
        description: "Mounts front upper intake fan to front chassis bracket.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (SECONDARY_OUT)"],
      },
      {
        target: "CASE_FAN_02",
        type: "mounts_on",
        description: "Mounts front lower intake fan to front chassis bracket.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (SECONDARY_OUT)"],
      },
      {
        target: "CASE_FAN_03",
        type: "mounts_on",
        description: "Mounts rear exhaust fan adjacent to the I/O shield and CPU area.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (SECONDARY_OUT)"],
      },
    ],
    keyLearningPoints: [
      "Standoff isolation is critical: direct contact between case metal and motherboard solder points causes fatal electrical shorts.",
      "Front-to-back chassis tunnel geometry creates directed airflow pressure.",
      "In the 3D model, FINAL_EXPLODE demonstrates the full exploded perspective of all chassis-mounted components.",
    ],
    relatedComponents: ["CASE_SIDE_PANEL", "MOTHERBOARD", "PSU", "CASE_FAN_01", "CASE_FAN_02", "CASE_FAN_03"],
    disassembly: {
      actionType: "explode_presentation",
      disassemblyStage: "FINAL_EXPLODE",
      mechanicalDescription: "Anchors the presentation frame while all modular parts separate outward along their respective extraction axes.",
      sourceRefs: ["build/disassembly_manifest.json", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (CASE presentation/FINAL_EXPLODE rules)",
      "build/animation_stages.json",
      "ASSET_CONTRACT.md",
    ],
  },

  CASE_SIDE_PANEL: {
    id: "CASE_SIDE_PANEL",
    displayName: "Chassis Side Panel",
    category: "chassis",
    shortDescription: "Removable side panel that seals the internal airflow chamber and provides visual access.",
    purpose: "Protects internal components from foreign debris, physical contact, and maintains internal static pressure necessary for directed fan cooling.",
    connections: [
      {
        target: "CASE",
        type: "mounts_on",
        description: "Fastened to case rear frame with thumbscrews and aligned into lower frame guide rails.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (OPEN_CASE)"],
      },
    ],
    keyLearningPoints: [
      "Must be removed before any internal component service or disassembly can occur.",
      "Disengages by sliding rearward off thumbscrews before lifting away and setting aside.",
      "Operating a system with the side panel removed disrupts designed positive pressure and accumulates dust.",
    ],
    relatedComponents: ["CASE"],
    disassembly: {
      actionType: "panel_open",
      disassemblyStage: "OPEN_CASE",
      mechanicalDescription: "Slides rearward off thumbscrews, lifts away from the chassis, and parks aside clear of the main extraction corridor.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.2)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (OPEN_CASE stage, REV 3.2 offsets)",
      "build/animation_stages.json",
      "ASSET_CONTRACT.md",
    ],
  },

  MOTHERBOARD: {
    id: "MOTHERBOARD",
    displayName: "Motherboard (Mainboard)",
    category: "chassis",
    shortDescription: "The central printed circuit board connecting the processor, memory, storage, graphics card, and power distribution.",
    purpose: "Routes electrical power, provides high-speed PCIe/memory buses, hosts the BIOS/firmware ROM, and orchestrates interconnect signal timing.",
    connections: [
      {
        target: "CPU",
        type: "mounts_on",
        description: "Hosts CPU inside the central processor socket with locking retention bracket.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json"],
      },
      {
        target: "GPU",
        type: "connects_to",
        description: "Primary PCIe x16 expansion slot with rear retention latch.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.1 board rider rule)"],
      },
      {
        target: "RAM_01",
        type: "mounts_on",
        description: "DIMM slot 1 with dual clip retention.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json"],
      },
      {
        target: "M2_SSD",
        type: "connects_to",
        description: "M.2 Key-M PCIe NVMe slot with elevated standoff post.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json"],
      },
      {
        target: "CABLE_24PIN",
        type: "receives_power",
        description: "Main 24-pin ATX power receptacle delivering +12V, +5V, +3.3V rails.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4 cable sub-sequence)"],
      },
      {
        target: "CABLE_CPU_POWER",
        type: "receives_power",
        description: "8-pin EPS 12V receptacle delivering dedicated current to CPU VRM.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
      {
        target: "CASE",
        type: "mounts_on",
        description: "Fastened onto elevated chassis standoff screw posts.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json"],
      },
    ],
    keyLearningPoints: [
      "Board Rider Architecture: Motherboard extracts carrying CPU, cooler, RAM, GPU, and M.2 SSD riding together.",
      "Power cables must disconnect cleanly before the board lifts 12mm off standoffs to avoid mechanical snagging.",
      "Rear edge clears rear exhaust fan boundary with an authored swing during extraction.",
    ],
    relatedComponents: ["CPU", "CPU_COOLER", "GPU", "RAM_01", "RAM_02", "RAM_03", "RAM_04", "M2_SSD", "CABLE_24PIN", "CABLE_CPU_POWER"],
    disassembly: {
      actionType: "extract_with_riders",
      disassemblyStage: "MOTHERBOARD_OUT",
      mechanicalDescription: "Cables disconnect first; board lifts 12mm off standoffs, swings clear of rear exhaust fan, and slides outward carrying all rider components.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.2, 3.3, 3.4)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (MOTHERBOARD_OUT, rider list, cable sequence)",
      "build/animation_stages.json",
      "ANIMATION_CONTRACT.md",
    ],
  },

  CPU: {
    id: "CPU",
    displayName: "Central Processing Unit (CPU)",
    category: "processing",
    shortDescription: "The primary silicon microprocessor that interprets and executes core computer instructions.",
    purpose: "Performs arithmetic, logic, and control operations, hosting integrated caches and memory controllers responsible for system calculations.",
    connections: [
      {
        target: "MOTHERBOARD",
        type: "mounts_on",
        description: "Seats inside motherboard LGA socket pins under a hinged retention load plate.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (CPU_OUT)"],
      },
      {
        target: "CPU_COOLER",
        type: "cooled_by",
        description: "Thermal integrated heat spreader (IHS) mates directly with heatsink copper base plate.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (CPU_COOLER_OUT precedes CPU_OUT)"],
      },
    ],
    keyLearningPoints: [
      "Strict ordering rule: CPU Cooler must be unmounted and settled before the CPU socket lever can release.",
      "LGA socket pins are fragile: extraction requires a straight, vertical lift without tilting.",
      "Thermal paste bridges microscopic air gaps between the CPU heat spreader and cooler base.",
    ],
    relatedComponents: ["CPU_COOLER", "MOTHERBOARD"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "CPU_OUT",
      mechanicalDescription: "Lifts vertically out of the motherboard socket along the -X axis after the retention bracket is disengaged.",
      sourceRefs: ["build/disassembly_manifest.json", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (CPU_OUT rules, ordering constraint)",
      "build/animation_stages.json",
      "ANIMATION_CONTRACT.md",
    ],
  },

  CPU_COOLER: {
    id: "CPU_COOLER",
    displayName: "CPU Cooler (Heatsink & Fan)",
    category: "cooling",
    shortDescription: "Thermal dissipation assembly comprising a finned aluminum/copper heatsink and active cooling fan.",
    purpose: "Draws concentrated heat away from the CPU silicon die via conductive heat pipes and dissipates it into the chassis airflow stream to prevent thermal throttling.",
    connections: [
      {
        target: "CPU",
        type: "cools",
        description: "Direct contact with CPU integrated heat spreader via thermal compound.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json"],
      },
      {
        target: "MOTHERBOARD",
        type: "mounts_on",
        description: "Bolts into motherboard socket mounting backplate and connects to 4-pin PWM CPU_FAN header.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (CPU_COOLER_OUT)"],
      },
    ],
    keyLearningPoints: [
      "Order requirement: CPU cooler must be fully extracted before CPU retention arm can open.",
      "Without active cooling, modern high-density CPUs reach thermal threshold limits within seconds.",
      "4-pin PWM connector dynamically modulates fan RPM according to CPU temperature sensor readings.",
    ],
    relatedComponents: ["CPU", "MOTHERBOARD"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "CPU_COOLER_OUT",
      mechanicalDescription: "Lifts outward along the -X axis away from the CPU socket and settles before CPU extraction commences.",
      sourceRefs: ["build/disassembly_manifest.json", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (CPU_COOLER_OUT, settle rule)",
      "build/animation_stages.json",
      "ANIMATION_CONTRACT.md",
    ],
  },

  RAM_01: createRamEntry("RAM_01", 1),
  RAM_02: createRamEntry("RAM_02", 2),
  RAM_03: createRamEntry("RAM_03", 3),
  RAM_04: createRamEntry("RAM_04", 4),

  GPU: {
    id: "GPU",
    displayName: "Graphics Processing Unit (GPU / Video Card)",
    category: "graphics",
    shortDescription: "Dedicated expansion card engineered for massively parallel compute, 3D graphics rendering, and video processing.",
    purpose: "Renders visual output, executes vertex/fragment shaders, computes ray tracing geometry, and outputs video signals to external display monitors.",
    connections: [
      {
        target: "MOTHERBOARD",
        type: "connects_to",
        description: "Plugs into primary PCIe x16 slot, secured with rear retention clip.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.1)"],
      },
      {
        target: "CABLE_GPU_POWER",
        type: "receives_power",
        description: "8-pin PCIe auxiliary power connector delivering dedicated 12V power from PSU.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
    ],
    keyLearningPoints: [
      "Board Rider Behavior: GPU rides the extracted motherboard because its footprint intersects the board extraction corridor.",
      "Auxiliary Power: PCIe slots provide up to 75W; dedicated 8-pin power cables supply supplemental current.",
      "Disengages from the parked motherboard's PCIe slot during the GPU_OUT animation stage.",
    ],
    relatedComponents: ["MOTHERBOARD", "CABLE_GPU_POWER"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "GPU_OUT",
      mechanicalDescription: "Disengages 10mm from the parked board PCIe slot latch, then slides outward 160mm along the -X axis.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.1)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (REV 3.1 board rider rule & GPU_OUT primitives)",
      "build/animation_stages.json",
      "ASSET_CONTRACT.md",
    ],
  },

  M2_SSD: {
    id: "M2_SSD",
    displayName: "M.2 NVMe Solid-State Drive",
    category: "storage",
    shortDescription: "Ultra-compact high-speed flash storage drive communicating over PCIe lanes via the NVMe protocol.",
    purpose: "Provides high-throughput, low-latency non-volatile storage for operating system boots, game loading, and rapid data transfers.",
    connections: [
      {
        target: "MOTHERBOARD",
        type: "connects_to",
        description: "Inserts into M.2 Key-M slot and fastens down onto an elevated standoff post.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (STORAGE_OUT)"],
      },
    ],
    keyLearningPoints: [
      "Mechanical removal: Loosening the retention screw causes the drive to pivot upward at a slight angle before sliding out.",
      "Communicates directly with the CPU or chipset over PCIe lanes without SATA interface overhead.",
      "Rides the motherboard during MOTHERBOARD_OUT and extracts during the STORAGE_OUT stage.",
    ],
    relatedComponents: ["MOTHERBOARD"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "STORAGE_OUT",
      mechanicalDescription: "Pivots up about its connector edge after retention release, disengages from the socket, and translates clear.",
      sourceRefs: ["build/disassembly_manifest.json (pivot primitive)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (M2_SSD pivot/translate removal)",
      "build/animation_stages.json",
      "ASSET_CONTRACT.md",
    ],
  },

  STORAGE: {
    id: "STORAGE",
    displayName: "Storage Drive Sled (2.5\" / 3.5\" Drive)",
    category: "storage",
    shortDescription: "Secondary mass storage drive mounted in a dedicated chassis bay or drive sled.",
    purpose: "Stores large-capacity user data, backup archives, and application media libraries over standard SATA interfaces.",
    connections: [
      {
        target: "CASE",
        type: "mounts_on",
        description: "Mounted on chassis shroud drive sled bracket with tool-less or screw-fastened rails.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (STORAGE_OUT)"],
      },
    ],
    keyLearningPoints: [
      "Sled extraction: Slides forward out of the sled guide rails to clear front fan frames before vertical lift.",
      "Provides scalable mass capacity at lower cost per gigabyte compared to primary NVMe drives.",
      "Extracted concurrently with the M.2 SSD in the STORAGE_OUT animation stage.",
    ],
    relatedComponents: ["CASE", "M2_SSD"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "STORAGE_OUT",
      mechanicalDescription: "Slides forward along the +Y axis out of the sled, then lifts vertically along +Z clear of the shroud.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.2)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (STORAGE_OUT sled slide, REV 3.2)",
      "build/animation_stages.json",
    ],
  },

  PSU: {
    id: "PSU",
    displayName: "Power Supply Unit (PSU)",
    category: "power",
    shortDescription: "Internal electrical power transformer converting high-voltage AC mains into regulated DC output rails.",
    purpose: "Supplies steady +12V, +5V, +3.3V, and +5VSB direct current to the motherboard, processor, graphics card, fans, and storage drives.",
    connections: [
      {
        target: "CASE",
        type: "mounts_on",
        description: "Seats in isolated lower chassis floor tunnel with rear mounting bracket screws.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (PSU_OUT)"],
      },
      {
        target: "CABLE_24PIN",
        type: "powers",
        description: "Primary ATX main power output connector bundle.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
      {
        target: "CABLE_CPU_POWER",
        type: "powers",
        description: "Dedicated EPS 12V CPU power output socket.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
      {
        target: "CABLE_GPU_POWER",
        type: "powers",
        description: "PCIe auxiliary 12V graphics power output socket.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
    ],
    keyLearningPoints: [
      "Rear extraction: Slides rearward along the case floor after external mounting screws are loosened.",
      "Efficiency ratings (80 Plus Bronze/Gold/Platinum) indicate percentage of AC wall power converted to usable DC power.",
      "Cable output ends remain mated to PSU during motherboard extraction and separate during SECONDARY_OUT.",
    ],
    relatedComponents: ["CASE", "CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "PSU_OUT",
      mechanicalDescription: "Slides rearward 400mm along the +Y floor axis after 4 chassis rear screws are released.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.2)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (PSU_OUT slide primitive, REV 3.2)",
      "build/animation_stages.json",
    ],
  },

  CASE_FAN_01: {
    id: "CASE_FAN_01",
    displayName: "Front Intake Fan (Upper)",
    category: "cooling",
    shortDescription: "Upper chassis front fan generating directional positive intake air pressure across internal components.",
    purpose: "Pulls cool ambient air from outside the case across the RAM and CPU cooler zone to replenish internal air volume.",
    connections: [
      {
        target: "CASE",
        type: "mounts_on",
        description: "Bolts directly to front internal chassis fan mounting frame.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (SECONDARY_OUT)"],
      },
    ],
    keyLearningPoints: [
      "Orientation matters: fan frame struts indicate the direction of airflow discharge.",
      "Positive pressure (more intake than exhaust) forces air out of case cracks, reducing dust accumulation.",
      "Extracted forward along the -Y axis during the SECONDARY_OUT stage.",
    ],
    relatedComponents: ["CASE", "CASE_FAN_02", "CASE_FAN_03"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "SECONDARY_OUT",
      mechanicalDescription: "Unbolts from front frame and translates 240mm forward along the -Y axis.",
      sourceRefs: ["build/disassembly_manifest.json", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (SECONDARY_OUT front fan translation)",
      "build/animation_stages.json",
    ],
  },

  CASE_FAN_02: {
    id: "CASE_FAN_02",
    displayName: "Front Intake Fan (Lower)",
    category: "cooling",
    shortDescription: "Lower chassis front fan drawing cool ambient air across the graphics card and storage chamber.",
    purpose: "Provides direct cooling airflow to the graphics card intake fans and lower storage bay components.",
    connections: [
      {
        target: "CASE",
        type: "mounts_on",
        description: "Bolts directly to lower section of front chassis mounting frame.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (SECONDARY_OUT)"],
      },
    ],
    keyLearningPoints: [
      "Dedicated GPU airflow: supplies low-temperature intake air directly into the graphics card cooling shroud.",
      "Dual front fans establish uniform intake laminar flow through the primary chassis chamber.",
      "Extracted forward along the -Y axis alongside Fan 1 in SECONDARY_OUT.",
    ],
    relatedComponents: ["CASE", "CASE_FAN_01", "GPU"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "SECONDARY_OUT",
      mechanicalDescription: "Unbolts from front lower frame and translates 240mm forward along the -Y axis.",
      sourceRefs: ["build/disassembly_manifest.json", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (SECONDARY_OUT front fan translation)",
      "build/animation_stages.json",
    ],
  },

  CASE_FAN_03: {
    id: "CASE_FAN_03",
    displayName: "Rear Exhaust Fan",
    category: "cooling",
    shortDescription: "Chassis rear fan responsible for actively evacuating hot exhaust air out of the case.",
    purpose: "Extracts hot air expelled from the CPU cooler heatsink and VRM circuitry to maintain a low internal ambient thermal equilibrium.",
    connections: [
      {
        target: "CASE",
        type: "mounts_on",
        description: "Bolts to rear case exhaust grille immediately adjacent to the motherboard rear I/O shield.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (SECONDARY_OUT)"],
      },
    ],
    keyLearningPoints: [
      "Positioned adjacent to CPU heatsink to immediately capture and expel warm air before it recirculates.",
      "Motherboard extraction includes an authored swing motion specifically to clear this rear fan frame corner.",
      "Extracted rearward along the +Y axis during the SECONDARY_OUT stage.",
    ],
    relatedComponents: ["CASE", "CPU_COOLER", "MOTHERBOARD"],
    disassembly: {
      actionType: "extract_isolated",
      disassemblyStage: "SECONDARY_OUT",
      mechanicalDescription: "Unbolts from rear case grille and translates 400mm rearward along the +Y axis.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.3 corner clearance)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (SECONDARY_OUT rear fan, REV 3.3 clearance rule)",
      "build/animation_stages.json",
    ],
  },

  CABLE_24PIN: {
    id: "CABLE_24PIN",
    displayName: "24-Pin ATX Main Power Cable",
    category: "interconnect",
    shortDescription: "Heavy-gauge primary power harness connecting the power supply to the motherboard main power header.",
    purpose: "Supplies essential multi-voltage DC rails (+3.3V, +5V, +12V, -12V, +5VSB) powering the motherboard chipset, PCIe slots, and onboard logic.",
    connections: [
      {
        target: "PSU",
        type: "receives_power",
        description: "Originates from main ATX power output connector bundle on the PSU.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
      {
        target: "MOTHERBOARD",
        type: "powers",
        description: "Plugs into keyed 24-pin ATX power receptacle on the right edge of the motherboard.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
    ],
    keyLearningPoints: [
      "Sub-sequence disconnect: Board-side connector releases and drops below board frame inside MOTHERBOARD_OUT before board slide.",
      "Keyed friction latch prevents accidental disconnect during operation.",
      "Final cable harness extraction occurs in SECONDARY_OUT when PSU ends separate.",
    ],
    relatedComponents: ["MOTHERBOARD", "PSU"],
    disassembly: {
      actionType: "disconnect_and_extract",
      disconnectStage: "MOTHERBOARD_OUT",
      disassemblyStage: "SECONDARY_OUT",
      mechanicalDescription: "Disconnects from motherboard header and routes below board in MOTHERBOARD_OUT; PSU-side end extracts in SECONDARY_OUT.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.4 cable sub-sequence)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (REV 3.4 24-pin disconnect sub-sequence & SECONDARY_OUT)",
      "build/animation_stages.json",
      "ANIMATION_CONTRACT.md",
    ],
  },

  CABLE_CPU_POWER: {
    id: "CABLE_CPU_POWER",
    displayName: "8-Pin EPS CPU Power Cable",
    category: "interconnect",
    shortDescription: "Dedicated +12V power cable connecting the PSU directly to the motherboard CPU Voltage Regulator Module (VRM).",
    purpose: "Delivers clean, dedicated high-current 12V power isolated from peripheral buses to feed multi-phase CPU power VRMs.",
    connections: [
      {
        target: "PSU",
        type: "receives_power",
        description: "Originates from 8-pin EPS 12V auxiliary output port on the PSU.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
      {
        target: "MOTHERBOARD",
        type: "powers",
        description: "Plugs into 8-pin EPS header near the top-left VRM heatsink on the motherboard.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
    ],
    keyLearningPoints: [
      "Dedicated VRM power: prevents CPU voltage drops caused by high-draw expansion cards on the 24-pin rail.",
      "Disconnect sub-sequence: Disengages from motherboard and lifts above top edge during MOTHERBOARD_OUT so board slide passes under.",
      "Final harness extraction occurs in SECONDARY_OUT when PSU ends separate.",
    ],
    relatedComponents: ["MOTHERBOARD", "CPU", "PSU"],
    disassembly: {
      actionType: "disconnect_and_extract",
      disconnectStage: "MOTHERBOARD_OUT",
      disassemblyStage: "SECONDARY_OUT",
      mechanicalDescription: "Disengages from CPU header and lifts above board top in MOTHERBOARD_OUT; PSU-side end extracts in SECONDARY_OUT.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.4)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (REV 3.4 EPS disconnect sub-sequence & SECONDARY_OUT)",
      "build/animation_stages.json",
      "ANIMATION_CONTRACT.md",
    ],
  },

  CABLE_GPU_POWER: {
    id: "CABLE_GPU_POWER",
    displayName: "8-Pin PCIe Graphics Power Cable",
    category: "interconnect",
    shortDescription: "High-current auxiliary +12V power cable connecting the PSU to dedicated graphics card power ports.",
    purpose: "Provides supplementary 12V current (up to 150W per 8-pin connector) required by dedicated graphics processors beyond the 75W PCIe slot limit.",
    connections: [
      {
        target: "PSU",
        type: "receives_power",
        description: "Originates from dedicated PCIe 12V power output rail on the PSU.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
      {
        target: "GPU",
        type: "powers",
        description: "Plugs into top/side 8-pin auxiliary power receptacle on the graphics card.",
        status: "verified",
        sourceRefs: ["build/disassembly_manifest.json (REV 3.4)"],
      },
    ],
    keyLearningPoints: [
      "High power capacity: standard 8-pin PCIe cables supply up to 150W of auxiliary power.",
      "Disconnect sub-sequence: Disengages from GPU and routes rearward clear of riding GPU in MOTHERBOARD_OUT.",
      "Final harness extraction occurs in SECONDARY_OUT when PSU ends separate.",
    ],
    relatedComponents: ["GPU", "PSU"],
    disassembly: {
      actionType: "disconnect_and_extract",
      disconnectStage: "MOTHERBOARD_OUT",
      disassemblyStage: "SECONDARY_OUT",
      mechanicalDescription: "Disengages from GPU power socket and routes rearward in MOTHERBOARD_OUT; PSU-side end extracts in SECONDARY_OUT.",
      sourceRefs: ["build/disassembly_manifest.json (REV 3.4)", "build/animation_stages.json"],
    },
    contentStatus: "verified",
    sourceRefs: [
      "build/disassembly_manifest.json (REV 3.4 GPU power disconnect sub-sequence & SECONDARY_OUT)",
      "build/animation_stages.json",
      "ANIMATION_CONTRACT.md",
    ],
  },
};
