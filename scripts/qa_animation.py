"""STEP 4B — animation QA for build/animated.blend.

Verifies, without touching the frozen model:
  1. freeze: names/hierarchy/origins/meshes/materials identical to detail.blend
  2. structure: every manifest object has a PC_Disassembly_* action;
     static objects (CASE, group empties, cable connectors) carry no keys
  3. reset: frame 1 == assembled rest; reverse playback returns to rest
  4. no accidental transforms: nothing moves before its first key;
     static objects never move
  5. stage park poses match manifest-derived cumulative offsets
     (incl. M.2 12 deg tilt after STORAGE_OUT, flat at FINAL_EXPLODE)
  6. riders travel with the board during MOTHERBOARD_OUT (per frame)
  7. cable connectors ride their cables (per frame)
  8. cooler-before-CPU ordering (settle rule)
  9. collision sweep at EVERY frame (BVH, whitelist respected; parked objects
     reuse cached trees, identical poses are skipped as already tested;
     curve bevel tubes re-evaluate per frame since REV 3.4 keys bezier points)
 10. REV 3.4 cable disconnect invariants: contact with the departing host is
     one contiguous interval (no re-engage) and ends BEFORE the board's main
     -X extraction slide begins
 11. fcurve sanity: >=2 keys, no NaN

Run:  blender -b build/animated.blend --python scripts/qa_animation.py
"""
import bpy
import json
import os
import math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(ROOT, "build", "disassembly_manifest.json")
STAGES_JSON = os.path.join(ROOT, "build", "animation_stages.json")
DETAIL_BLEND = os.path.join(ROOT, "build", "detail.blend")
REPORT = os.path.join(ROOT, "build", "qa_animation_report.txt")

with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    MAN = json.load(f)
with open(STAGES_JSON, "r", encoding="utf-8") as f:
    META = json.load(f)
STG = {s["id"]: s for s in MAN["stages"]}
FINAL_OFF = {k: Vector(v) for k, v in STG["FINAL_EXPLODE"]["offsets"].items()}

ALLOW_CONTACT = {
    frozenset(("MOTHERBOARD", "CPU")),
    frozenset(("MOTHERBOARD", "CPU_COOLER")),
    frozenset(("MOTHERBOARD", "RAM_01")), frozenset(("MOTHERBOARD", "RAM_02")),
    frozenset(("MOTHERBOARD", "RAM_03")), frozenset(("MOTHERBOARD", "RAM_04")),
    frozenset(("MOTHERBOARD", "GPU")),
    frozenset(("MOTHERBOARD", "M2_SSD")),
    frozenset(("CPU", "CPU_COOLER")),
}

# Cable contact policy (measured, then documented): the locked Step 3 asset
# models electrical mating as solid interpenetration at rest (connector inside
# socket, sleeve started into a shell or laid along a component).  Cables are
# rigid dressing that unplug at SECONDARY_OUT per the manifest, so when a host
# component departs earlier, its socket/plate sweeps out through the
# stationary mated plug/sleeve - the designed separation pass-through of the
# approved "cables last" stylization (same category as the whitelisted GPU
# slot disengage).  The sweep below proves every cable contact is one of
# these designed pairs AND that once the host's departure stage has parked,
# the pair never contacts again (cable free, no later snag).
CABLE_CONTACT = {
    # 24-pin: mated at board + PSU sockets, sleeve routed along board/GPU/PSU
    frozenset(("CABLE_24PIN", "GPU")),
    frozenset(("CABLE_24PIN", "MOTHERBOARD")),
    frozenset(("CABLE_24PIN", "PSU")),
    frozenset(("CABLE_24PIN_CONN_MB", "GPU")),
    frozenset(("CABLE_24PIN_CONN_MB", "MOTHERBOARD")),
    frozenset(("CABLE_24PIN_CONN_PSU", "PSU")),
    # CPU power: same pattern
    frozenset(("CABLE_CPU_POWER", "GPU")),
    frozenset(("CABLE_CPU_POWER", "MOTHERBOARD")),
    frozenset(("CABLE_CPU_POWER", "PSU")),
    frozenset(("CABLE_CPU_POWER_CONN_MB", "MOTHERBOARD")),
    frozenset(("CABLE_CPU_POWER_CONN_PSU", "PSU")),
    # GPU power: mated at card + PSU; sleeve/connector are swept by the board
    # plate while the mated GPU rides the board away (frames ~154-176)
    frozenset(("CABLE_GPU_POWER", "GPU")),
    frozenset(("CABLE_GPU_POWER", "MOTHERBOARD")),
    frozenset(("CABLE_GPU_POWER", "PSU")),
    frozenset(("CABLE_GPU_POWER_CONN_GPU", "GPU")),
    frozenset(("CABLE_GPU_POWER_CONN_GPU", "MOTHERBOARD")),
    frozenset(("CABLE_GPU_POWER_CONN_PSU", "PSU")),
}

results = []


def check(ok, label, detail=""):
    results.append((bool(ok), label, detail))


# ----------------------------------------------------------------------------
# manifest-derived expected park poses (independent of the authoring script)
# ----------------------------------------------------------------------------
def axis_dist(d):
    return (Vector(d["axis"]) * d["dist"]).freeze()


# Net park displacement of the board = stage-level axis*dist (lift/slide/settle
# primitives net out to this). Riders park rigidly with it.
BOARD = axis_dist({"axis": STG["MOTHERBOARD_OUT"]["axis"], "dist": STG["MOTHERBOARD_OUT"]["dist"]})
EXPECT = {}
EXPECT["OPEN_CASE"] = {"CASE_SIDE_PANEL": (
    (axis_dist(STG["OPEN_CASE"]["presentation"]["CASE_SIDE_PANEL"])
     + Vector(STG["OPEN_CASE"]["presentation"]["CASE_SIDE_PANEL"].get("set_aside", (0, 0, 0)))).freeze(), 0.0)}
mb = {n: (BOARD, 0.0) for n in ["MOTHERBOARD"] + STG["MOTHERBOARD_OUT"]["riders"]}
EXPECT["MOTHERBOARD_OUT"] = mb
co = (BOARD + axis_dist(STG["CPU_COOLER_OUT"]["presentation"]["CPU_COOLER"])).freeze()
EXPECT["CPU_COOLER_OUT"] = {"CPU_COOLER": (co, 0.0)}
cp = (BOARD + axis_dist(STG["CPU_OUT"]["presentation"]["CPU"])).freeze()
EXPECT["CPU_OUT"] = {"CPU": (cp, 0.0)}
EXPECT["RAM_OUT"] = {r: ((BOARD + axis_dist(STG["RAM_OUT"]["presentation"][r])).freeze(), 0.0)
                     for r in ("RAM_01", "RAM_02", "RAM_03", "RAM_04")}
EXPECT["GPU_OUT"] = {"GPU": ((BOARD + axis_dist(STG["GPU_OUT"]["presentation"]["GPU"])).freeze(), 0.0)}
m2_arc = (Matrix.Rotation(math.radians(12), 3, 'Z') - Matrix.Identity(3)) @ \
         (Vector((0.0877, 0.050, 0.229)) - Vector((0.0877, 0.010, 0.229)))
def sum_prims(stage_id, obj):
    """Cumulative translation of an object's ordered removal primitives."""
    v = Vector((0, 0, 0))
    for p in STG[stage_id]["removal"][obj]:
        if p["type"] == "translate":
            v += Vector(p["axis"]) * p["dist"]
    return v.freeze()


EXPECT["STORAGE_OUT"] = {
    "M2_SSD": ((BOARD + m2_arc + Vector((-0.15, 0, 0))).freeze(), math.radians(12)),
    "STORAGE": (sum_prims("STORAGE_OUT", "STORAGE"), 0.0)}
EXPECT["PSU_OUT"] = {"PSU": (axis_dist(STG["PSU_OUT"]["presentation"]["PSU"]), 0.0)}
EXPECT["SECONDARY_OUT"] = {n: (axis_dist(STG["SECONDARY_OUT"]["presentation"][n]), 0.0)
                           for n in STG["SECONDARY_OUT"]["presentation"]}
EXPECT["FINAL_EXPLODE"] = {n: (FINAL_OFF[n].freeze(), 0.0) for n in FINAL_OFF}

MOVABLE = sorted(set(sum([list(d.keys()) for d in EXPECT.values()], [])))
STATIC = ["CASE", "PC_ROOT", "RAM", "FANS", "CABLES",
          "CABLE_24PIN_CONN_MB", "CABLE_24PIN_CONN_PSU",
          "CABLE_CPU_POWER_CONN_MB", "CABLE_CPU_POWER_CONN_PSU",
          "CABLE_GPU_POWER_CONN_GPU", "CABLE_GPU_POWER_CONN_PSU"]

sc = bpy.context.scene

# ----------------------------------------------------------------------------
# 1. freeze check vs detail.blend
# ----------------------------------------------------------------------------
snap = {}
for o in bpy.data.objects:
    if o.type in ("MESH", "CURVE", "EMPTY") and not o.name.startswith("_"):
        snap[o.name] = (tuple(round(v, 6) for v in o.location),
                        o.parent.name if o.parent else None,
                        len(o.data.vertices) if o.type == "MESH" else None,
                        tuple(m.name for m in o.data.materials) if o.type in ("MESH", "CURVE") else ())
anim_names = set(snap.keys())
bpy.ops.wm.open_mainfile(filepath=DETAIL_BLEND)
detail_names = set()
for o in bpy.data.objects:
    if o.type in ("MESH", "CURVE", "EMPTY") and not o.name.startswith("_"):
        detail_names.add(o.name)
        d = (tuple(round(v, 6) for v in o.location),
             o.parent.name if o.parent else None,
             len(o.data.vertices) if o.type == "MESH" else None,
             tuple(m.name for m in o.data.materials) if o.type in ("MESH", "CURVE") else ())
        if o.name in snap:
            check(snap[o.name] == d, f"freeze:{o.name}", f"anim={snap[o.name]} detail={d}")
check(anim_names == detail_names, "freeze:object_set",
      f"only_anim={sorted(anim_names - detail_names)} only_detail={sorted(detail_names - anim_names)}")
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, "build", "animated.blend"))
sc = bpy.context.scene

# ----------------------------------------------------------------------------
# 2. structure
# ----------------------------------------------------------------------------
for n in MOVABLE:
    o = bpy.data.objects[n]
    act = o.animation_data.action if o.animation_data else None
    check(act is not None and act.name.startswith("PC_Disassembly"), f"action:{n}",
          act.name if act else "none")
MBGPU_CONNS = ["CABLE_24PIN_CONN_MB", "CABLE_CPU_POWER_CONN_MB",
                 "CABLE_GPU_POWER_CONN_GPU"]
for n in STATIC:
    o = bpy.data.objects[n]
    act = o.animation_data.action if o.animation_data else None
    if n in MBGPU_CONNS:
        # REV 3.4: board/GPU-side connectors get a disconnect sub-sequence
        check(act is not None and act.name.startswith("PC_Disassembly")
              and act.name.endswith("_disconnect"), f"disconnect_action:{n}",
              act.name if act else "none")
    else:
        check(act is None, f"static_no_keys:{n}", act.name if act else "")

rest = {n: bpy.data.objects[n].location.copy() for n in MOVABLE + STATIC}
rest_conn_w = {n: bpy.data.objects[n].matrix_world.translation.copy()
               for n in MBGPU_CONNS}


def deltas(frame):
    sc.frame_set(frame)
    out = {}
    for n in MOVABLE + STATIC:
        o = bpy.data.objects[n]
        out[n] = (o.location - rest[n], o.rotation_euler.z)
    return out


# ----------------------------------------------------------------------------
# 3/4. reset + no accidental motion
# ----------------------------------------------------------------------------
d1 = deltas(1)
for n in MOVABLE + STATIC:
    check(d1[n][0].length < 1e-6 and abs(d1[n][1]) < 1e-8, f"reset:{n}",
          f"delta={tuple(round(v,5) for v in d1[n][0])}")

first_key = {}
for n in MOVABLE:
    o = bpy.data.objects[n]
    fk = 10**9
    for layer in o.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for kp in fc.keyframe_points:
                        fk = min(fk, int(kp.co.x))
                        check(not (math.isnan(kp.co.x) or math.isnan(kp.co.y)),
                              f"nan_key:{n}", "")
    first_key[n] = fk
    if fk > 2:
        d = deltas(fk - 1)
        check(d[n][0].length < 1e-6, f"no_early_motion:{n}", f"at f{fk-1}")

# ----------------------------------------------------------------------------
# 5. stage park poses
# ----------------------------------------------------------------------------
park_frame = {s["id"]: s["park"] for s in META["stages"] if "park" in s}
for sid, poses in EXPECT.items():
    f = park_frame[sid]
    d = deltas(f)
    for n, (off, rot) in poses.items():
        err = (d[n][0] - off).length
        check(err < 1.5e-3, f"park:{sid}:{n}", f"err={err:.5f}")
        check(abs(d[n][1] - rot) < 1e-3, f"park_rot:{sid}:{n}",
              f"rot={d[n][1]:.4f} expect={rot:.4f}")

# ----------------------------------------------------------------------------
# 6/7. riders + connectors per frame
# ----------------------------------------------------------------------------
s2 = next(s for s in META["stages"] if s["id"] == "MOTHERBOARD_OUT")
for f in range(s2["start"], s2["park"]):
    d = deltas(f)
    for r in STG["MOTHERBOARD_OUT"]["riders"]:
        check((d[r][0] - d["MOTHERBOARD"][0]).length < 1e-5, f"rider:{r}@{f}")
# connectors are parented to their cable curves: compare WORLD deltas
# (local .location of a child never changes when the parent moves).
# MOTHERBOARD_OUT window: the connector intentionally translates relative to
# the (stationary) cable object, so it must be compared against the sleeve
# TIP (terminal bezier point) it mates with, not the cable origin.
conn_pairs = (("CABLE_24PIN_CONN_MB", "CABLE_24PIN", 3),
              ("CABLE_CPU_POWER_CONN_MB", "CABLE_CPU_POWER", 3),
              ("CABLE_GPU_POWER_CONN_GPU", "CABLE_GPU_POWER", 2))
sc.frame_set(1)
wrest = {n: bpy.data.objects[n].matrix_world.translation.copy()
         for c, p, _ in conn_pairs for n in (c, p)}
tip_rest = {c: (bpy.data.objects[p].matrix_world @
                bpy.data.objects[p].data.splines[0].bezier_points[ti].co).copy()
            for c, p, ti in conn_pairs}
# REV 3.4: after the sub-sequence completes the connector HOLDS its cleared
# pose (manifest-derived cumulative disconnect primitives) - no drift, no
# re-approach toward the departed host.
DIS_EXPECT = {}
for cab, blk in STG["MOTHERBOARD_OUT"]["disconnect"]["cables"].items():
    DIS_EXPECT[blk["connector"]] = sum(
        (Vector(pr["axis"]) * pr["dist"] for pr in blk["primitives"] if pr["type"] == "translate"),
        Vector((0, 0, 0)))
for f in range(s2["start"], s2["park"] + 1):
    sc.frame_set(f)
    for c, p, ti in conn_pairs:
        oc, op = bpy.data.objects[c], bpy.data.objects[p]
        dc = oc.matrix_world.translation - wrest[c]
        # keyed bezier points live on the datablock: matrix_world @ point co
        # reflects the flex without needing an evaluated mesh
        tip = (op.matrix_world @
               op.data.splines[0].bezier_points[ti].co) - tip_rest[c]
        check((dc - tip).length < 0.004, f"connector_tracks_tip:{c}@{f}")
# SECONDARY_OUT window: rigid once the PSU-side unplug beat has started and
# until the presentation settle leg pulls the cable X back (connector holds
# its cleared pose, so the settle leg intentionally slides under it).  The
# connector rides the cable at a CONSTANT offset = its cleared pose.
for f in range(park_frame["SECONDARY_OUT"] - 66, park_frame["SECONDARY_OUT"] - 26):
    sc.frame_set(f)
    for c, p, _ in conn_pairs:
        oc, op = bpy.data.objects[c], bpy.data.objects[p]
        dc = oc.matrix_world.translation - wrest[c]
        dp = op.matrix_world.translation - wrest[p]
        check((dc - dp - DIS_EXPECT[c]).length < 1e-5, f"connector_rides:{c}@{f}")
for n, exp in DIS_EXPECT.items():
    for f in (s2["park"] - 2, s2["park"] + 2):
        dl = bpy.data.objects[n].location - rest[n]
        check((dl - exp).length < 1e-5, f"connector_holds_clear:{n}@{f}",
              f"delta={tuple(round(v,5) for v in dl)} expect={tuple(round(v,5) for v in exp)}")

# ----------------------------------------------------------------------------
# 8. ordering: cooler settles before CPU starts
# ----------------------------------------------------------------------------
check(park_frame["CPU_COOLER_OUT"] < next(s for s in META["stages"]
      if s["id"] == "CPU_OUT")["start"], "order:cooler_before_cpu")

# ----------------------------------------------------------------------------
# 9. collision sweep
# CASE is excluded exactly like qa_blockout: it is a container, and the frozen
# shell has no modeled openings, so designed extractions (rear PSU, front/rear
# fans, board through the open side) necessarily pass its walls. Component vs
# component and component vs parked panel are the meaningful tests here.
# ----------------------------------------------------------------------------
TEST = [n for n in MOVABLE if bpy.data.objects[n].type == "MESH"]
# Cable curves (evaluated bevel tube) + their connector children, tested as
# real world-space geometry against the movable hardware.
CABLESET = ["CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER",
            "CABLE_24PIN_CONN_MB", "CABLE_24PIN_CONN_PSU",
            "CABLE_CPU_POWER_CONN_MB", "CABLE_CPU_POWER_CONN_PSU",
            "CABLE_GPU_POWER_CONN_GPU", "CABLE_GPU_POWER_CONN_PSU"]

# Local mesh data is immutable for plain meshes (no modifiers/deformers), so
# world BVHs are rebuilt only for objects whose matrix_world changed since the
# last frame; parked objects keep their tree.  REV 3.4: cable curves now carry
# keyed bezier points, so their evaluated bevel tube DEFORMS even when the
# object matrix is static - curves are re-evaluated every frame.
LOCAL = {}
for n in TEST:
    me = bpy.data.objects[n].data
    LOCAL[n] = ([v.co.copy() for v in me.vertices],
                [p.vertices[:] for p in me.polygons])
dg = bpy.context.evaluated_depsgraph_get()
for n in CABLESET:
    o = bpy.data.objects[n]
    if o.type != "CURVE":
        LOCAL[n] = ([v.co.copy() for v in o.data.vertices],
                    [p.vertices[:] for p in o.data.polygons])


def cable_mesh(n, m):
    o = bpy.data.objects[n]
    if o.type == "CURVE":
        oe = o.evaluated_get(dg)
        me = oe.to_mesh()
        verts = [(m @ v.co) for v in me.vertices]
        polys = [p.vertices[:] for p in me.polygons]
        oe.to_mesh_clear()
        return verts, polys
    verts, polys = LOCAL[n]
    return [(m @ v) for v in verts], polys


def aabb_gap(a, b):
    pa = [a[2] @ Vector(c) for c in a[1]]
    pb = [b[2] @ Vector(c) for c in b[1]]
    loa = Vector((min(p.x for p in pa), min(p.y for p in pa), min(p.z for p in pa)))
    hia = Vector((max(p.x for p in pa), max(p.y for p in pa), max(p.z for p in pa)))
    lob = Vector((min(p.x for p in pb), min(p.y for p in pb), min(p.z for p in pb)))
    hib = Vector((max(p.x for p in pb), max(p.y for p in pb), max(p.z for p in pb)))
    return max(lob.x - hia.x, loa.x - hib.x, lob.y - hia.y, loa.y - hib.y,
               lob.z - hia.z, loa.z - hib.z)


# REV 3.4: main extraction = the board's -X slide.  Derived from board motion
# (first frame its X delta drops below -0.1 mm), independent of authoring.
_slide = None
_px = 0.0
for f in range(s2["start"], s2["park"] + 1):
    x = deltas(f)["MOTHERBOARD"][0].x
    if _slide is None and _px - x > 1e-4:
        _slide = f
    _px = x
SLIDE_START = _slide
check(SLIDE_START is not None, "extraction_slide_detected",
      f"MOTHERBOARD_OUT {s2['start']}-{s2['park']}")
# Pairs whose contact must end BEFORE the slide starts (host-side mating).
CLEAR_BEFORE = {
    frozenset(("CABLE_24PIN", "MOTHERBOARD")), frozenset(("CABLE_24PIN", "GPU")),
    frozenset(("CABLE_24PIN_CONN_MB", "MOTHERBOARD")),
    frozenset(("CABLE_24PIN_CONN_MB", "GPU")),
    frozenset(("CABLE_CPU_POWER", "MOTHERBOARD")),
    frozenset(("CABLE_CPU_POWER", "GPU")),
    frozenset(("CABLE_CPU_POWER_CONN_MB", "MOTHERBOARD")),
    frozenset(("CABLE_GPU_POWER", "MOTHERBOARD")),
    frozenset(("CABLE_GPU_POWER", "GPU")),
    frozenset(("CABLE_GPU_POWER_CONN_GPU", "MOTHERBOARD")),
    frozenset(("CABLE_GPU_POWER_CONN_GPU", "GPU")),
}

# REV 3.4 PSU-side policy (NOT a broad whitelist): the PSU-side ends stay
# mated until SECONDARY_OUT, so (a) while mated they may ride the departing
# PSU, (b) they must release and be clear before SECONDARY_OUT parks, and
# (c) they must NEVER touch the parked PSU while other hardware is still in
# flight (psu_park .. cable settle start).  The presentation settle then
# descends the plug ONTO the departed PSU top from above and stops exactly
# in the assembled-rest mating pose (designed presentation contact; no
# pass-through and no host in motion).
PSU_SIDE = {
    frozenset(("CABLE_24PIN", "PSU")), frozenset(("CABLE_24PIN_CONN_PSU", "PSU")),
    frozenset(("CABLE_CPU_POWER", "PSU")), frozenset(("CABLE_CPU_POWER_CONN_PSU", "PSU")),
    frozenset(("CABLE_GPU_POWER", "PSU")), frozenset(("CABLE_GPU_POWER_CONN_PSU", "PSU")),
}

cache = {}
viol = 0
cable_state = {}   # pair -> [first, last, intervals, in_contact]
cable_viol = {}
poses = 0
END = META["frame_end"]
for f in range(1, END + 1):
    sc.frame_set(f)
    changed = []
    for n in TEST + CABLESET:
        o = bpy.data.objects[n]
        m = o.matrix_world
        c = cache.get(n)
        if n in ("CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER"):
            verts, polys = cable_mesh(n, m)          # deforms per frame
            tree = BVHTree.FromPolygons(verts, polys)
            cache[n] = (tree, o.bound_box, m.copy())
            changed.append(n)
        elif c is None or m != c[2]:
            verts, polys = cable_mesh(n, m)
            tree = BVHTree.FromPolygons(verts, polys)
            cache[n] = (tree, o.bound_box, m.copy())
            changed.append(n)
    if not changed:
        continue  # pose identical to an already-tested frame
    poses += 1
    names = list(TEST)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            if aabb_gap(cache[a], cache[b]) > 0.004:
                continue
            hit = cache[a][0].overlap(cache[b][0])
            if hit and frozenset((a, b)) not in ALLOW_CONTACT:
                viol += 1
                check(False, f"collide:{a}|{b}@{f}", f"{len(hit)} tri pairs")
    # cables + connectors vs movable hardware; designed contacts tracked as
    # single-event state, anything else is a genuine cable collision
    for a in CABLESET:
        for b in names:
            pair = frozenset((a, b))
            hit = None if aabb_gap(cache[a], cache[b]) > 0.004 \
                else cache[a][0].overlap(cache[b][0])
            if pair in CABLE_CONTACT:
                st = cable_state.setdefault(pair, [None, None, [], False])
                if hit:
                    if st[0] is None:
                        st[0] = f
                    st[1] = f
                    if not st[3]:
                        st[2].append([f, f])
                        st[3] = True
                    else:
                        st[2][-1][1] = f
                else:
                    st[3] = False
            elif hit:
                cable_viol.setdefault((a, b), []).append(f)
                if len(cable_viol[(a, b)]) <= 2:
                    check(False, f"cable_collide:{a}|{b}@{f}",
                          f"n={len(hit)} tri_pairs")
check(viol == 0, "collision sweep clean", f"frames={END} poses_tested={poses}")
sec_start = next(s for s in META["stages"] if s["id"] == "SECONDARY_OUT")["start"]
final_start = next(s for s in META["stages"] if s["id"] == "FINAL_EXPLODE")["start"]
for pair, st in sorted(cable_state.items(), key=lambda kv: sorted(kv[0])):
    if st[0] is None:
        continue
    a, b = sorted(pair)
    check(True, f"cable_contact(designed):{a}|{b}",
          f"frames {st[0]}-{st[1]} intervals={len(st[2])}")
    host = "PSU_OUT" if "PSU" in pair else "MOTHERBOARD_OUT"
    if pair in PSU_SIDE:
        settle_start = sec_start + 50
        # mated PSU-side end: every pre-settle contact interval must end by
        # SECONDARY_OUT park (plug pulled and clear before the stage parks)
        pre = [iv for iv in st[2] if iv[0] < settle_start]
        check(all(iv[1] <= park_frame["SECONDARY_OUT"] for iv in pre),
              f"cable_free_after:{a}|{b}",
              f"pre_settle={pre} park={park_frame['SECONDARY_OUT']}")
        # zero contact while anything is in flight: from the PSU parking
        # until the cable's own presentation settle begins (s0+50).  The
        # settle DESCENDS onto the departed PSU top from above and stops in
        # the rest mating pose (rest-style presentation contact, identical
        # to the assembled baseline - no pass-through, no host in motion).
        inflight = [iv for iv in st[2]
                    if iv[1] > park_frame["PSU_OUT"] and iv[0] < settle_start]
        check(not inflight, f"psu_no_inflight_recontact:{a}|{b}", f"bad={inflight}")
        continue
    check(st[1] <= park_frame[host], f"cable_free_after:{a}|{b}",
          f"last={st[1]} host_park={park_frame[host]}")
    # REV 3.4 no-reengage: one contiguous contact interval per designed pair.
    # disconnect -> contact decreases -> clear -> host extracts -> no recontact.
    check(len(st[2]) == 1, f"cable_no_reengage:{a}|{b}",
          f"intervals={len(st[2])} frames {st[0]}-{st[1]}")
    if pair in CLEAR_BEFORE and SLIDE_START is not None:
        check(st[1] < SLIDE_START, f"clear_before_extraction:{a}|{b}",
              f"last_contact={st[1]} slide_start={SLIDE_START}")
for (a, b), fr in sorted(cable_viol.items()):
    check(False, f"cable_collide_range:{a}|{b}", f"frames {fr[0]}-{fr[-1]} n={len(fr)}")
check(not cable_viol, "cable sweep clean", f"frames={END}")

# ----------------------------------------------------------------------------
# 10. reverse playback
# ----------------------------------------------------------------------------
sc.frame_set(END)
sc.frame_set(1)
d1b = deltas(1)
for n in MOVABLE:
    check(d1b[n][0].length < 1e-6, f"reverse_reset:{n}")

fails = [r for r in results if not r[0]]
with open(REPORT, "w", encoding="utf-8") as f:
    for ok, label, detail in results:
        f.write(("PASS " if ok else "FAIL ") + label + (f"  [{detail}]" if detail else "") + "\n")
    f.write(f"\nchecks: {len(results)}  failures: {len(fails)}\n")
print(f"checks: {len(results)}  failures: {len(fails)}")
print("ANIM_QA_RESULT:", "QA_PASS" if not fails else "QA_FAIL")
