"""PC anatomy blockout builder (Step 2, revision 2).

Builds a complete modern mid-tower desktop PC as separate named objects with a
clean PC_ROOT hierarchy, real-world proportions (meters), simple PBR materials
and animation-ready pivots. Non-destructive: bevels stay as live modifiers.

Revision 2:
- GPU rebuilt as a layered card (shroud + fans + PCB + backplate + fingers +
  rear bracket with outputs + power connector) so it reads as a GPU.
- Motherboard gains orientation landmarks (socket, DIMM slots, PCIe slot,
  M.2 mount, I/O region, chipset, power connectors).
- A formal disassembly manifest is embedded (scene text datablock + PC_ROOT
  custom property + build/disassembly_manifest.json) defining the staged
  sequence; CPU_COOLER_OUT always settles before CPU_OUT starts.

Run:  blender -b --python scripts/build_blockout.py
Out:  build/blockout.blend + build/disassembly_manifest.json
"""
import json
import math
import os
import bpy
from mathutils import Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_BLEND = os.path.join(ROOT, "build", "blockout.blend")
OUT_MANIFEST = os.path.join(ROOT, "build", "disassembly_manifest.json")

# ----------------------------------------------------------------------------
# Layout constants (meters). World: Z up, case front = -Y, glass side = -X.
# ----------------------------------------------------------------------------
BS = 0.0877          # motherboard component-side surface plane (X)
SF = 0.0852          # CPU socket plate face plane (X) - CPU seats here
WALL = 0.002         # case sheet-metal thickness
CASE_X = 0.1075      # case outer half-width
CASE_Y = 0.220       # case outer half-depth
CASE_Z = 0.460       # case height

# ----------------------------------------------------------------------------
# Materials (simple, neutral blockout PBR)
# ----------------------------------------------------------------------------
def make_mat(name, color, metallic=0.0, roughness=0.5, transmission=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if "Transmission Weight" in b.inputs:
        b.inputs["Transmission Weight"].default_value = transmission
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "DITHERED"   # Blender 4.2+
        except Exception:
            try:
                m.blend_method = "BLEND"           # older fallback
            except Exception:
                pass
    return m


def build_materials():
    return {
        "case":     make_mat("MAT_CASE",     (0.028, 0.030, 0.034), 0.75, 0.42),
        "glass":    make_mat("MAT_GLASS",    (0.045, 0.055, 0.065), 0.0, 0.08, 0.92, 0.30),
        "pcb":      make_mat("MAT_PCB",      (0.012, 0.016, 0.020), 0.15, 0.55),
        "metal":    make_mat("MAT_METAL",    (0.42, 0.44, 0.47),    1.0, 0.32),
        "plastic":  make_mat("MAT_PLASTIC",  (0.020, 0.020, 0.023), 0.0, 0.65),
        "gpu":      make_mat("MAT_GPU",      (0.050, 0.052, 0.058), 0.40, 0.50),
        "psu":      make_mat("MAT_PSU",      (0.030, 0.030, 0.033), 0.70, 0.50),
        "ram":      make_mat("MAT_RAM",      (0.090, 0.100, 0.120), 0.60, 0.45),
        "storage":  make_mat("MAT_STORAGE",  (0.070, 0.075, 0.090), 0.50, 0.50),
        "cpu":      make_mat("MAT_CPU",      (0.55, 0.57, 0.60),    1.0, 0.25),
        "cable":    make_mat("MAT_CABLE",    (0.016, 0.016, 0.019), 0.0, 0.70),
    }

# ----------------------------------------------------------------------------
# Geometry helpers
# ----------------------------------------------------------------------------
def _activate(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def box(name, dims, loc, mat, bevel=0.001):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m = o.modifiers.new("EdgeBevel", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
        m.harden_normals = True
        for p in o.data.polygons:
            p.use_smooth = True
    if mat:
        o.data.materials.append(mat)
    return o


def cylinder(name, radius, depth, loc, rot, mat):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    for p in o.data.polygons:
        p.use_smooth = True
    if mat:
        o.data.materials.append(mat)
    return o


def join_parts(name, parts, mat=None):
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    if mat is not None:
        o.data.materials.clear()
        o.data.materials.append(mat)
    return o


def set_origin(o, point):
    bpy.context.scene.cursor.location = point
    _activate(o)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")


def set_parent(child, parent):
    bpy.context.view_layer.update()          # ensure matrix_world is not stale
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()
    child.matrix_world = mw


def empty(name, size=0.05):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "PLAIN_AXES"
    e.empty_display_size = size
    bpy.context.scene.collection.objects.link(e)
    return e


def cable(name, points, bevel_depth, mat):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 12
    cu.bevel_depth = bevel_depth
    cu.bevel_resolution = 3
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, co in zip(sp.bezier_points, points):
        bp.co = co
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    cu.materials.append(mat)
    # origin at PSU-end of the cable
    cu.transform(Matrix.Translation((-points[0][0], -points[0][1], -points[0][2])))
    o.location = points[0]
    return o


# ----------------------------------------------------------------------------
# Disassembly manifest (formal animation architecture)
# ----------------------------------------------------------------------------
EXPLODE_OFFSETS = {
    # organized along each object's own extraction axis - not scattered
    "CASE_SIDE_PANEL": (-0.44, 0.45, 0.0),
    "MOTHERBOARD": (-0.50, 0.0, 0.0),
    "CPU": (-0.66, 0.0, 0.0), "CPU_COOLER": (-0.82, 0.0, 0.0),
    "RAM_01": (-0.66, 0.0, 0.02), "RAM_02": (-0.72, 0.0, 0.04),
    "RAM_03": (-0.78, 0.0, 0.06), "RAM_04": (-0.84, 0.0, 0.08),
    "M2_SSD": (-0.62, 0.0, 0.045),
    "GPU": (-0.55, 0.0, 0.0),
    "STORAGE": (-0.22, 0.0, 0.10),
    "PSU": (0.0, 0.65, 0.0),
    "CASE_FAN_01": (0.0, -0.24, 0.0), "CASE_FAN_02": (0.0, -0.24, 0.0),
    "CASE_FAN_03": (0.0, 0.40, 0.0),
    "CABLE_24PIN": (0.0, 0.24, 0.0), "CABLE_CPU_POWER": (0.0, 0.28, 0.0),
    "CABLE_GPU_POWER": (0.0, 0.26, 0.0),
}

MANIFEST = {
    "version": 3,
    "units": "meters",
    "world_axes": "Z up; case front = -Y; glass side / extraction direction = -X",
    "rules": [
        "CPU_COOLER_OUT must complete and settle before CPU_OUT starts",
        "Motherboard riders (CPU, CPU_COOLER, RAM_01-04, M2_SSD) travel with MOTHERBOARD_OUT",
        "FINAL_EXPLODE parks parts along their own extraction axes (organized, readable)",
        "'removal' = physical disengagement path (ordered primitives); "
        "'presentation' = organized educational park pose. Related but not identical.",
        "REV 3.1 (Step 4B collision-driven): GPU added as board rider — the board's -X "
        "extraction corridor passes through the GPU's footprint, so the card must travel "
        "plugged-in and disengage from the parked board at GPU_OUT (relative -0.17). GPU "
        "final park moved to -0.55: parks at -0.30/-0.45 lie inside the board's sweep "
        "corridor and are unreachable without crossing the board. Stage order unchanged.",
        "REV 3.2 (Step 4B collision sweep, geometry frozen): (a) MOTHERBOARD_OUT = lift "
        "0.012 off standoffs, then -X 0.38 slide, settle to Z 0 — a pure -X slide clips "
        "the mounted STORAGE top (Z 0.099) near X -0.055. (b) OPEN_CASE panel parks at "
        "(-0.30, +0.45, 0): a Y-0 park sits inside the GPU/RAM/cooler extraction "
        "corridor; panel final explode (-0.44, 0.45, 0). (c) STORAGE_OUT = +Y 0.03 sled "
        "slide, then +Z 0.15 lift — the straight lift clips the front fans' corner Y "
        "band. (d) PSU final explode (0, 0.65, 0): a pure +Y slide at floor Z never "
        "crosses the rear fan plane, unlike the old (0,0.50,0.30) climb.",
        "REV 3.3 (Step 4B sweep): MOTHERBOARD_OUT adds a -Y 0.01 swing between the "
        "standoff lift and the -X slide — the board's rear edge (Y max 0.183) interlocks "
        "4 mm with the rear exhaust fan frame (Y min 0.179); the board swings clear, "
        "slides, and settles back to Y/Z 0 at park.",
    ],
    "motion_layers": {
        "removal": "realistic mechanical path a technician follows (unscrew/unclip implied, motion primitives explicit)",
        "presentation": "staging offsets used for previews and the educational exploded assembly"
    },
    "primitive_types": ["translate", "pivot"],
    "stages": [
        {"i": 1, "id": "OPEN_CASE", "objects": ["CASE_SIDE_PANEL"], "axis": [-1, 0, 0], "dist": 0.30,
         "removal": {"CASE_SIDE_PANEL": [
             {"type": "translate", "axis": [0, 1, 0], "dist": 0.03, "note": "slide rearward off thumbscrews"},
             {"type": "translate", "axis": [-1, 0, 0], "dist": 0.27, "note": "lift away from case"}]},
         "presentation": {"CASE_SIDE_PANEL": {"axis": [-1, 0, 0], "dist": 0.30, "set_aside": [0, 0.45, 0],
                                                "note": "REV 3.2: set +0.45 Y so the panel never sits inside the extraction corridor"}}},
        {"i": 2, "id": "MOTHERBOARD_OUT", "objects": ["MOTHERBOARD"],
         "riders": ["CPU", "CPU_COOLER", "RAM_01", "RAM_02", "RAM_03", "RAM_04", "M2_SSD", "GPU"],
         "axis": [-1, 0, 0], "dist": 0.38,
         "removal": {"MOTHERBOARD": [
             {"type": "translate", "axis": [0, 0, 1], "dist": 0.012,
              "note": "REV 3.2: lift clear of standoffs first (a pure -X slide clips STORAGE top Z 0.099)"},
             {"type": "translate", "axis": [0, -1, 0], "dist": 0.01,
              "note": "REV 3.3: swing clear of the rear exhaust fan corner (board Y max 0.183 vs fan Y min 0.179) before sliding"},
             {"type": "translate", "axis": [-1, 0, 0], "dist": 0.38,
              "note": "slide board (with riders) clear, settle back to Y/Z 0 at park"}]},
         "presentation": {"MOTHERBOARD": {"axis": [-1, 0, 0], "dist": 0.38}}},
        {"i": 3, "id": "CPU_COOLER_OUT", "objects": ["CPU_COOLER"], "axis": [-1, 0, 0], "dist": 0.30, "settle": True,
         "removal": {"CPU_COOLER": [
             {"type": "translate", "axis": [-1, 0, 0], "dist": 0.30, "note": "lift after clip/screw release"}]},
         "presentation": {"CPU_COOLER": {"axis": [-1, 0, 0], "dist": 0.30}}},
        {"i": 4, "id": "CPU_OUT", "objects": ["CPU"], "axis": [-1, 0, 0], "dist": 0.22, "settle": True,
         "removal": {"CPU": [
             {"type": "translate", "axis": [-1, 0, 0], "dist": 0.22, "note": "lift straight out after retention lever opens"}]},
         "presentation": {"CPU": {"axis": [-1, 0, 0], "dist": 0.22}}},
        {"i": 5, "id": "RAM_OUT", "objects": ["RAM_01", "RAM_02", "RAM_03", "RAM_04"],
         "axis": [-1, 0, 0], "dist": 0.25, "sequential": True,
         "removal": {n: [{"type": "translate", "axis": [-1, 0, 0], "dist": 0.25,
                          "note": "eject after both slot clips open"}] for n in ["RAM_01", "RAM_02", "RAM_03", "RAM_04"]},
         "presentation": {n: {"axis": [-1, 0, 0], "dist": 0.25} for n in ["RAM_01", "RAM_02", "RAM_03", "RAM_04"]}},
        {"i": 6, "id": "GPU_OUT", "objects": ["GPU"], "axis": [-1, 0, 0], "dist": 0.17,
         "relative_to": "MOTHERBOARD_OUT park (GPU rides the board; disengages from parked board)",
         "removal": {"GPU": [
             {"type": "translate", "axis": [-1, 0, 0], "dist": 0.01, "note": "slot latch release, slight outward disengage"},
             {"type": "translate", "axis": [-1, 0, 0], "dist": 0.16, "note": "slide clear of parked board after bracket screw release"}]},
         "presentation": {"GPU": {"axis": [-1, 0, 0], "dist": 0.17,
                                   "note": "relative to parked board; absolute park = -0.38 - 0.17 = -0.55"}}},
        {"i": 7, "id": "STORAGE_OUT", "objects": ["M2_SSD", "STORAGE"],
         "per_object": {"M2_SSD": {"axis": [-1, 0, 0], "dist": 0.15},
                        "STORAGE": {"axis": [0, 0, 1], "dist": 0.15}},
         "removal": {"M2_SSD": [
             {"type": "pivot", "axis": [0, 0, 1], "pivot_at": "connector_edge", "angle_deg": 12,
              "note": "after standoff screw removal, stick pivots up about the connector edge"},
             {"type": "translate", "axis": [-1, 0, 0], "dist": 0.02, "note": "disengage connector at lift angle"},
             {"type": "translate", "axis": [-1, 0, 0], "dist": 0.13, "note": "clear the board"}],
             "STORAGE": [
             {"type": "translate", "axis": [0, 1, 0], "dist": 0.03,
              "note": "REV 3.2: slide +Y out of the sled (clears the front fans' corner Y band)"},
             {"type": "translate", "axis": [0, 0, 1], "dist": 0.15, "note": "lift off shroud mount"}]},
         "presentation": {"M2_SSD": {"axis": [-1, 0, 0], "dist": 0.15},
                          "STORAGE": {"axis": [0, 0, 1], "dist": 0.15}}},
        {"i": 8, "id": "PSU_OUT", "objects": ["PSU"], "axis": [0, 1, 0], "dist": 0.40,
         "removal": {"PSU": [
             {"type": "translate", "axis": [0, 1, 0], "dist": 0.40, "note": "slide out rear after 4 case screws"}]},
         "presentation": {"PSU": {"axis": [0, 1, 0], "dist": 0.40}}},
        {"i": 9, "id": "SECONDARY_OUT",
         "objects": ["CASE_FAN_01", "CASE_FAN_02", "CASE_FAN_03",
                     "CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER"],
         "per_object": {"CASE_FAN_01": {"axis": [0, -1, 0], "dist": 0.24},
                        "CASE_FAN_02": {"axis": [0, -1, 0], "dist": 0.24},
                        "CASE_FAN_03": {"axis": [0, 1, 0], "dist": 0.40},
                        "CABLE_24PIN": {"axis": [0, 1, 0], "dist": 0.24},
                        "CABLE_CPU_POWER": {"axis": [0, 1, 0], "dist": 0.28},
                        "CABLE_GPU_POWER": {"axis": [0, 1, 0], "dist": 0.26}},
         "removal": {"CASE_FAN_01": [{"type": "translate", "axis": [0, -1, 0], "dist": 0.24, "note": "unbolt from front panel"}],
                     "CASE_FAN_02": [{"type": "translate", "axis": [0, -1, 0], "dist": 0.24, "note": "unbolt from front panel"}],
                     "CASE_FAN_03": [{"type": "translate", "axis": [0, 1, 0], "dist": 0.40, "note": "unbolt from rear"}],
                     "CABLE_24PIN": [{"type": "translate", "axis": [-1, 0, 0], "dist": 0.02, "note": "unplug from board"},
                                     {"type": "translate", "axis": [0, 1, 0], "dist": 0.22, "note": "route clear"}],
                     "CABLE_CPU_POWER": [{"type": "translate", "axis": [-1, 0, 0], "dist": 0.02, "note": "unplug from board"},
                                         {"type": "translate", "axis": [0, 1, 0], "dist": 0.26, "note": "route clear"}],
                     "CABLE_GPU_POWER": [{"type": "translate", "axis": [0, 0, 1], "dist": 0.02, "note": "unplug from card"},
                                         {"type": "translate", "axis": [0, 1, 0], "dist": 0.24, "note": "route clear"}]},
         "presentation": {"CASE_FAN_01": {"axis": [0, -1, 0], "dist": 0.24},
                          "CASE_FAN_02": {"axis": [0, -1, 0], "dist": 0.24},
                          "CASE_FAN_03": {"axis": [0, 1, 0], "dist": 0.40},
                          "CABLE_24PIN": {"axis": [0, 1, 0], "dist": 0.24},
                          "CABLE_CPU_POWER": {"axis": [0, 1, 0], "dist": 0.28},
                          "CABLE_GPU_POWER": {"axis": [0, 1, 0], "dist": 0.26}}},
        {"i": 10, "id": "FINAL_EXPLODE", "organized": True, "offsets": EXPLODE_OFFSETS},
    ],
}

# per-object stage metadata (also written as custom properties)
OBJECT_STAGE = {
    "CASE_SIDE_PANEL": (1, (-1, 0, 0), 0.30),
    "MOTHERBOARD": (2, (-1, 0, 0), 0.38),
    "CPU_COOLER": (3, (-1, 0, 0), 0.30),
    "CPU": (4, (-1, 0, 0), 0.22),
    "RAM_01": (5, (-1, 0, 0), 0.25), "RAM_02": (5, (-1, 0, 0), 0.25),
    "RAM_03": (5, (-1, 0, 0), 0.25), "RAM_04": (5, (-1, 0, 0), 0.25),
    "GPU": (6, (-1, 0, 0), 0.17),
    "M2_SSD": (7, (-1, 0, 0), 0.15), "STORAGE": (7, (0, 0, 1), 0.15),
    "PSU": (8, (0, 1, 0), 0.40),
    "CASE_FAN_01": (9, (0, -1, 0), 0.24), "CASE_FAN_02": (9, (0, -1, 0), 0.24),
    "CASE_FAN_03": (9, (0, 1, 0), 0.40),
    "CABLE_24PIN": (9, (0, 1, 0), 0.24), "CABLE_CPU_POWER": (9, (0, 1, 0), 0.28),
    "CABLE_GPU_POWER": (9, (0, 1, 0), 0.26),
}


# ----------------------------------------------------------------------------
# Build
# ----------------------------------------------------------------------------
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.length_unit = "MILLIMETERS"
    sc.unit_settings.scale_length = 1.0
    if bpy.data.collections.get("Collection"):
        bpy.data.collections["Collection"].name = "PC"

    M = build_materials()

    root = empty("PC_ROOT", 0.10)
    grp_ram = empty("RAM", 0.04)
    grp_fans = empty("FANS", 0.04)
    grp_cables = empty("CABLES", 0.04)
    for g in (grp_ram, grp_fans, grp_cables):
        set_parent(g, root)

    # ---- CASE (joined shell panels + tray + PSU shroud) --------------------
    cx, cy, cz = CASE_X, CASE_Y, CASE_Z
    parts = [
        box("case_right", (WALL, cy * 2, cz), (cx - WALL / 2, 0, cz / 2), M["case"]),
        box("case_front", (cx * 2 - WALL, WALL, cz), (0, -cy + WALL / 2, cz / 2), M["case"]),
        box("case_rear", (cx * 2 - WALL, WALL, cz), (0, cy - WALL / 2, cz / 2), M["case"]),
        box("case_top", (cx * 2 - WALL, cy * 2, WALL), (0, 0, cz - WALL / 2), M["case"]),
        box("case_bottom", (cx * 2 - WALL, cy * 2, WALL), (0, 0, WALL / 2), M["case"]),
        # motherboard tray (mounted on right wall, components face -X)
        box("case_tray", (0.008, 0.320, 0.320), (0.0933, 0.020, 0.2275), M["case"]),
        # PSU shroud, front 2/3 only so the PSU can slide out at the rear
        box("case_shroud", (0.211, 0.278, 0.088), (0, -0.079, 0.046), M["case"]),
    ]
    case = join_parts("CASE", parts, M["case"])
    set_origin(case, (0, 0, 0))
    set_parent(case, root)
    case["display_name"] = "Case"

    # ---- CASE_SIDE_PANEL (tempered glass, hinge pivot at front edge) -------
    panel = box("CASE_SIDE_PANEL", (0.004, 0.436, 0.456), (-0.1095, 0, 0.230), M["glass"], bevel=0.0005)
    set_origin(panel, (-0.1095, -0.218, 0.230))
    set_parent(panel, case)
    panel["display_name"] = "Side Panel (Glass)"

    # ---- MOTHERBOARD (PCB + orientation landmarks) -------------------------
    mb_parts = [
        box("mb_pcb", (0.0016, 0.305, 0.244), (0.0885, 0.0275, 0.237), M["pcb"], bevel=0.0004),
        # CPU socket landmark: raised frame + dark inner plate (CPU seats on it)
        box("mb_socket_frame", (0.0025, 0.052, 0.052), (0.08645, 0.050, 0.270), M["metal"], bevel=0.0004),
        box("mb_socket_inner", (0.0012, 0.040, 0.040), (0.0858, 0.050, 0.270), M["plastic"]),
        # VRM heatsinks (rear-of-socket + above-socket)
        box("mb_vrm_rear", (0.010, 0.070, 0.025), (0.0827, 0.135, 0.300), M["metal"]),
        box("mb_vrm_top", (0.010, 0.050, 0.028), (0.0827, 0.050, 0.318), M["metal"]),
        # rear I/O region
        box("mb_io", (0.012, 0.015, 0.060), (0.0817, 0.1725, 0.320), M["metal"]),
        box("mb_io_low", (0.010, 0.012, 0.025), (0.0827, 0.1725, 0.2725), M["metal"]),
        # chipset heatsink, below GPU backplate line
        box("mb_chipset", (0.012, 0.040, 0.028), (0.0817, 0.100, 0.129), M["metal"]),
        # PCIe x16 slot housing (GPU fingers seat here)
        box("mb_pcie", (0.006, 0.090, 0.012), (0.0847, 0.105, 0.182), M["plastic"], bevel=0.0004),
        # M.2 connector + standoff post
        box("mb_m2_conn", (0.006, 0.012, 0.006), (0.0847, 0.016, 0.229), M["plastic"]),
        cylinder("mb_m2_post", 0.0018, 0.005, (0.0852, 0.082, 0.229), (0, math.radians(90), 0), M["metal"]),
        # on-board power connector landmarks (cable landings)
        box("mb_24pin", (0.006, 0.024, 0.012), (0.0847, -0.105, 0.165), M["plastic"], bevel=0.0004),
        box("mb_eps", (0.006, 0.016, 0.010), (0.0847, 0.150, 0.347), M["plastic"], bevel=0.0004),
    ]
    # DIMM slot housings (RAM sticks seat into these)
    for sy in (-0.002, -0.012, -0.022, -0.032):
        mb_parts.append(box("mb_dimm", (0.005, 0.010, 0.136), (0.0852, sy, 0.270), M["plastic"], bevel=0.0003))
    mobo = join_parts("MOTHERBOARD", mb_parts)
    set_origin(mobo, (0.0885, 0.0275, 0.237))
    set_parent(mobo, root)
    mobo["display_name"] = "Motherboard"

    # ---- CPU (seats on socket plate face X=0.0852 -> lifts out -X) ---------
    cpu = box("CPU", (0.004, 0.045, 0.045), (0.0832, 0.050, 0.270), M["cpu"], bevel=0.0008)
    set_origin(cpu, (SF, 0.050, 0.270))
    set_parent(cpu, root)
    cpu["display_name"] = "CPU"

    # ---- CPU_COOLER (base + fin stack + fan, joined) -----------------------
    fan_cx = 0.0177
    cl_parts = [
        box("cl_base", (0.006, 0.090, 0.060), (0.0782, 0.050, 0.272), M["metal"]),
        box("cl_fins", (0.045, 0.090, 0.130), (0.0527, 0.050, 0.270), M["metal"]),
        box("cl_fan", (0.025, 0.120, 0.120), (fan_cx, 0.050, 0.270), M["plastic"]),
        cylinder("cl_hub", 0.020, 0.026, (fan_cx, 0.050, 0.270), (0, math.radians(90), 0), M["plastic"]),
    ]
    cooler = join_parts("CPU_COOLER", cl_parts)
    set_origin(cooler, (SF - 0.004, 0.050, 0.270))   # contact face with CPU
    set_parent(cooler, root)
    cooler["display_name"] = "CPU Cooler"

    # ---- RAM x4 (origin at connector edge -> eject perpendicular, -X) ------
    ram_ys = [-0.002, -0.012, -0.022, -0.032]
    for i, y in enumerate(ram_ys, start=1):
        r = box(f"RAM_{i:02d}", (0.045, 0.008, 0.133), (BS - 0.0225, y, 0.270), M["ram"], bevel=0.0008)
        set_origin(r, (BS, y, 0.270))
        set_parent(r, grp_ram)
        r["display_name"] = f"RAM Module {i}"

    # ---- GPU (layered card: shroud + fans + PCB + backplate + bracket) -----
    gpu_parts = [
        # cooler shroud (main body); fans sit in open bays and protrude below
        box("gpu_shroud", (0.117, 0.260, 0.030), (0.0215, 0.030, 0.165), M["gpu"], bevel=0.002),
        cylinder("gpu_fan_a", 0.042, 0.022, (0.0215, -0.055, 0.140), (0, 0, 0), M["plastic"]),
        cylinder("gpu_fan_b", 0.042, 0.022, (0.0215, 0.045, 0.140), (0, 0, 0), M["plastic"]),
        cylinder("gpu_hub_a", 0.016, 0.026, (0.0215, -0.055, 0.140), (0, 0, 0), M["gpu"]),
        cylinder("gpu_hub_b", 0.016, 0.026, (0.0215, 0.045, 0.140), (0, 0, 0), M["gpu"]),
        # PCB (thin, slightly inset from the shroud edges)
        box("gpu_pcb", (0.112, 0.220, 0.0016), (0.0295, 0.054, 0.1808), M["pcb"], bevel=0.0003),
        # metal backplate facing up (visible through the glass)
        box("gpu_backplate", (0.112, 0.258, 0.0024), (0.024, 0.032, 0.183), M["metal"], bevel=0.0006),
        # PCIe fingers (seat into the mb_pcie slot housing)
        box("gpu_fingers", (0.0045, 0.078, 0.003), (0.08545, 0.105, 0.1795), M["metal"]),
        # rear I/O bracket: long axis along X (like the case slot covers),
        # display outputs in a row along X on the rear face
        box("gpu_bracket", (0.120, 0.003, 0.036), (0.0277, 0.1815, 0.160), M["metal"], bevel=0.0005),
        box("gpu_port1", (0.014, 0.002, 0.007), (-0.010, 0.1832, 0.155), M["plastic"]),
        box("gpu_port2", (0.014, 0.002, 0.007), (0.012, 0.1832, 0.155), M["plastic"]),
        box("gpu_port3", (0.014, 0.002, 0.007), (0.034, 0.1832, 0.155), M["plastic"]),
        # 8-pin power connector on the far (top) edge near the rear
        box("gpu_pwr", (0.020, 0.024, 0.010), (-0.020, 0.125, 0.188), M["plastic"], bevel=0.0008),
    ]
    gpu = join_parts("GPU", gpu_parts)
    set_origin(gpu, (BS, 0.040, 0.171))             # slot-contact face
    set_parent(gpu, root)
    gpu["display_name"] = "Graphics Card (GPU)"

    # ---- M.2 SSD (flat on board between socket and PCIe slot) --------------
    m2 = box("M2_SSD", (0.008, 0.080, 0.022), (BS - 0.004, 0.050, 0.229), M["storage"], bevel=0.0005)
    set_origin(m2, (BS, 0.050, 0.229))
    set_parent(m2, root)
    m2["display_name"] = "M.2 SSD"

    # ---- STORAGE (2.5" SATA SSD on the PSU shroud, front) ------------------
    st = box("STORAGE", (0.070, 0.100, 0.008), (-0.020, -0.140, 0.094), M["storage"], bevel=0.001)
    set_origin(st, (-0.020, -0.140, 0.090))
    set_parent(st, root)
    st["display_name"] = "Storage Drive (2.5\" SSD)"

    # ---- PSU (rear-bottom, open area behind shroud -> slides out -X) -------
    psu = box("PSU", (0.150, 0.140, 0.086), (0.030, 0.148, 0.045), M["psu"], bevel=0.002)
    set_origin(psu, (0.030, 0.148, 0.002))
    set_parent(psu, root)
    psu["display_name"] = "Power Supply (PSU)"

    # ---- CASE FANS (2 front intake, 1 rear exhaust; origin = hub) ----------
    fan_specs = [
        ("CASE_FAN_01", (0.0, -0.194, 0.170)),
        ("CASE_FAN_02", (0.0, -0.194, 0.310)),
        ("CASE_FAN_03", (-0.010, 0.194, 0.330)),
    ]
    for name, c in fan_specs:
        fparts = [
            box(name + "_frame", (0.120, 0.025, 0.120), c, M["plastic"], bevel=0.002),
            cylinder(name + "_hub", 0.022, 0.027, c, (math.radians(90), 0, 0), M["plastic"]),
        ]
        fan = join_parts(name, fparts, M["plastic"])
        set_origin(fan, c)
        set_parent(fan, grp_fans)
        fan["display_name"] = name.replace("CASE_", "Case ").replace("_", " ").title()

    # ---- CABLES (blockout tubes, origin at PSU end) ------------------------
    cable_specs = [
        ("CABLE_24PIN", [(0.075, 0.150, 0.090), (0.0995, 0.000, 0.055), (0.0995, -0.110, 0.140), (0.0830, -0.105, 0.165)], 0.011),
        ("CABLE_CPU_POWER", [(0.060, 0.170, 0.088), (0.0995, 0.200, 0.250), (0.0995, 0.190, 0.360), (0.0830, 0.150, 0.348)], 0.006),
        ("CABLE_GPU_POWER", [(0.010, 0.090, 0.088), (-0.012, 0.105, 0.145), (-0.020, 0.125, 0.190)], 0.007),
    ]
    for name, pts, bd in cable_specs:
        cobj = cable(name, pts, bd, M["cable"])
        set_parent(cobj, grp_cables)
        cobj["display_name"] = name.replace("CABLE_", "").replace("_", " ").title() + " Cable"

    # ---- Disassembly manifest: scene metadata + JSON file ------------------
    for name, (stage_i, axis, dist) in OBJECT_STAGE.items():
        o = bpy.data.objects.get(name)
        if o:
            o["stage_index"] = stage_i
            o["extract_axis"] = axis
            o["extract_distance"] = dist
    root["disassembly_manifest"] = json.dumps({"stages": [s["id"] for s in MANIFEST["stages"]]})
    txt = bpy.data.texts.new("DISASSEMBLY_MANIFEST.json")
    txt.write(json.dumps(MANIFEST, indent=2))
    with open(OUT_MANIFEST, "w", encoding="utf-8") as f:
        json.dump(MANIFEST, f, indent=2)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, check_existing=False)
    print("BUILD_OK ->", OUT_BLEND)
    print("MANIFEST_OK ->", OUT_MANIFEST)


if __name__ == "__main__":
    build()
