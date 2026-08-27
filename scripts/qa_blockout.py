"""Blockout QA: verifies structure, names, hierarchy, pivots, scale, intersections.

Intersection policy:
- Component pairs are tested at mesh level (BVH triangle overlap on evaluated
  meshes), so flush surface contact is allowed but real interpenetration fails.
- Pairs designed to be in flush contact (mounted on the motherboard etc.) are
  whitelisted and only reported as INFO.
- CASE is a container: instead of pair tests, every component must fit inside
  the case interior bounds.

Run:  blender -b build/blockout.blend --python scripts/qa_blockout.py
Out:  build/qa_report.txt (+ console summary)
"""
import json
import os
import bpy
from mathutils import Vector
from mathutils import bvhtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT = os.path.join(ROOT, "build", "qa_report.txt")

ORIGIN_TOL = 0.002      # 2 mm
CASE_INTERIOR = ((-0.1055, -0.218, 0.002), (0.1055, 0.218, 0.458))
CONTAIN_EPS = 0.001

REQUIRED = {
    "PC_ROOT": "EMPTY", "RAM": "EMPTY", "FANS": "EMPTY", "CABLES": "EMPTY",
    "CASE": "MESH", "CASE_SIDE_PANEL": "MESH", "MOTHERBOARD": "MESH",
    "CPU": "MESH", "CPU_COOLER": "MESH",
    "RAM_01": "MESH", "RAM_02": "MESH", "RAM_03": "MESH", "RAM_04": "MESH",
    "GPU": "MESH", "M2_SSD": "MESH", "STORAGE": "MESH", "PSU": "MESH",
    "CASE_FAN_01": "MESH", "CASE_FAN_02": "MESH", "CASE_FAN_03": "MESH",
    "CABLE_24PIN": "CURVE", "CABLE_CPU_POWER": "CURVE", "CABLE_GPU_POWER": "CURVE",
}

EXPECTED_PARENT = {
    "CASE": "PC_ROOT", "MOTHERBOARD": "PC_ROOT", "CPU": "PC_ROOT",
    "CPU_COOLER": "PC_ROOT", "GPU": "PC_ROOT", "M2_SSD": "PC_ROOT",
    "STORAGE": "PC_ROOT", "PSU": "PC_ROOT",
    "RAM": "PC_ROOT", "FANS": "PC_ROOT", "CABLES": "PC_ROOT",
    "CASE_SIDE_PANEL": "CASE",
    "RAM_01": "RAM", "RAM_02": "RAM", "RAM_03": "RAM", "RAM_04": "RAM",
    "CASE_FAN_01": "FANS", "CASE_FAN_02": "FANS", "CASE_FAN_03": "FANS",
    "CABLE_24PIN": "CABLES", "CABLE_CPU_POWER": "CABLES", "CABLE_GPU_POWER": "CABLES",
}

EXPECTED_ORIGINS = {
    "PC_ROOT": (0, 0, 0), "RAM": (0, 0, 0), "FANS": (0, 0, 0), "CABLES": (0, 0, 0),
    "CASE": (0, 0, 0),
    "CASE_SIDE_PANEL": (-0.1095, -0.218, 0.230),
    "MOTHERBOARD": (0.0885, 0.0275, 0.237),
    "CPU": (0.0852, 0.050, 0.270),
    "CPU_COOLER": (0.0812, 0.050, 0.270),
    "RAM_01": (0.0877, -0.002, 0.270), "RAM_02": (0.0877, -0.012, 0.270),
    "RAM_03": (0.0877, -0.022, 0.270), "RAM_04": (0.0877, -0.032, 0.270),
    "GPU": (0.0877, 0.040, 0.171),
    "M2_SSD": (0.0877, 0.050, 0.229),
    "STORAGE": (-0.020, -0.140, 0.090),
    "PSU": (0.030, 0.148, 0.002),
    "CASE_FAN_01": (0.0, -0.194, 0.170), "CASE_FAN_02": (0.0, -0.194, 0.310),
    "CASE_FAN_03": (-0.010, 0.194, 0.330),
    "CABLE_24PIN": (0.075, 0.150, 0.090),
    "CABLE_CPU_POWER": (0.060, 0.170, 0.088),
    "CABLE_GPU_POWER": (0.010, 0.090, 0.088),
}

EXPECTED_DIMS = {
    "CASE_SIDE_PANEL": (0.004, 0.436, 0.456),
    "CPU": (0.004, 0.045, 0.045),
    "RAM_01": (0.045, 0.008, 0.133), "RAM_02": (0.045, 0.008, 0.133),
    "RAM_03": (0.045, 0.008, 0.133), "RAM_04": (0.045, 0.008, 0.133),
    "M2_SSD": (0.008, 0.080, 0.022),
    "STORAGE": (0.070, 0.100, 0.008),
    "PSU": (0.150, 0.140, 0.086),
}

# mesh-level pair test set (CASE handled via containment instead)
RIGID = ["CASE_SIDE_PANEL", "MOTHERBOARD", "CPU", "CPU_COOLER",
         "RAM_01", "RAM_02", "RAM_03", "RAM_04", "GPU", "M2_SSD",
         "STORAGE", "PSU", "CASE_FAN_01", "CASE_FAN_02", "CASE_FAN_03"]

# pairs designed to be in flush contact (mounted) -> INFO, not FAIL
ALLOW_CONTACT = {
    frozenset(("MOTHERBOARD", "CPU")),
    frozenset(("MOTHERBOARD", "CPU_COOLER")),
    frozenset(("MOTHERBOARD", "RAM_01")), frozenset(("MOTHERBOARD", "RAM_02")),
    frozenset(("MOTHERBOARD", "RAM_03")), frozenset(("MOTHERBOARD", "RAM_04")),
    frozenset(("MOTHERBOARD", "GPU")),
    frozenset(("MOTHERBOARD", "M2_SSD")),
    frozenset(("CPU", "CPU_COOLER")),
}

# components exempt from containment (mounted outside the chassis volume)
CONTAIN_EXEMPT = {"CASE_SIDE_PANEL"}

results = []
infos = []


def check(ok, label, detail=""):
    results.append((bool(ok), label, detail))


def world_aabb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mins = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    maxs = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mins, maxs


def main():
    sc = bpy.context.scene

    # 1-2. existence + type -------------------------------------------------
    for name, etype in REQUIRED.items():
        o = bpy.data.objects.get(name)
        if o is None:
            check(False, f"exists:{name}", "missing")
        else:
            check(True, f"exists:{name}")
            check(o.type == etype, f"type:{name}", f"expected {etype}, got {o.type}")

    dupes = [o.name for o in sc.objects if o.name.split(".")[0] != o.name]
    check(not dupes, "no duplicate (.001) names", ", ".join(dupes))

    # 3. separation ----------------------------------------------------------
    for name, etype in REQUIRED.items():
        if etype == "MESH":
            o = bpy.data.objects.get(name)
            if o and o.data:
                check(o.data.users == 1, f"separate_mesh:{name}", f"users={o.data.users}")

    # 4. hierarchy -----------------------------------------------------------
    for name, parent in EXPECTED_PARENT.items():
        o = bpy.data.objects.get(name)
        if o is None:
            continue
        p = o.parent.name if o.parent else None
        check(p == parent, f"parent:{name}", f"expected {parent}, got {p}")
    for grp, kids in (("RAM", 4), ("FANS", 3), ("CABLES", 3)):
        g = bpy.data.objects.get(grp)
        if g:
            check(len(g.children) == kids, f"children:{grp}", f"expected {kids}, got {len(g.children)}")

    # 5. scale ---------------------------------------------------------------
    for name, etype in REQUIRED.items():
        o = bpy.data.objects.get(name)
        if o and o.type == "MESH":
            ok = all(abs(v - 1.0) < 0.001 for v in o.scale)
            check(ok, f"scale:{name}", f"scale={tuple(round(v, 4) for v in o.scale)}")

    # 6. origins -------------------------------------------------------------
    bpy.context.view_layer.update()
    for name, exp in EXPECTED_ORIGINS.items():
        o = bpy.data.objects.get(name)
        if o is None:
            continue
        w = o.matrix_world.translation
        d = (w - Vector(exp)).length
        check(d <= ORIGIN_TOL, f"origin:{name}",
              f"got ({w.x:.4f},{w.y:.4f},{w.z:.4f}) want {exp} (off by {d * 1000:.1f} mm)")

    # 7. dimensions ----------------------------------------------------------
    for name, dims in EXPECTED_DIMS.items():
        o = bpy.data.objects.get(name)
        if o is None:
            continue
        got = tuple(round(v, 4) for v in o.dimensions)
        ok = all(abs(g - e) <= max(0.002, e * 0.05) for g, e in zip(o.dimensions, dims))
        check(ok, f"dims:{name}", f"got {got} want {dims}")

    # 8a. mesh-level intersections -------------------------------------------
    dg = bpy.context.evaluated_depsgraph_get()

    def world_tree(o):
        """BVH of the evaluated mesh in WORLD space (FromObject alone uses local)."""
        eo = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(eo, depsgraph=dg)
        me.transform(o.matrix_world)
        me.calc_loop_triangles()
        verts = [v.co[:] for v in me.vertices]
        polys = [tuple(lt.vertices) for lt in me.loop_triangles]
        tree = bvhtree.BVHTree.FromPolygons(verts, polys, all_triangles=True)
        bpy.data.meshes.remove(me)
        return tree

    trees = {}
    for name in RIGID:
        o = bpy.data.objects.get(name)
        if o:
            try:
                trees[name] = world_tree(o)
            except Exception as exc:
                check(False, f"bvh:{name}", str(exc))
    names = list(trees)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            hits = trees[names[i]].overlap(trees[names[j]])
            if hits:
                pair = frozenset((names[i], names[j]))
                if pair in ALLOW_CONTACT:
                    infos.append(f"INFO  contact (designed): {names[i]} | {names[j]}  ({len(hits)} tri pairs)")
                else:
                    check(False, f"intersect:{names[i]}|{names[j]}", f"{len(hits)} triangle pairs interpenetrate")
    check(True, "mesh intersection scan completed", f"{len(names) * (len(names) - 1) // 2} pairs tested")

    # 8b. containment inside the case ----------------------------------------
    (ix0, iy0, iz0), (ix1, iy1, iz1) = CASE_INTERIOR
    for name in RIGID:
        if name in CONTAIN_EXEMPT:
            continue
        o = bpy.data.objects.get(name)
        if not o:
            continue
        mn, mx = world_aabb(o)
        ok = (mn.x >= ix0 - CONTAIN_EPS and mn.y >= iy0 - CONTAIN_EPS and mn.z >= iz0 - CONTAIN_EPS
              and mx.x <= ix1 + CONTAIN_EPS and mx.y <= iy1 + CONTAIN_EPS and mx.z <= iz1 + CONTAIN_EPS)
        check(ok, f"inside_case:{name}",
              f"min=({mn.x:.4f},{mn.y:.4f},{mn.z:.4f}) max=({mx.x:.4f},{mx.y:.4f},{mx.z:.4f})")

    # 9. units -----------------------------------------------------------------
    check(abs(sc.unit_settings.scale_length - 1.0) < 1e-6, "unit scale == 1 (meters)")

    # 10. hotspot metadata ------------------------------------------------------
    for name, etype in REQUIRED.items():
        if etype in ("MESH", "CURVE"):
            o = bpy.data.objects.get(name)
            if o:
                check(bool(o.get("display_name")), f"display_name:{name}")

    # 11. disassembly manifest (formal animation architecture) ------------------
    root = bpy.data.objects.get("PC_ROOT")
    check(root is not None and bool(root.get("disassembly_manifest")), "manifest:root_property")
    check(bpy.data.texts.get("DISASSEMBLY_MANIFEST.json") is not None, "manifest:scene_text_datablock")
    mpath = os.path.join(ROOT, "build", "disassembly_manifest.json")
    ok = os.path.isfile(mpath)
    check(ok, "manifest:json_file", mpath)
    if ok:
        with open(mpath, "r", encoding="utf-8") as f:
            man = json.load(f)
        ids = [s["id"] for s in man["stages"]]
        check("CPU_COOLER_OUT" in ids and "CPU_OUT" in ids
              and ids.index("CPU_COOLER_OUT") < ids.index("CPU_OUT"),
              "manifest:order CPU_COOLER_OUT before CPU_OUT", str(ids))
        st = {s["id"]: s for s in man["stages"]}
        check(st["CPU_COOLER_OUT"].get("settle") and st["CPU_OUT"].get("settle"),
              "manifest:settle flags on cooler+cpu stages")
        check(st["MOTHERBOARD_OUT"].get("riders") == ["CPU", "CPU_COOLER", "RAM_01", "RAM_02",
                                                      "RAM_03", "RAM_04", "M2_SSD", "GPU"],
              "manifest:motherboard riders declared (REV 3.1: +GPU)")
        fin = man["stages"][-1]
        check(fin["id"] == "FINAL_EXPLODE" and fin.get("organized"), "manifest:final explode organized")
        need = {n for n, t in REQUIRED.items() if t in ("MESH", "CURVE")} - {"CASE"}
        missing = need - set(fin.get("offsets", {}))
        check(not missing, "manifest:explode offsets cover all movable parts", str(missing))
    cl_o, cpu_o = bpy.data.objects.get("CPU_COOLER"), bpy.data.objects.get("CPU")
    if cl_o and cpu_o:
        check(cl_o.get("stage_index", 99) < cpu_o.get("stage_index", 0),
              "manifest:stage_index cooler < cpu",
              f"cooler={cl_o.get('stage_index')} cpu={cpu_o.get('stage_index')}")
    for name, etype in REQUIRED.items():
        if etype in ("MESH", "CURVE") and name != "CASE":
            o = bpy.data.objects.get(name)
            if o:
                check(o.get("stage_index") is not None and o.get("extract_axis") is not None
                      and o.get("extract_distance") is not None,
                      f"manifest:props:{name}")

    # report -------------------------------------------------------------------
    fails = [r for r in results if not r[0]]
    lines = ["PC BLOCKOUT QA REPORT", "=" * 60]
    for ok, label, detail in results:
        if not ok:
            lines.append(f"FAIL  {label}  {detail}")
    lines.extend(infos)
    lines.append("-" * 60)
    lines.append(f"checks: {len(results)}  failures: {len(fails)}  infos: {len(infos)}")
    lines.append("QA_RESULT: " + ("QA_PASS" if not fails else "QA_FAIL"))
    text = "\n".join(lines)
    print(text)
    with open(REPORT, "w", encoding="utf-8") as f:
        f.write(text + "\n")


if __name__ == "__main__":
    main()
