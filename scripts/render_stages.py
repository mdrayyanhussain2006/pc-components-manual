"""Animation stage stills: renders each stage's PARK pose from animated.blend.

Read-only on the animation data — this script only scrubs the timeline
(sc.frame_set) and adds render staging helpers (ground/lights/camera).
It never touches object transforms and does NOT save the blend back.

Run:  blender -b build/animated.blend --python scripts/render_stages.py
Out:  build/previews_animation/*.png
"""
import json
import os
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "build", "previews_animation")
STAGES_PATH = os.path.join(ROOT, "build", "animation_stages.json")
RES_X, RES_Y = 1152, 864

# camera rig reused from the polish pass (render_previews.py)
CAM_A = ((-0.92, -0.92, 0.66), (0.0, 0.0, 0.20))       # 3/4 front-left
CAM_B = ((-1.05, -0.14, 0.38), (0.0, 0.0, 0.22))        # open side
CAM_B2 = ((-1.28, -0.36, 0.52), (-0.22, 0.02, 0.22))    # side, pulled back
CAM_B3 = ((-0.95, -0.50, 0.05), (-0.32, 0.02, 0.17))    # low 3/4, GPU fan side
CAM_C = ((-1.90, -1.35, 1.60), (0.00, 0.30, 0.26))      # high front-left, wide

with open(STAGES_PATH, "r", encoding="utf-8") as f:
    META = json.load(f)
PARK = {s["id"]: s.get("park", s.get("end")) for s in META["stages"]}

# (file name, stage id, frame override, camera) — frame = stage park pose
SHOTS = [
    ("01_assembled", "ASSEMBLED", 12, CAM_A),
    ("02_open_case", "OPEN_CASE", None, CAM_B),
    ("03_motherboard_out", "MOTHERBOARD_OUT", None, CAM_B2),
    ("04_cpu_cooler_out", "CPU_COOLER_OUT", None, CAM_B2),
    ("05_cpu_out", "CPU_OUT", None, CAM_B2),
    ("06_ram_out", "RAM_OUT", None, CAM_B2),
    ("07_gpu_out", "GPU_OUT", None, CAM_B3),
    ("08_storage_out", "STORAGE_OUT", None, CAM_B2),
    ("09_psu_out", "PSU_OUT", None, CAM_C),
    ("10_secondary_out", "SECONDARY_OUT", None, CAM_C),
    ("11_final_explode", "FINAL_EXPLODE", None, CAM_C),
]


def make_stage(sc):
    """Ground, lights, camera in a dedicated STAGE collection."""
    coll = bpy.data.collections.new("STAGE")
    sc.collection.children.link(coll)

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.001))
    ground = bpy.context.active_object
    ground.name = "_Ground"
    for c in list(ground.users_collection):
        c.objects.unlink(ground)
    coll.objects.link(ground)
    gm = bpy.data.materials.new("MAT_GROUND")
    gm.use_nodes = True
    b = gm.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.035, 0.037, 0.042, 1)
    b.inputs["Roughness"].default_value = 0.80
    ground.data.materials.append(gm)

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
    old = bpy.data.collections.get("STAGE")
    if old:
        for o in list(old.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    try:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        sc.render.engine = "BLENDER_EEVEE"
    try:
        sc.eevee.taa_samples = 128
        sc.eevee.taa_render_samples = 256
        sc.eevee.use_raytracing = False
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
    try:
        sc.view_settings.view_transform = "Khronos PBR Neutral"
    except Exception:
        sc.view_settings.view_transform = "Standard"

    cam = make_stage(sc)
    os.makedirs(OUT_DIR, exist_ok=True)

    for shot_name, stage_id, frame_override, (loc, tgt) in SHOTS:
        frame = frame_override if frame_override is not None else PARK[stage_id]
        sc.frame_set(frame)
        cam.location = loc
        direction = Vector(tgt) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(OUT_DIR, shot_name + ".png")
        bpy.ops.render.render(write_still=True)
        print("RENDER_OK", shot_name, "frame", frame)

    print("RENDER_ALL_DONE")


if __name__ == "__main__":
    main()
