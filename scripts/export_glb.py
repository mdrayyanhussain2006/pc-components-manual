"""Phase B - MASTER GLB export from build/animated.blend (source is FROZEN).

The source blend is opened, mutated IN MEMORY ONLY (never saved back), and
exported to build/export/pc_anatomy_master.glb.

Key conversion: glTF cannot carry curve-datablock (bezier point) animation,
so the three cable curves are converted to meshes in memory.  Cable flex is
EXACT because bezier-surface evaluation is linear in the control points and
the authored disconnect motion decomposes into the two keyed legs (unplug,
clear):  basis = rest mesh, shape key "unplug" = mesh at unplug frame,
shape key "clear" = mesh at clear frame; per-frame morph weights are solved
by least squares over all sampled frames of the disconnect window and the
max vertex residual is reported.  If the residual exceeds the threshold the
script falls back to one shape key per sampled frame (exact at every key).

Run:  blender -b build/animated.blend -P scripts/export_glb.py --python-exit-code 9
"""
import bpy
import json
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "build", "export")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_GLB = os.path.join(OUT_DIR, "pc_anatomy_master.glb")
REF_JSON = os.path.join(OUT_DIR, "_blender_ref.json")

MAX_RESIDUAL = 0.0005  # 0.5 mm max vertex error for the 2-shape-key fit

sc = bpy.context.scene
F0, F1 = sc.frame_start, sc.frame_end
FPS = sc.render.fps

# disconnect windows (a=first key, b=unplug done, c=clear begin, d=clear done)
CABLES = {
    "CABLE_24PIN":     (140, 146, 148, 158),
    "CABLE_CPU_POWER": (144, 150, 150, 160),
    "CABLE_GPU_POWER": (146, 152, 152, 162),
}

print("EXPORT begin", bpy.app.version_string, "frames", F0, F1, "fps", FPS)

# ---------------------------------------------------------------------------
# 1) Blender reference dump (BEFORE any in-memory mutation) - used by Phase E
#    to compare GLB-sampled poses against the source of truth.
# ---------------------------------------------------------------------------
pc_root = bpy.data.objects["PC_ROOT"]


def descendants(o):
    yield o
    for ch in o.children:
        yield from descendants(ch)


NODES = [o.name for o in descendants(pc_root)]
REF_FRAMES = sorted({1, 24, 124, 132, 140, 144, 146, 148, 150, 152, 158,
                     160, 162, 170, 177, 180, 190, 222, 308, 382, 470, 550,
                     640, 722, 798, 844, 882, 930, 974})

ref = {"fps": FPS, "frames": {}}
for f in REF_FRAMES:
    sc.frame_set(f)
    bpy.context.view_layer.update()
    pose = {}
    for n in NODES:
        t = bpy.data.objects[n].matrix_world.translation
        pose[n] = (round(t.x, 6), round(t.y, 6), round(t.z, 6))
    # cable sleeve terminal bezier points (world) - lost after mesh conversion
    for cab in CABLES:
        cu = bpy.data.objects[cab]
        for pi, bp in enumerate(cu.data.splines[0].bezier_points):
            w = cu.matrix_world @ bp.co
            pose[f"{cab}.pt{pi}"] = (round(w.x, 6), round(w.y, 6), round(w.z, 6))
    ref["frames"][str(f)] = pose
with open(REF_JSON, "w") as fh:
    json.dump(ref, fh)
print("EXPORT ref_dump", REF_JSON, "nodes", len(NODES), "frames", len(REF_FRAMES))

# ---------------------------------------------------------------------------
# 2) cable curve -> mesh + shape keys (in memory only)
# ---------------------------------------------------------------------------


def eval_verts(obj, frame):
    sc.frame_set(frame)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    oe = obj.evaluated_get(dg)
    me = oe.to_mesh()
    verts = np.array([tuple(v.co) for v in me.vertices], dtype=np.float64)
    oe.to_mesh_clear()
    return verts


for cab, (fa, fb, fc, fd) in CABLES.items():
    o = bpy.data.objects[cab]
    # rest-pose facts captured BEFORE any in-memory mutation: if the source
    # curve object has a NON-IDENTITY parent inverse, its keyed locations are
    # world-keyed; the replacement node (identity inverse) needs parent-local
    # keys, rebased by the same constant offset the connector recipe uses.
    loc_off = (o.matrix_basis.translation - o.matrix_world.translation).copy()
    # free the flex action name: the original curve-datablock action is
    # orphaned by the mesh conversion below; rename it in memory so the
    # exported morph animation keeps the exact authored name (no .001 suffix)
    old_act = o.data.animation_data.action if o.data.animation_data else None
    if old_act is not None:
        old_act.name = cab + "_curve_src"
    basis = eval_verts(o, F0)
    m_unplug = eval_verts(o, fb)
    m_clear = eval_verts(o, fd)
    frames = list(range(fa, fd + 1))
    # to_mesh() evaluates in OBJECT-LOCAL space; the source flex action ALSO
    # keys the cable's own location channel, which stays on the node
    # transform (carrying the connector children) rather than being baked
    # into the vertices, so local shape-key deltas remain valid.
    posed = {f: eval_verts(o, f) for f in frames}

    # per-frame 2-SK least-squares weights: basis + w1*(U-B) + w2*(D-B) ~ M_f
    U = m_unplug - basis
    D = m_clear - basis
    A = np.stack([U.ravel(), D.ravel()], axis=1)
    weights, resid_max = {}, 0.0
    for f in frames:
        bvec = (posed[f] - basis).ravel()
        w, *_ = np.linalg.lstsq(A, bvec, rcond=None)
        fit = (A @ w).reshape(-1, 3)
        resid_max = max(resid_max, float(np.abs(posed[f] - basis - fit).max()))
        weights[f] = (float(w[0]), float(w[1]))
    use_perframe = resid_max > MAX_RESIDUAL
    print(f"EXPORT_FIT {cab} 2sk_max_vertex_residual={resid_max:.6f} m "
          f"mode={'PERFRAME_SK' if use_perframe else 'TWO_SK'}")

    # persistent rest mesh (topology + materials)
    sc.frame_set(F0)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    new_me = bpy.data.meshes.new_from_object(o, depsgraph=dg)
    new_me.name = cab

    # Blender forbids swapping a Mesh datablock onto a CURVE object: create a
    # replacement mesh object carrying the cable's name/transform/children,
    # then unlink the curve (the frozen on-disk file is never saved).
    mo = bpy.data.objects.new(cab, new_me)
    mo.matrix_world = o.matrix_world.copy()
    for c in list(o.users_collection):
        c.objects.link(mo)
    # keep the cable inside its group (CABLES) so hierarchy/selection survive.
    # Deterministic recipe: free object -> exact world -> reparent -> restore
    # world.  Leaves matrix_parent_inverse identity so the glTF exporter reads
    # a clean parent-relative transform.
    par, pinv = o.parent, o.matrix_parent_inverse.copy()
    mw_mo = o.matrix_world.copy()
    if par is not None:
        mo.parent = None
        mo.matrix_world = mw_mo
        mo.parent = par
        mo.matrix_world = mw_mo
    for ch in list(o.children):
        # The source connectors parent with a NON-IDENTITY matrix_parent_inverse
        # (their keyed local locations equal world coordinates).  The glTF
        # exporter has no parent-inverse concept: it reads matrix_basis.  So
        # normalize to identity inverse and rebase the disconnect action's
        # location keys by the same constant offset (deltas unchanged).
        basis_rest = ch.matrix_basis.copy()
        world_rest = ch.matrix_world.copy()
        ch.parent = None
        ch.matrix_parent_inverse.identity()
        ch.matrix_world = world_rest
        ch.parent = mo
        ch.matrix_parent_inverse.identity()
        ch.matrix_world = world_rest
        off = ch.matrix_basis.translation - basis_rest.translation
        ad = ch.animation_data
        if ad and ad.action and off.length > 1e-9:
            for layer in ad.action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            if fc.data_path == "location":
                                for kp in fc.keyframe_points:
                                    kp.co.y += off[fc.array_index]
    old = bpy.data.objects[cab]          # name collision -> auto suffix
    old.name = cab + "_CURVE_SRC"
    mo.name = cab
    for c in old.users_collection:
        c.objects.unlink(old)
    o = mo                               # cable object is now a mesh

    kb = o.shape_key_add(name="Basis")
    if not use_perframe:
        sk_names = ["unplug", "clear"]
        sk_targets = [m_unplug, m_clear]
    else:
        sk_names = [f"f{f}" for f in frames if f > fa]
        sk_targets = [posed[f] for f in frames if f > fa]
    sks = []
    for nm, tgt in zip(sk_names, sk_targets):
        sk = o.shape_key_add(name=nm)
        for i, co in enumerate(tgt):
            sk.data[i].co = tuple(co)
        sks.append(sk)

    # key the morph weights; rename/create the flex action under its
    # authored name so the GLB animation keeps its semantic identity.
    # The source flex action ALSO animates the cable object's own location
    # (the PSU end is pulled out with the PSU): shape keys are relative
    # deltas and cannot carry node translation, so that channel is keyed on
    # the SAME action via the object's slot (Blender 5.2 slotted actions)
    # -> one glTF animation carrying both morph weights and node motion.
    act = bpy.data.actions.new(f"PC_Disassembly_{cab}_flex")
    new_me.shape_keys.animation_data_create().action = act
    o.animation_data_create().action = act
    if not use_perframe:
        sk1, sk2 = sks
        for f in (F0, fa):
            sk1.keyframe_insert("value", frame=f)
            sk2.keyframe_insert("value", frame=f)
        sk1.value = 0.0
        sk2.value = 0.0
        for f in frames:
            sk1.value, sk2.value = weights[f]
            sk1.keyframe_insert("value", frame=f)
            sk2.keyframe_insert("value", frame=f)
        sk1.value, sk2.value = 0.0, 1.0
        sk1.keyframe_insert("value", frame=fd)
        sk2.keyframe_insert("value", frame=fd)
        sk1.keyframe_insert("value", frame=F1)
        sk2.keyframe_insert("value", frame=F1)
    else:
        active = [f for f in frames if f > fa]
        for sk, fk in zip(sks, active):
            sk.value = 0.0
            sk.keyframe_insert("value", frame=F0)
            sk.keyframe_insert("value", frame=fk - 1)
            sk.value = 1.0
            sk.keyframe_insert("value", frame=fk)
            if fk == fd:
                sk.keyframe_insert("value", frame=F1)   # hold cleared shape
            else:
                sk.value = 0.0
                sk.keyframe_insert("value", frame=min(fk + 1, F1))
                sk.keyframe_insert("value", frame=F1)

    # force linear interpolation on the weight curves (5.x slotted actions;
    # in Blender 5.2 strip.channelbags is a collection, not a method)
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                if bag is None:
                    continue
                for fc in bag.fcurves:
                    for kp in fc.keyframe_points:
                        kp.interpolation = "LINEAR"
    print(f"EXPORT_SHAPEKEYS {cab} keys={len(sks)} basis_verts={len(basis)} "
          f"mesh_obj={o.name}")

    # transfer the location channel.  The source keeps ~12 EASED keys per
    # axis; re-keying them linear would distort the in-betweens, so sample
    # the source FCurve per frame (exact eased values) and key linearly.
    nch = 0
    for layer in old_act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for sfc in bag.fcurves:
                    if sfc.data_path != "location":
                        continue
                    idx = sfc.array_index
                    for f in range(F0, F1 + 1):
                        o.location[idx] = sfc.evaluate(float(f)) + loc_off[idx]
                        o.keyframe_insert("location", index=idx, frame=f)
                    nch += 1
    # keyframe_insert returns bool; force linear interpolation in a post-pass
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                if bag is None:
                    continue
                for nfc in bag.fcurves:
                    if nfc.data_path == "location":
                        for kp in nfc.keyframe_points:
                            kp.interpolation = "LINEAR"
    print(f"EXPORT_CABLE_LOC {cab} action={act.name} channels={nch} "
          f"offset={[round(v, 5) for v in loc_off]}")

# ---------------------------------------------------------------------------
# 3) pad the short disconnect actions to the full timeline (rest holds).
#    The exporter slides every clip to t=0; padding keeps ALL clips aligned
#    on the same absolute timeline (no timing shift for the short clips).
# ---------------------------------------------------------------------------
CONN_OF = {"CABLE_24PIN": "CABLE_24PIN_CONN_MB",
           "CABLE_CPU_POWER": "CABLE_CPU_POWER_CONN_MB",
           "CABLE_GPU_POWER": "CABLE_GPU_POWER_CONN_GPU"}


def pad_action(act):
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    pts = sorted(fc.keyframe_points, key=lambda k: k.co.x)
                    k0 = fc.keyframe_points.insert(F0, pts[0].co.y)
                    k0.interpolation = "CONSTANT"
                    k1 = fc.keyframe_points.insert(F1, pts[-1].co.y)
                    k1.interpolation = "CONSTANT"


for cab, conn in CONN_OF.items():
    pad_action(bpy.data.objects[conn].animation_data.action)
    print("EXPORT_PADDED", bpy.data.objects[conn].animation_data.action.name)
# note: the merged flex actions already span the full scene range (morph
# weight keys run F0..F1), so the location channel needs no padding

# ---------------------------------------------------------------------------
# 4) export - only the PC_ROOT subtree (excludes _Ground/_Cam/lights)
# ---------------------------------------------------------------------------
bpy.ops.object.select_all(action="DESELECT")
# select the live PC_ROOT subtree (view layer only - unlinked curve sources
# are excluded automatically)
for vo in bpy.context.view_layer.objects:
    top = vo
    while top.parent is not None:
        top = top.parent
    if top.name == "PC_ROOT":
        vo.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects["PC_ROOT"]
sc.frame_set(F0)
sel = [vo.name for vo in bpy.context.view_layer.objects if vo.select_get()]
print("EXPORT_SELECTED", len(sel), sorted(sel))

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_force_sampling=True,      # exact authored timing, no re-interpolation
    export_frame_range=True,         # all clips span the scene range (sync play)
    export_morph=True,
    export_morph_animation=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
    export_merge_animation="NONE",   # one glTF animation per action (5.2 enum)
    export_optimize_animation_size=False,  # master: keep every sampled key
    export_extras=True,
)
size = os.path.getsize(OUT_GLB)
print("EXPORT_OK", OUT_GLB, "bytes", size)
