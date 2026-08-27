"""Blockout preview renderer: stages the disassembly and renders 7 previews.

Stage 07 (exploded) reads its offsets from build/disassembly_manifest.json so
the preview always matches the formal disassembly architecture (single source
of truth, written by build_blockout.py).

Run:  blender -b build/blockout.blend --python scripts/render_previews.py
      blender -b build/detail.blend    --python scripts/render_previews.py
Out:  build/previews/01..07_*.png (blockout)
      build/previews_detail/01..06_*.png (detail, incl. component closeups)
"""
import json
import os
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_BLEND = bpy.data.filepath
IS_DETAIL = os.path.basename(SRC_BLEND) == "detail.blend"
OUT_DIR = os.path.join(ROOT, "build", "previews_detail" if IS_DETAIL else "previews")
MANIFEST_PATH = os.path.join(ROOT, "build", "disassembly_manifest.json")
RES_X, RES_Y = 1152, 864

MOBO_GROUP = ["MOTHERBOARD", "CPU", "CPU_COOLER", "RAM_01", "RAM_02", "RAM_03", "RAM_04", "M2_SSD"]

CAMS = {
    "A": ((-0.92, -0.92, 0.66), (0.0, 0.0, 0.20)),     # 3/4 front-left
    "B": ((-1.05, -0.14, 0.38), (0.0, 0.0, 0.22)),     # open side
    "B2": ((-1.28, -0.36, 0.52), (-0.22, 0.02, 0.22)),  # side, pulled back
    "B3": ((-0.95, -0.50, 0.05), (-0.32, 0.02, 0.17)),  # low 3/4, sees GPU fan side
    "C": ((-1.90, -1.35, 1.60), (0.00, 0.30, 0.26)),   # high front-left, panned rearward to include PSU
    # detail closeups (used only on detail.blend)
    "D_COOLER": ((-0.45, -0.38, 0.40), (0.045, 0.050, 0.270)),  # fin stack + bladed fan
    "D_GPU": ((-0.42, -0.46, 0.02), (0.022, 0.040, 0.160)),     # shroud fans from below, whole card
    "D_MOBO": ((-0.28, -0.16, 0.40), (0.085, 0.045, 0.265)),    # socket/RAM/caps region
}

PANEL_OUT = {"CASE_SIDE_PANEL": (-0.30, 0.55, 0)}   # set aside, out of camera line
MOBO_OUT = {n: (-0.38, 0, 0) for n in MOBO_GROUP}


def load_explode_offsets():
    """FINAL_EXPLODE park positions from the disassembly manifest (organized
    along each object's own extraction axis)."""
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        man = json.load(f)
    fin = next(s for s in man["stages"] if s["id"] == "FINAL_EXPLODE")
    return {k: tuple(v) for k, v in fin["offsets"].items()}


EXPLODE = load_explode_offsets()

STAGES = [
    ("01_assembled_34", {}, "A"),
    ("02_open_side", dict(PANEL_OUT), "B"),
    ("03_motherboard_out", {**PANEL_OUT, **MOBO_OUT}, "B2"),
    # formal order: cooler is already settled further out before the CPU lifts
    ("04_cpu_out", {**PANEL_OUT, **MOBO_OUT,
                    "CPU_COOLER": (-0.68, 0, 0), "CPU": (-0.56, 0, 0)}, "B2"),
    ("05_ram_out", {**PANEL_OUT, **MOBO_OUT,
                    "CPU_COOLER": (-0.68, 0, 0), "CPU": (-0.56, 0, 0),
                    "RAM_01": (-0.50, 0, 0), "RAM_02": (-0.56, 0, 0),
                    "RAM_03": (-0.62, 0, 0), "RAM_04": (-0.68, 0, 0)}, "B2"),
    ("06_gpu_out", {**PANEL_OUT, "GPU": (-0.45, 0, 0)}, "B3"),
    ("07_exploded", dict(EXPLODE), "C"),
]

# detail pass: same assembled/open framing + component closeups + exploded
STAGES_DETAIL = [
    ("01_assembled_34", {}, "A"),
    ("02_open_side", dict(PANEL_OUT), "B"),
    ("03_closeup_cooler", dict(PANEL_OUT), "D_COOLER"),
    ("04_closeup_gpu", dict(PANEL_OUT), "D_GPU"),
    ("05_closeup_mobo", {**PANEL_OUT,
                         "CPU_COOLER": (-0.68, 0, 0), "CPU": (-0.56, 0, 0)}, "D_MOBO"),
    ("06_exploded", dict(EXPLODE), "C"),
]

if IS_DETAIL:
    STAGES = STAGES_DETAIL


def make_stage(sc):
    """Ground, lights, camera in a dedicated STAGE collection."""
    coll = bpy.data.collections.new("STAGE")
    sc.collection.children.link(coll)

    def link(o):
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.001))
    ground = bpy.context.active_object
    ground.name = "_Ground"
    gm = bpy.data.materials.new("MAT_GROUND")
    gm.use_nodes = True
    b = gm.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.035, 0.037, 0.042, 1)
    b.inputs["Roughness"].default_value = 0.80
    ground.data.materials.append(gm)
    link(ground)

    def area(name, loc, energy, size, color):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.shape = "DISK"
        ld.size = size
        ld.color = color
        o = bpy.data.objects.new(name, ld)
        coll.objects.link(o)
        o.location = loc
        d = Vector((0, 0, 0.22)) - o.location
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        return o

    area("_Key", (-0.9, -0.7, 1.2), 170, 0.7, (1.0, 0.96, 0.92))
    area("_Fill", (-0.7, -1.0, 0.6), 110, 0.6, (0.90, 0.94, 1.0))
    area("_Rim", (0.3, 0.9, 1.0), 150, 0.5, (0.95, 0.97, 1.0))

    cd = bpy.data.cameras.new("_Cam")
    cam = bpy.data.objects.new("_Cam", cd)
    coll.objects.link(cam)
    cd.lens = 50
    sc.camera = cam
    return cam


def main():
    sc = bpy.context.scene
    # idempotency: drop any STAGE helpers from a previous run
    old = bpy.data.collections.get("STAGE")
    if old:
        for o in list(old.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    try:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        try:
            sc.render.engine = "BLENDER_EEVEE"
        except Exception:
            sc.render.engine = "BLENDER_WORKBENCH"
    try:
        sc.eevee.taa_samples = 128
        sc.eevee.taa_render_samples = 256
    except Exception:
        pass
    # NOTE: raytracing left OFF — traced speculars on semi-rough coated metal
    # read as grain in stills; probe/world reflections give a cleaner satin look.
    try:
        sc.eevee.use_raytracing = False
    except Exception:
        pass
    # EEVEE-Next shadow sampling: 1-ray shadows salt full-metal speculars
    # (backplate) with pepper noise; a few rays clean the stills.
    try:
        sc.eevee.shadow_ray_count = 4
        sc.eevee.shadow_step_count = 2
    except Exception:
        pass
    sc.render.resolution_x = RES_X
    sc.render.resolution_y = RES_Y
    sc.render.image_settings.file_format = "PNG"
    sc.render.film_transparent = False

    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.20, 0.22, 0.27, 1)
    bg.inputs[1].default_value = 0.22
    # product-style view transform: keeps the neutral material language readable
    try:
        sc.view_settings.view_transform = "Khronos PBR Neutral"
    except Exception:
        sc.view_settings.view_transform = "Standard"

    cam = make_stage(sc)
    os.makedirs(OUT_DIR, exist_ok=True)

    movable = [o for o in sc.objects if o.type in ("MESH", "CURVE", "EMPTY") and not o.name.startswith("_")]
    snapshot = {o.name: o.location.copy() for o in movable}

    for stage_name, deltas, cam_key in STAGES:
        for o in movable:
            o.location = snapshot[o.name]
        for name, d in deltas.items():
            o = bpy.data.objects.get(name)
            if o:
                o.location = snapshot[name] + Vector(d)
        loc, tgt = CAMS[cam_key]
        cam.location = loc
        direction = Vector(tgt) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(OUT_DIR, stage_name + ".png")
        bpy.ops.render.render(write_still=True)
        print("RENDER_OK", stage_name)

    for o in movable:
        o.location = snapshot[o.name]
    bpy.context.view_layer.update()
    # save back to the blend we were given (blockout or detail)
    bpy.ops.wm.save_as_mainfile(filepath=SRC_BLEND, check_existing=False)
    print("RENDER_ALL_DONE")


if __name__ == "__main__":
    main()
