# EXPORT-ONLY triangle reduction.
# Reads the VALIDATED MASTER GLB (never the Blender sources), decimates
# selected meshes per material-part (components/primitives are NEVER
# merged), keeps cable shape-key meshes untouched, re-exports a
# candidate GLB. Source .blend files are not opened by this script.
import bpy
import bmesh
import math
import mathutils
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = ROOT + r"\build\export\pc_anatomy_master.glb"
OUT = ROOT + r"\build\export\pc_anatomy_web_reduced.glb"
MAX_TRIS = 60000

# per-mesh decimate ratio (1.0 = keep untouched)
RATIO = {
    "MOTHERBOARD": 0.30,
    "GPU": 0.50,
    "CPU_COOLER": 0.30,
    "CASE": 0.40,
    "PSU": 0.55,
    "CASE_FAN_01": 0.22,
    "CASE_FAN_02": 0.22,
    "CASE_FAN_03": 0.22,
    "RAM_01": 0.70, "RAM_02": 0.70, "RAM_03": 0.70, "RAM_04": 0.70,
    "M2_SSD": 0.70,
    "STORAGE": 0.70,
}

# ---------------------------------------------------------------- import
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=MASTER)
print("IMPORTED", len(bpy.data.objects), "objects")


def tri_count(me):
    return sum(1 for p in me.polygons if len(p.vertices) == 3) + \
           sum(len(p.vertices) - 2 for p in me.polygons if len(p.vertices) > 3)


total_before = sum(tri_count(o.data) for o in bpy.data.objects
                   if o.type == "MESH")
print("TRIS_BEFORE", total_before)


# ------------------------------------------------------------ decimation
def decimate_obj(o, ratio):
    me = o.data
    name = o.name
    if me.shape_keys:
        print(f"SKIP_SHAPEKEYS {name}")
        return
    mats = [m for m in o.material_slots]

    # split per material slot so glTF primitives stay separate
    parts = []
    for mi in range(len(mats)):
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        keep = [f for f in bm.faces if f.material_index == mi]
        if not keep:
            bm.free()
            continue
        drop = [f for f in bm.faces if f.material_index != mi]
        bmesh.ops.delete(bm, geom=drop, context="FACES")
        nme = bpy.data.meshes.new(f"{name}_part{mi}")
        bm.to_mesh(nme)
        bm.free()
        po = bpy.data.objects.new(f"{name}_part{mi}", nme)
        po.matrix_world = o.matrix_world
        bpy.context.collection.objects.link(po)
        po.data.materials.append(mats[mi].material)
        parts.append((po, mi))

    # shading normals from the original mesh
    me.calc_normals_split() if hasattr(me, "calc_normals_split") else None
    for po, mi in parts:
        dt = po.modifiers.new("NT", "DATA_TRANSFER")
        dt.object = o
        dt.use_loop_data = True
        dt.loop_mapping = "NEAREST_POLYNOR"
        dt.data_types_loops = {"CUSTOM_NORMAL"}
        bpy.context.view_layer.objects.active = po
        bpy.ops.object.modifier_apply(modifier="NT")

    # planar collapse per part
    for po, mi in parts:
        dm = po.modifiers.new("DC", "DECIMATE")
        dm.decimate_type = "COLLAPSE"
        dm.ratio = ratio
        dm.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = po
        bpy.ops.object.modifier_apply(modifier="DC")

    # rejoin parts. IMPORTANT: rebuild geometry INTO the original object
    # (never ops.join, which would delete the animated original) so the
    # object's AnimData/NLA tracks, name, transform and parenting survive.
    bmo = bmesh.new()
    rel = o.matrix_world.inverted_safe()
    for po, mi in parts:
        po.data.transform(rel @ po.matrix_world)
        n0 = len(bmo.faces)
        bmo.from_mesh(po.data)          # appends geometry
        bmo.faces.ensure_lookup_table()
        for i in range(n0, len(bmo.faces)):
            bmo.faces[i].material_index = mi
    bmo.to_mesh(me)
    me.update()
    bmo.free()
    me.name = name
    for po, mi in parts:
        d = po.data
        bpy.data.objects.remove(po, do_unlink=True)
        bpy.data.meshes.remove(d, do_unlink=True)
    nt = tri_count(me)
    print(f"DECIMATED {name} -> {nt} tris")
    return nt


results = {}
for nm in list(RATIO):
    o = bpy.data.objects.get(nm)
    r = RATIO[nm]
    if o is None or o.type != "MESH" or r >= 1.0:
        continue
    results[nm] = decimate_obj(o, r)

total_after = sum(tri_count(o.data) for o in bpy.data.objects
                  if o.type == "MESH")
print("TRIS_AFTER", total_after)
assert total_after < MAX_TRIS, f"still {total_after} tris"

# ------------------------------------------------------------- re-export
sc = bpy.context.scene
sc.render.fps = 24
sc.frame_start = 1
sc.frame_end = 974

bpy.ops.object.select_all(action="DESELECT")
root = bpy.data.objects.get("PC_ROOT")
assert root is not None, "PC_ROOT missing after import"
# the imported scene holds exactly the master's 29 export nodes
# (master was exported without cameras/lights); select all of them.
for o in bpy.data.objects:
    assert not o.name.endswith(".001") and "_part" not in o.name, o.name
    assert o.type in ("MESH", "EMPTY"), (o.name, o.type)
    o.select_set(True)
print("EXPORT_SELECTED", sum(1 for o in bpy.data.objects if o.select_get()))

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_force_sampling=True,
    export_frame_range=True,
    export_morph=True,
    export_morph_animation=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
    export_merge_animation="NONE",
    export_optimize_animation_size=False,
    export_extras=True,
)
print("CANDIDATE_WRITTEN", OUT)
print("REDUCE_DONE")
