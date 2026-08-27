"""Phase D+E - semantic + animation validation of the MASTER GLB.

Imports build/export/pc_anatomy_master.glb into a FRESH scene, then:
  D) verifies all required nodes exist with untransformed names and that the
     component hierarchy/group roots survive;
  E) verifies the exported animation inventory (names + frame ranges) and
     samples node poses at the same reference frames recorded from Blender
     (build/export/_blender_ref.json), comparing world translations.

Read-only: never touches build/animated.blend.
Run:  blender -b -P scripts/verify_glb.py --python-exit-code 9
"""
import bpy
import json
import os
import math
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# optional CLI override: blender -b -P verify_glb.py -- <path-to-glb>
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = argv[0] if argv else os.path.join(ROOT, "build", "export",
                                         "pc_anatomy_master.glb")
REF_JSON = os.path.join(ROOT, "build", "export", "_blender_ref.json")
print("SEM_VERIFY_TARGET", GLB)

REQUIRED = ["CASE", "CASE_SIDE_PANEL", "MOTHERBOARD", "CPU", "CPU_COOLER",
            "RAM_01", "RAM_02", "RAM_03", "RAM_04", "GPU", "M2_SSD",
            "STORAGE", "PSU", "CASE_FAN_01", "CASE_FAN_02", "CASE_FAN_03",
            "CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER"]
EXTRA = ["CABLE_24PIN_CONN_MB", "CABLE_24PIN_CONN_PSU",
         "CABLE_CPU_POWER_CONN_MB", "CABLE_CPU_POWER_CONN_PSU",
         "CABLE_GPU_POWER_CONN_GPU", "CABLE_GPU_POWER_CONN_PSU"]
GROUPS = ["PC_ROOT", "CABLES", "FANS", "RAM"]
EXPECT_PARENT = {"CASE_SIDE_PANEL": "CASE", "RAM_01": "RAM", "RAM_02": "RAM",
                 "RAM_03": "RAM", "RAM_04": "RAM", "CASE_FAN_01": "FANS",
                 "CASE_FAN_02": "FANS", "CASE_FAN_03": "FANS",
                 "CABLE_24PIN": "CABLES", "CABLE_CPU_POWER": "CABLES",
                 "CABLE_GPU_POWER": "CABLES",
                 "CABLE_24PIN_CONN_MB": "CABLE_24PIN",
                 "CABLE_24PIN_CONN_PSU": "CABLE_24PIN",
                 "CABLE_CPU_POWER_CONN_MB": "CABLE_CPU_POWER",
                 "CABLE_CPU_POWER_CONN_PSU": "CABLE_CPU_POWER",
                 "CABLE_GPU_POWER_CONN_GPU": "CABLE_GPU_POWER",
                 "CABLE_GPU_POWER_CONN_PSU": "CABLE_GPU_POWER"}
EXPECTED_ANIMS = sorted(
    ["PC_Disassembly_" + n for n in
     ("CASE_SIDE_PANEL", "CPU", "CPU_COOLER", "CASE_FAN_01", "CASE_FAN_02",
      "CASE_FAN_03", "GPU", "M2_SSD", "MOTHERBOARD", "PSU", "RAM_01",
      "RAM_02", "RAM_03", "RAM_04", "STORAGE")] +
    ["PC_Disassembly_CABLE_24PIN_flex",
     "PC_Disassembly_CABLE_CPU_POWER_flex",
     "PC_Disassembly_CABLE_GPU_POWER_flex",
     "PC_Disassembly_CABLE_24PIN_CONN_MB_disconnect",
     "PC_Disassembly_CABLE_CPU_POWER_CONN_MB_disconnect",
     "PC_Disassembly_CABLE_GPU_POWER_CONN_GPU_disconnect"])

failures = []


def check(ok, label, detail=""):
    print(("SEM_PASS " if ok else "SEM_FAIL ") + label +
          (("  [" + detail + "]") if detail else ""))
    if not ok:
        failures.append(label)


# --- import -----------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=GLB)
new_objs = [o for o in bpy.data.objects if o not in before]
names = {o.name for o in new_objs}
print("SEM imported_objects", len(new_objs))

# Blender 5.2 importer artifact: meshes carrying quantized/meshopt-compressed
# data on ANIMATED nodes are re-parented to a child object named "<X>.001"
# under an empty that keeps the canonical node name.  This is an importer-
# side split (WebGL runtimes keep a single node); the GLB node structure
# itself is validated separately via gltf-transform.  The checks below
# resolve the canonical node and its mesh carrier in both layouts.
by_name = {o.name: o for o in new_objs}


def mesh_carrier(o):
    if o.type == "MESH":
        return o
    ch = by_name.get(o.name + ".001")
    if ch is not None and ch.type == "MESH" and ch.parent is o:
        return ch
    return None


# D: required nodes + exact names (no exporter rename tolerance)
for n in REQUIRED + EXTRA + GROUPS:
    check(n in names, f"node:{n}")
expected_set = set(REQUIRED + EXTRA + GROUPS)
split_meshes = {n + ".001" for n in expected_set}
unexpected = sorted(nm for nm in names - expected_set
                    if nm not in split_meshes)
check(not unexpected, "no_unexpected_nodes", str(unexpected))

# D: hierarchy (canonical nodes; empties in the split layout)
objs = {n: by_name[n] for n in expected_set if n in by_name}
for child, parent in EXPECT_PARENT.items():
    if child in objs and parent in objs:
        check(objs[child].parent is objs[parent], f"hierarchy:{child}->{parent}")

# D: meshes separable (one mesh per selectable component, no merged blob)
mesh_nodes = [o for o in new_objs if o.type == "MESH"]
check(len(mesh_nodes) >= 25, "mesh_node_count", f"{len(mesh_nodes)}")

# D: materials
mats = sorted(m.name for m in bpy.data.materials)
print("SEM materials", len(mats), mats)
check(len(mats) >= 17, "material_count", f"{len(mats)}")
check("MAT_CABLE_SLEEVE" in mats and "MAT_CONNECTOR" in mats,
      "cable_materials_present")

# E: animation inventory
anim_names = sorted(a.name for a in bpy.data.actions)
print("SEM glb_actions", len(anim_names))
for a in EXPECTED_ANIMS:
    hit = a in anim_names
    check(hit, f"animation:{a}")
missing = set(EXPECTED_ANIMS) - set(anim_names)
extra = set(anim_names) - set(EXPECTED_ANIMS)
if extra:
    print("SEM extra_actions", sorted(extra))

# E: action frame ranges (import maps glTF seconds -> frames at scene fps).
# Blender 5.2 glTF import parks the actions in MUTED NLA tracks; even when
# unmuted, the 5.2 slotted-NLA strips do not evaluate on frame_set here, so
# re-bind each action DIRECTLY to its AnimData, selecting the action slot
# for the ANIMATED datablock type ("OB" object slot vs "KE" shape-key slot
# - the flex actions carry both).  A WebGL runtime plays the GLB animations
# directly, so this is a verification-environment fix only.
def direct_bind(ad, prefix):
    if not ad:
        return
    act = None
    for tr in ad.nla_tracks:
        for s in tr.strips:
            act = s.action
    if act is None:
        return
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    ad.action = act
    if act.slots:
        slot = None
        for sl in act.slots:
            if sl.identifier.startswith(prefix):
                slot = sl
                break
        if slot is None:
            slot = act.slots[0]
        try:
            ad.action_slot = slot
        except Exception:
            pass


for o in new_objs:
    direct_bind(o.animation_data, "OB")
for me in bpy.data.meshes:
    if me.shape_keys:
        direct_bind(me.shape_keys.animation_data, "KE")

sc = bpy.context.scene
for o in new_objs:
    ad = o.animation_data
    if ad and ad.action:
        fr = ad.action.frame_range
        print(f"SEM_ACTIONRANGE {o.name} {ad.action.name} {fr[0]:.2f}-{fr[1]:.2f}")
    elif ad:
        for tr in ad.nla_tracks:
            for st in tr.strips:
                print(f"SEM_NLARANGE {o.name} {st.action.name} "
                      f"{st.frame_start:.2f}-{st.frame_end:.2f}")

# E: sampled pose comparison against the Blender reference dump
with open(REF_JSON) as fh:
    ref = json.load(fh)
sc.render.fps = 24
sc.frame_start, sc.frame_end = 1, 974    # frame_set clamps to scene range
TOL = 0.0015          # 1.5 mm (linear import interpolation vs eased source)
TOL_CABLE = 0.004     # 4 mm for morph-derived cable nodes at exact key frames
CABLE_NODES = {"CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER"}
worst = (0.0, "", 0)
for fs, pose in sorted(ref["frames"].items(), key=lambda kv: int(kv[0])):
    f = int(fs)
    sc.frame_set(f)
    bpy.context.view_layer.update()
    for n, exp in pose.items():
        if "." in n:                       # curve bezier tips are not nodes
            continue
        o = objs.get(n)
        if o is None:
            continue
        t = o.matrix_world.translation
        err = math.dist((t.x, t.y, t.z), exp)
        tol = TOL_CABLE if n in CABLE_NODES else TOL
        if err > worst[0]:
            worst = (err, n, f)
        check(err <= tol, f"pose:{n}@{f}", f"err={err * 1000:.2f}mm")
print(f"SEM worst_pose_error {worst[0] * 1000:.2f} mm at {worst[1]}@{worst[2]}")

# E: cable morph weights at the disconnect milestones (in-memory cable meshes
# carried per-frame shape keys; weights must select the right target shape)
MILE = {"CABLE_24PIN": ((140, 0), (146, 146), (158, 158), (160, 158), (974, 158)),
        "CABLE_CPU_POWER": ((144, 0), (150, 150), (160, 160), (162, 160), (974, 160)),
        "CABLE_GPU_POWER": ((146, 0), (152, 152), (162, 162), (164, 162), (974, 162))}
for cab, pairs in MILE.items():
    o = objs.get(cab)
    carrier = mesh_carrier(o) if o is not None else None
    if carrier is None or carrier.data is None or not carrier.data.shape_keys:
        check(False, f"shapekeys:{cab}")
        continue
    sks = carrier.data.shape_keys.key_blocks
    print(f"SEM_SHAPEKEYS {cab} count={len(sks) - 1}")
    for f, expect_on in pairs:
        sc.frame_set(f)
        bpy.context.view_layer.update()
        on = [sk.name for sk in sks[1:] if sk.value > 0.5]
        exp = [f"f{expect_on}"] if expect_on else []
        check(on == exp, f"morph:{cab}@{f}", f"on={on} expect={exp}")

print("SEM_RESULT failures:", len(failures))
print("SEM_DONE")
