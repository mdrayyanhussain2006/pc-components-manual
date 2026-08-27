"""STEP 4A — animation authoring for the locked PC asset.

Loads the FROZEN model (build/detail.blend) read-only and authors the
keyframed 10-stage disassembly into a NEW file (build/animated.blend).
The model file is never written back: geometry, names, hierarchy, origins,
materials and manifest semantics stay untouched.

Driven entirely by build/disassembly_manifest.json (single source of truth):
  ASSEMBLED hold
  -> OPEN_CASE -> MOTHERBOARD_OUT (riders travel) -> CPU_COOLER_OUT (settle)
  -> CPU_OUT -> RAM_OUT (sequential) -> GPU_OUT -> STORAGE_OUT (M.2 pivot)
  -> PSU_OUT -> SECONDARY_OUT -> FINAL_EXPLODE (organized park)

Motion language per component (controlled keyframes, not simulation):
  release beat (hold, implies unclip/unscrew) -> micro disengage ->
  main travel (ease in/out) -> settle (small overshoot + return) ->
  presentation park (removal end pose may differ from park pose).

Run:  blender -b build/detail.blend --python scripts/build_animation.py
"""
import bpy
import json
import math
import os
import re
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(ROOT, "build", "disassembly_manifest.json")
OUT_BLEND = os.path.join(ROOT, "build", "animated.blend")
OUT_STAGES = os.path.join(ROOT, "build", "animation_stages.json")

FPS = 24
ACTION_PREFIX = "PC_Disassembly"

with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    MAN = json.load(f)
STAGES = {s["id"]: s for s in MAN["stages"]}
FINAL_OFF = {k: Vector(v) for k, v in STAGES["FINAL_EXPLODE"]["offsets"].items()}

RIDERS = list(STAGES["MOTHERBOARD_OUT"].get("riders", []))
BOARD_D = Vector((-0.38, 0, 0))

# M2_SSD is special (pivot): handled explicitly below; its park after
# STORAGE_OUT is BOARD_D + (-0.15 X) with 12 deg tilt, then FINAL flat.
M2_PIVOT = Vector((0.0877, 0.010, 0.229))     # connector edge line (Z axis)
M2_TILT = math.radians(12)

MOVABLE = sorted(set(RIDERS + [
    "CASE_SIDE_PANEL", "MOTHERBOARD", "GPU", "STORAGE", "PSU",
    "CASE_FAN_01", "CASE_FAN_02", "CASE_FAN_03",
    "CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER", "M2_SSD"]))

# ----------------------------------------------------------------------------
# key collection
# ----------------------------------------------------------------------------
KEYS = {name: [] for name in MOVABLE}   # (frame, Vector delta, rot_z, interp, easing)


def k(name, f, d=(0, 0, 0), r=0.0, interp="BEZIER", easing="AUTO"):
    KEYS[name].append((int(f), Vector(d), float(r), interp, easing))


def arc_delta(theta):
    """Exact delta for rotating the M.2 about its connector edge (Z axis)."""
    r = Matrix.Rotation(theta, 3, 'Z')
    o0 = Vector((0.0877, 0.050, 0.229))
    return (r - Matrix.Identity(3)) @ (o0 - M2_PIVOT)


# ----------------------------------------------------------------------------
# timeline
# ----------------------------------------------------------------------------
stage_meta = [{"id": "ASSEMBLED", "start": 1, "end": 24}]
t = 24

for name in MOVABLE:                      # rest pose hold
    k(name, 1, (0, 0, 0))
    k(name, t, (0, 0, 0))

# -- 1 OPEN_CASE -------------------------------------------------------------
p = "CASE_SIDE_PANEL"
k(p, t + 20, (0, 0.03, 0), 0, "SINE", "EASE_IN_OUT")          # slide rearward
k(p, t + 26, (0, 0.03, 0))                                    # beat
k(p, t + 62, (-0.27, 0.03, 0), 0, "SINE", "EASE_IN_OUT")      # lift away
k(p, t + 68, (-0.27, 0.03, 0))                                # beat
# REV 3.2: set aside at +Y 0.45 — a park at Y 0 sits inside the GPU/RAM/cooler
# extraction corridor (their -X travel crosses the panel plane at Y <= 0.185).
k(p, t + 92, (-0.30, 0.45, 0), 0, "SINE", "EASE_IN_OUT")
t += 100
stage_meta.append({"id": "OPEN_CASE", "start": 24, "park": t})
t += 8

# -- 2 MOTHERBOARD_OUT (with riders) ------------------------------------------
grp = ["MOTHERBOARD"] + RIDERS
for name in grp:
    k(name, t, BOARD_D * 0)
s0 = t

# REV 3.4: power-cable disconnect sub-sequence.  The MB/GPU-side connectors
# disengage and clear the board+GPU extraction corridor while the board still
# sits on its standoffs; the PSU-side ends stay mated until SECONDARY_OUT.
# Cable curves flex via keyed bezier end points (handles ride along) and the
# connector children get matching local keys.  Deltas derive from the frozen
# rest AABBs: every cleared plug/sleeve exits the swept Y/Z footprints of
# MOTHERBOARD and GPU before the board lifts.  Order: release beat ->
# 24PIN out -> CPU/EPS out -> GPU pwr out -> corridor clear -> board travel.
DIS_CONN = {"CABLE_24PIN": "CABLE_24PIN_CONN_MB",
            "CABLE_CPU_POWER": "CABLE_CPU_POWER_CONN_MB",
            "CABLE_GPU_POWER": "CABLE_GPU_POWER_CONN_GPU"}
DIS_UNPLUG = {"CABLE_24PIN": Vector((-0.004, 0, 0)),
              "CABLE_CPU_POWER": Vector((-0.02, 0, 0)),
              "CABLE_GPU_POWER": Vector((0, 0, 0.02))}
# clear vectors keep >=6 mm margin from every later sweep.  QA iteration 1
# found: (a) the board's -Y 0.01 swing eats the 24-pin's 5 mm Y margin and the
# trailing sleeve dragged the board underside to f180 -> -Y 0.086 + -Z 0.06;
# (b) the GPU cable's rising pt0->pt1 span crossed the sliding plate at
# f187 -> pt1 extra now drops the span flat below the lifted board bottom.
# QA iteration 3 found: the 24-pin connector's latch corner reaches X 0.053
# (beyond its AABB) and grazes CASE_FAN_01's corner at SECONDARY_OUT ->
# drop the clear pose under the fan frame bottom (Z 0.11).
DIS_CLEAR = {"CABLE_24PIN": Vector((-0.004, -0.086, -0.068)),
             "CABLE_CPU_POWER": Vector((-0.02, 0, 0.033)),
             "CABLE_GPU_POWER": Vector((0, 0.076, 0.02))}
# bezier point weights (free end = 1.0); pt1 of GPU cable overshoots +Y so the
# rising sleeve segment clears the board's bottom-rear edge, then drops -Z so
# the pt0->pt1 span stays under the lifted board during the -X slide
DIS_PT_W = {"CABLE_24PIN": {3: 1.0, 2: 1.0, 1: 0.3},
            "CABLE_CPU_POWER": {3: 1.0, 2: 1.0, 1: 0.3},
            "CABLE_GPU_POWER": {2: 1.0, 1: 1.0}}
DIS_PT_EXTRA = {"CABLE_GPU_POWER": {1: Vector((0, 0.014, -0.05))}}
# (unplug_start, unplug_end, clear_start, clear_end) offsets from s0
DIS_T = {"CABLE_24PIN": (8, 14, 16, 26),
         "CABLE_CPU_POWER": (12, 18, 20, 28),
         "CABLE_GPU_POWER": (14, 20, 22, 30)}

CABLE_REST = {}
CKEYS = {cab: [] for cab in DIS_PT_W}   # (frame, pt, delta, interp, easing)
CONNS = list(DIS_CONN.values())
CONN_KEYS = {c: [] for c in CONNS}
for cab in DIS_PT_W:
    sp = bpy.data.objects[cab].data.splines[0]
    CABLE_REST[cab] = [(bp.co.copy(), bp.handle_left.copy(), bp.handle_right.copy())
                       for bp in sp.bezier_points]
    a, b, c, d = DIS_T[cab]
    for i, w in DIS_PT_W[cab].items():
        extra = DIS_PT_EXTRA.get(cab, {}).get(i, Vector((0, 0, 0)))
        CKEYS[cab] += [
            (s0 + a, i, Vector((0, 0, 0)), "BEZIER", "AUTO"),
            (s0 + b, i, DIS_UNPLUG[cab] * w, "QUAD", "EASE_OUT"),
            (s0 + c, i, DIS_UNPLUG[cab] * w, "BEZIER", "AUTO"),
            (s0 + d, i, DIS_CLEAR[cab] * w + extra, "SINE", "EASE_IN_OUT")]
    cn = DIS_CONN[cab]
    CONN_KEYS[cn] += [
        (s0 + a, Vector((0, 0, 0)), 0.0, "BEZIER", "AUTO"),
        (s0 + b, DIS_UNPLUG[cab], 0.0, "QUAD", "EASE_OUT"),
        (s0 + c, DIS_UNPLUG[cab], 0.0, "BEZIER", "AUTO"),
        (s0 + d, DIS_CLEAR[cab], 0.0, "SINE", "EASE_IN_OUT")]

for name in grp:
    k(name, s0 + 8, (0, 0, 0))                                # screw-release beat
    # REV 3.4: board travel starts only after the cable disconnect
    # sub-sequence has cleared the corridor (cables clear by s0+30).
    k(name, s0 + 32, (0, 0, 0.012), 0, "QUAD", "EASE_OUT")    # lift off standoffs
    k(name, s0 + 38, (0, -0.01, 0.012), 0, "QUAD", "EASE_OUT")  # swing clear
    k(name, s0 + 44, (0, -0.01, 0.012))                       # beat
    k(name, s0 + 80, (-0.386, -0.01, 0.012), 0, "SINE", "EASE_IN_OUT")
    k(name, s0 + 86, (-0.38, 0, 0), 0, "QUAD", "EASE_OUT")    # settle to park
t = s0 + 90
stage_meta.append({"id": "MOTHERBOARD_OUT", "start": s0, "park": t})
t += 8

# -- 3 CPU_COOLER_OUT (settle before CPU) --------------------------------------
p = "CPU_COOLER"
s0 = t
k(p, s0, BOARD_D)
k(p, s0 + 8, BOARD_D)                                         # mount release beat
k(p, s0 + 18, BOARD_D + Vector((-0.01, 0, 0)), 0, "QUAD", "EASE_OUT")
k(p, s0 + 22, BOARD_D + Vector((-0.01, 0, 0)))
k(p, s0 + 58, BOARD_D + Vector((-0.306, 0, 0)), 0, "SINE", "EASE_IN_OUT")
k(p, s0 + 66, BOARD_D + Vector((-0.30, 0, 0)), 0, "QUAD", "EASE_OUT")
t = s0 + 78
stage_meta.append({"id": "CPU_COOLER_OUT", "start": s0, "park": t})
t += 8

# -- 4 CPU_OUT ------------------------------------------------------------------
p = "CPU"
s0 = t
k(p, s0, BOARD_D)
k(p, s0 + 8, BOARD_D)                                         # retention lever beat
k(p, s0 + 16, BOARD_D + Vector((-0.008, 0, 0)), 0, "QUAD", "EASE_OUT")
k(p, s0 + 46, BOARD_D + Vector((-0.226, 0, 0)), 0, "SINE", "EASE_IN_OUT")
k(p, s0 + 54, BOARD_D + Vector((-0.22, 0, 0)), 0, "QUAD", "EASE_OUT")
t = s0 + 66
stage_meta.append({"id": "CPU_OUT", "start": s0, "park": t})
t += 8

# -- 5 RAM_OUT (sequential: latch -> pop -> extract -> settle) ------------------
s0 = t
for i, p in enumerate(("RAM_01", "RAM_02", "RAM_03", "RAM_04")):
    a = s0 + i * 36
    k(p, a, BOARD_D)
    k(p, a + 6, BOARD_D)                                      # latch release beat
    k(p, a + 14, BOARD_D + Vector((-0.008, 0, 0)), 0, "QUAD", "EASE_OUT")  # pop
    k(p, a + 38, BOARD_D + Vector((-0.256, 0, 0)), 0, "SINE", "EASE_IN_OUT")
    k(p, a + 44, BOARD_D + Vector((-0.25, 0, 0)), 0, "QUAD", "EASE_OUT")
t = s0 + 3 * 36 + 52
stage_meta.append({"id": "RAM_OUT", "start": s0, "park": t})
t += 8

# -- 6 GPU_OUT (rides board; latch -> disengage -> slide clear of parked board)
p = "GPU"
s0 = t
k(p, s0, BOARD_D)
k(p, s0 + 8, BOARD_D)                                       # bracket+latch beat
k(p, s0 + 18, BOARD_D + Vector((-0.01, 0, 0)), 0, "QUAD", "EASE_OUT")  # disengage
k(p, s0 + 22, BOARD_D + Vector((-0.01, 0, 0)))
k(p, s0 + 62, BOARD_D + Vector((-0.176, 0, 0)), 0, "SINE", "EASE_IN_OUT")
k(p, s0 + 70, BOARD_D + Vector((-0.17, 0, 0)), 0, "QUAD", "EASE_OUT")
t = s0 + 82
stage_meta.append({"id": "GPU_OUT", "start": s0, "park": t})
t += 8

# -- 7 STORAGE_OUT (M.2 pivot->disengage->clear ; STORAGE lift) -----------------
s0 = t
p = "M2_SSD"
k(p, s0, BOARD_D)
k(p, s0 + 6, BOARD_D)                                         # standoff screw beat
f = s0 + 6
steps = 6
for i in range(1, steps + 1):                                 # pivot arc, sampled
    th = M2_TILT * i / steps
    k(p, f + i * 3, BOARD_D + arc_delta(th), th,
      "BEZIER" if i < steps else "BEZIER", "AUTO")
k(p, f + steps * 3 + 4, BOARD_D + arc_delta(M2_TILT), M2_TILT)          # beat
k(p, f + steps * 3 + 16, BOARD_D + arc_delta(M2_TILT) + Vector((-0.02, 0, 0)),
  M2_TILT, "QUAD", "EASE_OUT")                                # disengage
k(p, f + steps * 3 + 36, BOARD_D + arc_delta(M2_TILT) + Vector((-0.15, 0, 0)),
  M2_TILT, "SINE", "EASE_IN_OUT")                             # clear the board
p = "STORAGE"
k(p, s0, (0, 0, 0))
k(p, s0 + 6, (0, 0, 0))                                       # screw beat
# REV 3.2: slide +Y 0.03 out of the sled first — the straight +Z lift clips
# the front fans' corner (shared Y band -0.19..-0.18) near Z 0.11-0.25.
k(p, s0 + 14, (0, 0.03, 0), 0, "QUAD", "EASE_OUT")
k(p, s0 + 18, (0, 0.03, 0))                                   # beat
k(p, s0 + 42, (0, 0.03, 0.156), 0, "SINE", "EASE_IN_OUT")     # lift off shroud
k(p, s0 + 48, (0, 0.03, 0.15), 0, "QUAD", "EASE_OUT")         # settle
t = s0 + 74
stage_meta.append({"id": "STORAGE_OUT", "start": s0, "park": t})
t += 8

# -- 8 PSU_OUT (disengage -> rearward slide -> settle) ---------------------------
p = "PSU"
s0 = t
k(p, s0, (0, 0, 0))
k(p, s0 + 8, (0, 0, 0))                                       # 4-screw beat
k(p, s0 + 48, (0, 0.406, 0), 0, "SINE", "EASE_IN_OUT")
k(p, s0 + 56, (0, 0.40, 0), 0, "QUAD", "EASE_OUT")
t = s0 + 68
stage_meta.append({"id": "PSU_OUT", "start": s0, "park": t})
t += 8

# -- 9 SECONDARY_OUT (fans unbolt staggered; cables unplug -> route) -------------
s0 = t
for i, (p, ax, d) in enumerate((("CASE_FAN_01", (0, -1, 0), 0.24),
                                ("CASE_FAN_02", (0, -1, 0), 0.24),
                                ("CASE_FAN_03", (0, 1, 0), 0.40))):
    a = s0 + i * 12
    k(p, a, (0, 0, 0))
    k(p, a + 6, (0, 0, 0))                                    # unbolt beat
    ov = Vector(ax) * (d + 0.006)
    k(p, a + 6 + (30 if d > 0.3 else 24), ov, 0, "SINE", "EASE_IN_OUT")
    k(p, a + 12 + (30 if d > 0.3 else 24), Vector(ax) * d, 0, "QUAD", "EASE_OUT")
# REV 3.4: board-side connectors already sit at their cleared pose, so the
# object-level unplug beat now releases the PSU-side end.  Legs are absolute
# deltas from rest: unplug -> inboard leg -> route -> presentation settle.
# CPU cable lifts +Z before any +Y travel: its PSU plug starts embedded in
# the PSU top face, and a +Y tug at low Z clips the parked PSU's corner
# (QA iteration 4).  The FINAL settle drops the plug back onto the departed
# PSU top exactly like assembled rest (cable-last presentation contact).
for p, unplug, leg1, leg2, pres in (
        ("CABLE_24PIN", (-0.02, 0, 0), (-0.02, 0.08, 0), (-0.02, 0.24, 0), (0, 0.30, 0)),
        ("CABLE_CPU_POWER", (0, 0, 0.02), (0, 0, 0.09), (0, 0.28, 0.09), (0, 0.34, 0)),
        ("CABLE_GPU_POWER", (0, 0, 0.02), (0, 0.08, 0.02), (0, 0.26, 0.02), (0, 0.32, 0))):
    k(p, s0, (0, 0, 0))
    k(p, s0 + 10, unplug, 0, "QUAD", "EASE_OUT")              # unplug (PSU side)
    k(p, s0 + 14, unplug)
    k(p, s0 + 34, leg1, 0, "SINE", "EASE_IN_OUT")             # inboard/lift leg
    k(p, s0 + 46, leg2, 0, "SINE", "EASE_IN_OUT")             # route clear
    k(p, s0 + 50, leg2)
    k(p, s0 + 66, pres, 0, "SINE", "EASE_IN_OUT")             # presentation park
t = s0 + 76
stage_meta.append({"id": "SECONDARY_OUT", "start": s0, "park": t})
t += 8

# -- 10 FINAL_EXPLODE (organized park along extraction axes) --------------------
s0 = t
for name in MOVABLE:
    cur = KEYS[name][-1][1]
    cur_r = KEYS[name][-1][2]
    k(name, s0, cur, cur_r)                                   # hold at removal park
    k(name, s0 + 60, FINAL_OFF[name], 0.0, "SINE", "EASE_IN_OUT")
END = s0 + 84
for name in MOVABLE:
    k(name, END, FINAL_OFF[name])
stage_meta.append({"id": "FINAL_EXPLODE", "start": s0, "park": s0 + 60, "end": END})

# ----------------------------------------------------------------------------
# build keys via keyframe_insert (Blender 5.x layered action API has no
# Action.fcurves; insertion creates the slot/layer structure for us)
# ----------------------------------------------------------------------------
def iter_fcurves(act):
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    yield fc


for name in MOVABLE:
    o = bpy.data.objects[name]
    o.animation_data_clear()
    o.animation_data_create()
    rest = o.location.copy()
    entries = sorted(KEYS[name], key=lambda e: e[0])
    for f, d, r, interp, easing in entries:
        o.location = rest + d
        o.keyframe_insert("location", frame=f)
        if abs(r) > 1e-9 or any(abs(e[2]) > 1e-9 for e in entries):
            o.rotation_euler = (0.0, 0.0, r)
            o.keyframe_insert("rotation_euler", index=2, frame=f)
    o.location = rest
    o.rotation_euler = (0, 0, 0)
    act = o.animation_data.action
    act.name = f"{ACTION_PREFIX}_{name}"
    fmap = {int(f): (interp, easing) for f, d, r, interp, easing in entries}
    for fc in iter_fcurves(act):
        for kp in fc.keyframe_points:
            interp, easing = fmap.get(int(round(kp.co.x)), ("BEZIER", "AUTO"))
            kp.interpolation = interp
            if interp == "BEZIER":
                kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
            else:
                kp.easing = easing if easing != "AUTO" else "EASE_IN_OUT"
        fc.update()

# ----------------------------------------------------------------------------
# REV 3.4: connector children (local keys) + cable curve flex (bezier points)
# ----------------------------------------------------------------------------
for name in CONNS:
    o = bpy.data.objects[name]
    o.animation_data_clear()
    o.animation_data_create()
    resto = o.location.copy()
    entries = sorted(CONN_KEYS[name], key=lambda e: e[0])
    for f, d, r, interp, easing in entries:
        o.location = resto + d
        o.keyframe_insert("location", frame=f)
    o.location = resto
    act = o.animation_data.action
    act.name = f"{ACTION_PREFIX}_{name}_disconnect"
    fmap = {int(f): (interp, easing) for f, d, r, interp, easing in entries}
    for fc in iter_fcurves(act):
        for kp in fc.keyframe_points:
            interp, easing = fmap.get(int(round(kp.co.x)), ("BEZIER", "AUTO"))
            kp.interpolation = interp
            if interp == "BEZIER":
                kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
            else:
                kp.easing = easing if easing != "AUTO" else "EASE_IN_OUT"
        fc.update()

for cab in DIS_PT_W:
    cu = bpy.data.objects[cab].data
    cu.animation_data_clear()
    cu.animation_data_create()
    sp = cu.splines[0]
    entries = sorted(CKEYS[cab], key=lambda e: (e[0], e[1]))
    for f, i, dl, interp, easing in entries:
        rco, rhl, rhr = CABLE_REST[cab][i]
        bp = sp.bezier_points[i]
        bp.co = rco + dl
        bp.handle_left = rhl + dl
        bp.handle_right = rhr + dl
        bp.keyframe_insert("co", frame=f)
        bp.keyframe_insert("handle_left", frame=f)
        bp.keyframe_insert("handle_right", frame=f)
    for i, (rco, rhl, rhr) in enumerate(CABLE_REST[cab]):
        bp = sp.bezier_points[i]
        bp.co = rco
        bp.handle_left = rhl
        bp.handle_right = rhr
    act = cu.animation_data.action
    act.name = f"{ACTION_PREFIX}_{cab}_flex"
    fmap = {(int(f), i): (interp, easing) for f, i, dl, interp, easing in entries}
    for fc in iter_fcurves(act):
        mm = re.search(r"bezier_points\[(\d+)\]", fc.data_path)
        pi = int(mm.group(1)) if mm else -1
        for kp in fc.keyframe_points:
            interp, easing = fmap.get((int(round(kp.co.x)), pi), ("BEZIER", "AUTO"))
            kp.interpolation = interp
            if interp == "BEZIER":
                kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
            else:
                kp.easing = easing if easing != "AUTO" else "EASE_IN_OUT"
        fc.update()

sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start = 1
sc.frame_end = END

meta = {"fps": FPS, "frame_start": 1, "frame_end": END,
        "action_prefix": ACTION_PREFIX, "stages": stage_meta}
with open(OUT_STAGES, "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2)

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, check_existing=False)
print("ANIM_FRAMES", END)
print("ANIM_OK ->", OUT_BLEND)
