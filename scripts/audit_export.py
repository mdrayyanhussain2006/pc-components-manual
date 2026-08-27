"""Phase A - read-only pre-export audit of build/animated.blend.

Prints counts, action inventory, timeline info and triangle totals.
NEVER mutates or saves the blend file.

Run:  blender -b build/animated.blend --python scripts/audit_export.py
"""
import bpy

AUDIT_MARKER = "AUDIT_DONE"

sc = bpy.context.scene

print("AUDIT blender_version", bpy.app.version_string)
print("AUDIT scene", sc.name, "frame_start", sc.frame_start,
      "frame_end", sc.frame_end, "fps", sc.render.fps)
dur = (sc.frame_end - sc.frame_start + 1) / sc.render.fps
print(f"AUDIT timeline_frames {sc.frame_end - sc.frame_start + 1} duration {dur:.4f}s")

objs = list(bpy.data.objects)
print("AUDIT object_count", len(objs))
meshes = [o for o in objs if o.type == "MESH"]
curves = [o for o in objs if o.type == "CURVE"]
others = [o for o in objs if o.type not in ("MESH", "CURVE")]
print("AUDIT mesh_count", len(meshes))
print("AUDIT curve_count", len(curves), [o.name for o in curves])
print("AUDIT other_objects", [(o.name, o.type) for o in others])
print("AUDIT material_count", len(bpy.data.materials),
      [m.name for m in bpy.data.materials])

# triangle count: evaluated meshes (curves evaluated with bevel) at rest
sc.frame_set(sc.frame_start)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
tris = 0
for o in meshes + curves:
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    me.calc_loop_triangles()
    tris += len(me.loop_triangles)
    oe.to_mesh_clear()
print("AUDIT triangle_count", tris)

# action inventory
acts = sorted(bpy.data.actions, key=lambda a: a.name)
print("AUDIT action_count", len(acts))
for a in acts:
    fr = a.frame_range
    # Blender 5.x slotted actions: fcurves live inside layers/strips; the
    # exact attribute names differ across 5.x releases, so count defensively.
    nfc = None
    try:
        nfc = len(a.fcurves)
    except AttributeError:
        nfc = 0
        try:
            for l in a.layers:
                for st in l.strips:
                    for attr in ("fcurves", "channels", "channelbags"):
                        if hasattr(st, attr):
                            try:
                                nfc += len(getattr(st, attr))
                                break
                            except Exception:
                                pass
        except Exception:
            nfc = None
    print(f"AUDIT_ACTION {a.name} frames {fr[0]:.0f}-{fr[1]:.0f} fcurves {nfc}")

# which datablocks carry animation data and which action
print("AUDIT_ANIMATED_OBJECTS")
for o in objs:
    ad = o.animation_data
    if ad and ad.action:
        print(f"AUDIT_ANIM obj {o.name} action {ad.action.name}")
print("AUDIT_ANIMATED_SHAPEKEYS")
for me in bpy.data.meshes:
    if me.shape_keys and me.shape_keys.animation_data and me.shape_keys.animation_data.action:
        print(f"AUDIT_ANIM shapekeys {me.name} action {me.shape_keys.animation_data.action.name}")
for cu in bpy.data.curves:
    ad = cu.animation_data
    if ad and ad.action:
        print(f"AUDIT_ANIM curve_data {cu.name} action {ad.action.name}")

# hierarchy snapshot (name, type, parent)
print("AUDIT_HIERARCHY")
for o in objs:
    print(f"AUDIT_NODE {o.name} type={o.type} parent={o.parent.name if o.parent else None}")

# --- probe the installed glTF exporter API (Blender 5.2) -------------------
try:
    rna = bpy.ops.export_scene.gltf.get_rna_type()
    ids = sorted(p.identifier for p in rna.properties
                 if p.identifier not in ("properties",))
    print("GLTF_EXPORTER_ARGS_COUNT", len(ids))
    for i in ids:
        print("GLTF_EXPORTER_ARG", i)
except Exception as ex:
    print("GLTF_EXPORTER_PROBE_FAIL", repr(ex))

print(AUDIT_MARKER)
