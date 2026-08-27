"""READ-ONLY cable/board diagnostic visualization for build/animated.blend.

Adds render-only overlays IN MEMORY (halo tubes on the three power cables and
their connector children, text labels, frame counter, legend, dedicated
close-up camera) and renders frames 140-185.  The source blend is NEVER saved
back; no asset data (meshes, curves, materials, keyframes, hierarchy) is
modified - overlay materials are linked at OBJECT slot level only.

Modes:
  preview  - 3 stills to validate camera framing
  full     - 51 stills + contact sheet + MP4

Run:  blender -b build/animated.blend --python scripts/render_cable_diag.py -- preview
      blender -b build/animated.blend --python scripts/render_cable_diag.py -- full
Out:  build/diag/
"""
import bpy
import os
import sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "diag")
F0, F1 = 140, 190
SHEET_FRAMES = [140, 146, 152, 158, 164, 172, 178, 184, 190]
RES = (960, 720)

MODE = "preview"
if "--" in sys.argv:
    MODE = sys.argv[sys.argv.index("--") + 1] if len(sys.argv) > sys.argv.index("--") + 1 else "preview"

CABLE_COLOR = {
    "CABLE_24PIN": (0.0, 0.8, 1.0),
    "CABLE_CPU_POWER": (1.0, 0.45, 0.05),
    "CABLE_GPU_POWER": (1.0, 0.1, 0.8),
}
CONN_OF = {
    "CABLE_24PIN": ("CABLE_24PIN_CONN_MB", "CABLE_24PIN_CONN_PSU"),
    "CABLE_CPU_POWER": ("CABLE_CPU_POWER_CONN_MB", "CABLE_CPU_POWER_CONN_PSU"),
    "CABLE_GPU_POWER": ("CABLE_GPU_POWER_CONN_GPU", "CABLE_GPU_POWER_CONN_PSU"),
}

sc = bpy.context.scene


def emis_mat(name, color, alpha=1.0, strength=2.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    if alpha < 1.0:
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs["Fac"].default_value = alpha
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
        try:
            m.blend_method = "BLEND"
        except Exception:
            pass
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    else:
        nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


diag = bpy.data.collections.new("DIAG")
sc.collection.children.link(diag)


def link_only(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    diag.objects.link(o)


def no_shadow(o):
    try:
        o.visible_shadow = False
    except Exception:
        pass


# --- halo overlays: fatter translucent emissive tubes around cable curves ---
for cab, col in CABLE_COLOR.items():
    src = bpy.data.objects[cab]
    halo = src.copy()
    halo.data = src.data.copy()
    halo.name = "DIAG_hal_" + cab
    try:
        if halo.data.bevel_depth > 0:
            halo.data.bevel_depth *= 1.8
        else:
            halo.data.bevel_depth = 0.007
    except Exception:
        pass
    m = emis_mat("DIAGM_hal_" + cab, col, alpha=0.40)
    halo.data.materials.clear()
    halo.data.materials.append(m)
    link_only(halo)
    no_shadow(halo)
    for cn in CONN_OF[cab]:
        co = bpy.data.objects[cn]
        sh = co.copy()                      # shares mesh; material via object slot
        sh.name = "DIAG_hal_" + cn
        sh.scale = co.scale * 1.25
        slot = sh.material_slots[0]
        slot.link = "OBJECT"
        slot.material = emis_mat("DIAGM_hal_" + cn, col, alpha=0.45)
        link_only(sh)
        no_shadow(sh)

# --- text labels (parented so they track their part) -------------------------
WHITE = emis_mat("DIAGM_txt", (1, 1, 1), strength=1.5)


def label(name, text, world, parent=None, size=0.022, mat=WHITE):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    o = bpy.data.objects.new(name, cu)
    o.location = world
    diag.objects.link(o)
    if parent is not None:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    # face the camera direction (camera is static); set after camera exists
    no_shadow(o)
    cu.materials.append(mat)
    return o


LABELS = [
    label("DIAG_t_mb", "MOTHERBOARD", (0.06, 0.105, 0.365), bpy.data.objects["MOTHERBOARD"]),
    label("DIAG_t_gpu", "GPU", (-0.02, -0.09, 0.225), bpy.data.objects["GPU"]),
    label("DIAG_t_24", "24PIN", (0.02, -0.13, 0.17), bpy.data.objects["CABLE_24PIN"]),
    label("DIAG_t_cpu", "CABLE_CPU_POWER", (-0.06, 0.13, 0.40), bpy.data.objects["CABLE_CPU_POWER"]),
    label("DIAG_t_gpup", "CABLE_GPU_POWER", (-0.14, 0.06, 0.28), bpy.data.objects["CABLE_GPU_POWER"]),
    label("DIAG_t_c24", "24PIN_CONN", (0.045, -0.095, 0.095), bpy.data.objects["CABLE_24PIN_CONN_MB"], 0.013),
    label("DIAG_t_ccpu", "CPUPWR_CONN_MB", (0.05, 0.095, 0.335), bpy.data.objects["CABLE_CPU_POWER_CONN_MB"], 0.013),
    label("DIAG_t_cgpu", "GPUPWR_CONN_GPU", (-0.09, 0.10, 0.20), bpy.data.objects["CABLE_GPU_POWER_CONN_GPU"], 0.013),
]

# --- dedicated close-up camera (open side, -X looking +X: board travel comes
#     toward camera, -Y swing reads as screen-right) ---------------------------
cd = bpy.data.cameras.new("DIAG_cam")
cam = bpy.data.objects.new("DIAG_cam", cd)
diag.objects.link(cam)
cd.lens = 40
CAM_LOC = Vector((-0.64, -0.44, 0.57))
CAM_TGT = Vector((-0.05, 0.02, 0.26))
cam.location = CAM_LOC
cam.rotation_euler = (CAM_TGT - CAM_LOC).to_track_quat("-Z", "Y").to_euler()
sc.camera = cam

for o in LABELS:
    d = cam.location - o.matrix_world.translation
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()

# --- camera-attached frame counter + legend ----------------------------------
counter_cu = bpy.data.curves.new("DIAG_counter", "FONT")
counter_cu.body = "FRAME 000"
counter_cu.size = 0.018
counter_cu.align_x = "RIGHT"
counter = bpy.data.objects.new("DIAG_counter", counter_cu)
diag.objects.link(counter)
counter.parent = cam
counter.location = (0.16, -0.105, -0.42)
counter_cu.materials.append(WHITE)
no_shadow(counter)

legend_specs = [("DIAG_leg1", "CYAN = 24PIN", (0.0, 0.8, 1.0)),
                ("DIAG_leg2", "ORANGE = CPU PWR", (1.0, 0.45, 0.05)),
                ("DIAG_leg3", "MAGENTA = GPU PWR", (1.0, 0.1, 0.8))]
for i, (nm, tx, col) in enumerate(legend_specs):
    cu = bpy.data.curves.new(nm, "FONT")
    cu.body = tx
    cu.size = 0.012
    cu.align_x = "LEFT"
    o = bpy.data.objects.new(nm, cu)
    diag.objects.link(o)
    o.parent = cam
    o.location = (-0.165, -0.075 - i * 0.02, -0.42)
    cu.materials.append(emis_mat("DIAGM_" + nm, col, strength=1.5))
    no_shadow(o)

# --- render settings ---------------------------------------------------------
try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    sc.render.engine = "BLENDER_EEVEE"
try:
    sc.eevee.taa_samples = 64
    sc.eevee.taa_render_samples = 64
    sc.eevee.use_raytracing = False
    sc.eevee.shadow_ray_count = 2
except Exception:
    pass
sc.render.resolution_x, sc.render.resolution_y = RES
sc.render.image_settings.file_format = "PNG"
try:
    sc.view_settings.view_transform = "Khronos PBR Neutral"
except Exception:
    pass
os.makedirs(OUT, exist_ok=True)


def render_stills(frames):
    for f in frames:
        sc.frame_set(f)
        counter_cu.body = f"FRAME {f}"
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(OUT, f"still_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("DIAG_STILL", f)


if MODE == "preview":
    render_stills([140, 158, 180])
    print("DIAG_PREVIEW_DONE")
else:
    render_stills(list(range(F0, F1 + 1)))
    print("DIAG_STILLS_DONE")

    # --- contact sheet: 3x3 grid of the required frames, 480x360 tiles -------
    import numpy as np
    TW, TH = 480, 360
    cols, rows = 3, 3
    sheet = np.zeros((rows * TH, cols * TW, 4), dtype=np.float32)
    for idx, f in enumerate(SHEET_FRAMES):
        img = bpy.data.images.load(os.path.join(OUT, f"still_{f:04d}.png"))
        w, h = img.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(buf)
        a = buf.reshape(h, w, 4)[::2, ::2, :]          # 960x720 -> 480x360
        a = a[:TH, :TW, :]
        a[:, :, 3] = 1.0
        r, c = divmod(idx, cols)                        # r=0 top row
        y0 = (rows - 1 - r) * TH                        # pixels are bottom-up
        sheet[y0:y0 + TH, c * TW:c * TW + TW, :] = a
        bpy.data.images.remove(img)
    sh = bpy.data.images.new("DIAG_sheet", cols * TW, rows * TH, alpha=True)
    sh.pixels.foreach_set(sheet.ravel())
    sh.filepath_raw = os.path.join(OUT, "contact_sheet_140-190.png")
    sh.file_format = "PNG"
    sh.save()
    print("DIAG_SHEET_DONE")

    # --- MP4 encode via sequencer (same scene, strips override 3D) ----------
    se = sc.sequence_editor_create()
    for f in range(F0, F1 + 1):
        se.strips.new_image(name=f"diag_{f}",
                            filepath=os.path.join(OUT, f"still_{f:04d}.png"),
                            channel=1, frame_start=f)
    sc.frame_start, sc.frame_end = F0, F1
    sc.render.fps = 24
    sc.render.image_settings.media_type = "VIDEO"
    sc.render.image_settings.file_format = "FFMPEG"
    sc.render.ffmpeg.format = "MPEG4"
    sc.render.ffmpeg.codec = "H264"
    sc.render.ffmpeg.constant_rate_factor = "HIGH"
    sc.render.ffmpeg.gopsize = 12
    sc.render.filepath = os.path.join(OUT, "cable_diag_")
    bpy.ops.render.render(animation=True)
    for fn in os.listdir(OUT):
        if fn.startswith("cable_diag_") and fn.endswith(".mp4"):
            os.replace(os.path.join(OUT, fn),
                       os.path.join(OUT, "cable_diag_140-190.mp4"))
            break
    print("DIAG_FULL_DONE")
