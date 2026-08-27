"""PC anatomy detail pass (Step 3).

Loads the frozen blockout (build/blockout.blend) and enhances it WITHOUT
touching the assembly architecture:

- the blockout ARCHITECTURE is locked: object names, hierarchy, origins,
  custom props, envelopes and the disassembly manifest are preserved
  (the QA blockout contract must still pass on the result);
- selected component meshes (CPU_COOLER, GPU, RAM_01-04, CASE_FAN_01-03)
  are internally REBUILT within their approved object envelopes
  (capture -> retire -> rebuild -> register with the old identity).
  This is a mesh-level rebuild inside the envelope, not an architecture
  change;
- all other components gain joined detail parts (caps, battery, SATA, lever,
  power button, labels, PSU inlet, ...);
- a deliberate PBR material language replaces the monochrome blockout mats.

Run:  blender -b build/blockout.blend --python scripts/build_detail.py
Out:  build/detail.blend
"""
import math
import os
import sys

import bpy
from mathutils import Matrix

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)
import build_blockout as BB  # frozen blockout builder: constants + helpers

ROOT = BB.ROOT
IN_BLEND = os.path.join(ROOT, "build", "blockout.blend")
OUT_BLEND = os.path.join(ROOT, "build", "detail.blend")

BS, SF = BB.BS, BB.SF


# ----------------------------------------------------------------------------
# Material language (deliberate taxonomy, web-friendly PBR values)
# ----------------------------------------------------------------------------
def dmat(name, color, metallic, rough, transmission=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if "Transmission Weight" in b.inputs:
        b.inputs["Transmission Weight"].default_value = transmission
    if "IOR" in b.inputs and transmission > 0:
        b.inputs["IOR"].default_value = 1.45
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    return m


def build_detail_materials():
    return {
        "chassis":   dmat("MAT_CHASSIS_COATED",  (0.036, 0.039, 0.046), 0.30, 0.50),  # coated steel
        "glass":     dmat("MAT_GLASS_TEMPERED",  (0.90, 0.93, 0.95), 0.0, 0.05, 1.0, 0.30),
        "pcb":       dmat("MAT_PCB_MAIN",        (0.017, 0.021, 0.027), 0.10, 0.45),  # near-black PCB
        "alu":       dmat("MAT_ALU_HEATSINK",    (0.52, 0.54, 0.57), 1.0, 0.30),      # brushed aluminum
        "alu_dark":  dmat("MAT_ALU_ANODIZED",  (0.18, 0.19, 0.22), 1.0, 0.40),      # anodized backplate
        "steel":     dmat("MAT_STEEL_ZINC",      (0.38, 0.40, 0.43), 1.0, 0.35),      # zinc-plated brackets
        "ihs":       dmat("MAT_CPU_NICKEL",      (0.62, 0.63, 0.65), 1.0, 0.18),      # nickel IHS
        "substrate": dmat("MAT_CPU_SUBSTRATE",   (0.020, 0.045, 0.028), 0.0, 0.50),   # package substrate
        "shroud":    dmat("MAT_SHROUD_PLASTIC",  (0.055, 0.058, 0.066), 0.0, 0.45),   # semi-gloss plastic
        "fan":       dmat("MAT_FAN_PLASTIC",     (0.045, 0.046, 0.052), 0.0, 0.42),
        "spreader":  dmat("MAT_RAM_SPREADER",    (0.30, 0.32, 0.36), 1.0, 0.35),
        "connector": dmat("MAT_CONNECTOR",       (0.028, 0.029, 0.033), 0.0, 0.55),
        "cable":     dmat("MAT_CABLE_SLEEVE",    (0.026, 0.026, 0.031), 0.0, 0.70),
        "label":     dmat("MAT_LABEL_NEUTRAL", (0.13, 0.14, 0.15), 0.0, 0.55),      # no text, neutral
        "gold":      dmat("MAT_CONTACT_GOLD",    (0.85, 0.65, 0.25), 1.0, 0.28),
        "psu":       dmat("MAT_PSU_COATED",      (0.040, 0.041, 0.046), 0.30, 0.48),
        "storage":   dmat("MAT_STORAGE_CASE",    (0.050, 0.053, 0.060), 0.40, 0.45),
    }


# ----------------------------------------------------------------------------
# Small helpers
# ----------------------------------------------------------------------------
box, cylinder, join_parts, set_origin, set_parent = (
    BB.box, BB.cylinder, BB.join_parts, BB.set_origin, BB.set_parent)


def swap(obj, old_name, new_mat):
    """Replace a material slot's datablock by the old material's name."""
    old = bpy.data.materials.get(old_name)
    if not old:
        return
    for i, s in enumerate(obj.material_slots):
        if s.material == old:
            s.material = new_mat


def reassign(obj, old_name, new_mat, pred):
    """Polygon-level reassign: faces of old_name whose center passes pred."""
    old = bpy.data.materials.get(old_name)
    if not old or old_name not in [m.name for m in obj.data.materials if m]:
        return
    idx_old = list(obj.data.materials).index(old)
    if new_mat.name not in [m.name for m in obj.data.materials if m]:
        obj.data.materials.append(new_mat)
    idx_new = list(obj.data.materials).index(new_mat)
    mw = obj.matrix_world
    for p in obj.data.polygons:
        if p.material_index == idx_old and pred(mw @ p.center):
            p.material_index = idx_new


def merge_into(target, parts):
    """Join `parts` into the existing `target` object (both must be selected)."""
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()


def capture(name):
    o = bpy.data.objects[name]
    # Convert IDProperty arrays to plain Python lists: re-assigning the raw
    # bpy array objects back onto an object crashes Blender 5.2
    # (idp_from_PySequence access violation).
    props = {}
    for k in o.keys():
        if k.startswith("_"):
            continue
        v = o[k]
        if hasattr(v, "to_list"):
            v = v.to_list()
        props[k] = v
    return {"name": name, "parent": o.parent,
            "props": props,
            "origin": o.matrix_world.translation.copy()}


def retire(cap):
    o = bpy.data.objects.get(cap["name"])
    if o:
        bpy.data.objects.remove(o, do_unlink=True)


def register(o, cap, origin):
    set_origin(o, origin)
    o.parent = cap["parent"]
    for k, v in cap["props"].items():
        o[k] = v


def bladed_fan(prefix, center, axis, r_out, mat, n=9):
    """Hub + pitched blades for an axial fan; axis in {'X','Y','Z'}."""
    parts = []
    rot = {"X": (0, math.radians(90), 0), "Y": (math.radians(90), 0, 0), "Z": (0, 0, 0)}[axis]
    parts.append(cylinder(prefix + "_hub", r_out * 0.32, 0.024, center, rot, mat))
    for k in range(n):
        ang = 2 * math.pi * k / n
        if axis == "Z":
            b = box(prefix + f"_b{k}", (r_out * 0.72, 0.011, 0.014), (0, 0, 0), mat, bevel=0.0008)
            M = (Matrix.Translation(center) @ Matrix.Rotation(ang, 4, 'Z')
                 @ Matrix.Translation((r_out * 0.62, 0, 0)) @ Matrix.Rotation(math.radians(35), 4, 'X'))
        else:
            b = box(prefix + f"_b{k}", (0.014, 0.011, r_out * 0.72), (0, 0, 0), mat, bevel=0.0008)
            M = (Matrix.Translation(center) @ Matrix.Rotation(ang, 4, axis)
                 @ Matrix.Translation((0, 0, r_out * 0.62)) @ Matrix.Rotation(math.radians(35), 4, 'Z'))
        b.matrix_world = M
        parts.append(b)
    return parts


# ----------------------------------------------------------------------------
# Component builders (detailed, same envelopes as the blockout)
# ----------------------------------------------------------------------------
def build_cooler(M):
    fan_cx = 0.0177
    parts = [box("cl_base", (0.006, 0.090, 0.060), (0.0782, 0.050, 0.272), M["alu"])]
    # real fin stack: thin plates with air gaps
    z = 0.2075
    while z <= 0.3325:
        parts.append(box(f"cl_fin{int(z * 10000)}", (0.045, 0.088, 0.0018), (0.0527, 0.050, z), M["alu"], bevel=0.0004))
        z += 0.0052
    # heatpipes through the stack (kept inside the fin depth so they clear
    # the M.2 stick that mounts beside the stack at Y~0.05, Z~0.23)
    for py, pz in ((0.028, 0.235), (-0.028, 0.235), (0.028, 0.305), (-0.028, 0.305)):
        parts.append(cylinder(f"cl_pipe{py}{pz}", 0.0035, 0.045, (0.0527, 0.050 + py, pz),
                              (0, math.radians(90), 0), M["alu"]))
    # fan: open rim frame (blades stay visible) + blades + hub
    parts.append(box("cl_fan_rim_t", (0.025, 0.120, 0.006), (fan_cx, 0.050, 0.327), M["fan"], bevel=0.002))
    parts.append(box("cl_fan_rim_b", (0.025, 0.120, 0.006), (fan_cx, 0.050, 0.213), M["fan"], bevel=0.002))
    parts.append(box("cl_fan_rim_l", (0.025, 0.006, 0.108), (fan_cx, -0.007, 0.270), M["fan"], bevel=0.002))
    parts.append(box("cl_fan_rim_r", (0.025, 0.006, 0.108), (fan_cx, 0.107, 0.270), M["fan"], bevel=0.002))
    parts += bladed_fan("cl_fan", (fan_cx, 0.050, 0.270), "X", 0.056, M["fan"], n=11)
    return join_parts("CPU_COOLER", parts)


def build_gpu(M):
    parts = [
        box("gpu_shroud", (0.117, 0.260, 0.030), (0.0215, 0.030, 0.165), M["shroud"], bevel=0.002),
        # fan bay rims protruding below the shroud
        cylinder("gpu_rim_a", 0.046, 0.010, (0.0215, -0.055, 0.146), (0, 0, 0), M["shroud"]),
        cylinder("gpu_rim_b", 0.046, 0.010, (0.0215, 0.045, 0.146), (0, 0, 0), M["shroud"]),
    ]
    parts += bladed_fan("gpu_fan_a", (0.0215, -0.055, 0.141), "Z", 0.040, M["fan"])
    parts += bladed_fan("gpu_fan_b", (0.0215, 0.045, 0.141), "Z", 0.040, M["fan"])
    parts += [
        box("gpu_pcb", (0.112, 0.220, 0.0016), (0.0295, 0.054, 0.1808), M["pcb"], bevel=0.0003),
        box("gpu_backplate", (0.112, 0.258, 0.0024), (0.024, 0.032, 0.183), M["alu_dark"], bevel=0.0006),
        box("gpu_edge_strip", (0.004, 0.240, 0.010), (-0.0355, 0.030, 0.168), M["alu_dark"], bevel=0.001),
        box("gpu_fingers", (0.0045, 0.078, 0.003), (0.08545, 0.105, 0.1795), M["gold"]),
        box("gpu_bracket", (0.120, 0.003, 0.036), (0.0277, 0.1815, 0.160), M["steel"], bevel=0.0005),
        box("gpu_port1", (0.014, 0.002, 0.007), (-0.010, 0.1832, 0.155), M["connector"]),
        box("gpu_port2", (0.014, 0.002, 0.007), (0.012, 0.1832, 0.155), M["connector"]),
        box("gpu_port3", (0.018, 0.002, 0.007), (0.036, 0.1832, 0.155), M["connector"]),
        box("gpu_pwr", (0.020, 0.024, 0.010), (-0.020, 0.125, 0.188), M["connector"], bevel=0.0008),
    ]
    return join_parts("GPU", parts)


def build_ram(i, y, M):
    parts = [
        box(f"ram{i}_pcb", (0.044, 0.0016, 0.133), (BS - 0.022, y, 0.270), M["pcb"]),
        box(f"ram{i}_sp_a", (0.040, 0.0024, 0.116), (BS - 0.022, y - 0.0026, 0.2765), M["spreader"], bevel=0.001),
        box(f"ram{i}_sp_b", (0.040, 0.0024, 0.116), (BS - 0.022, y + 0.0026, 0.2765), M["spreader"], bevel=0.001),
        box(f"ram{i}_top", (0.040, 0.0062, 0.010), (BS - 0.022, y, 0.330), M["spreader"], bevel=0.0015),
    ]
    return join_parts(f"RAM_{i:02d}", parts)


def build_case_fan(name, c, M):
    # open rim frame so the blades read from both sides
    cx, cy, cz = c
    parts = [
        box(name + "_rim_t", (0.120, 0.025, 0.006), (cx, cy, cz + 0.057), M["fan"], bevel=0.002),
        box(name + "_rim_b", (0.120, 0.025, 0.006), (cx, cy, cz - 0.057), M["fan"], bevel=0.002),
        box(name + "_rim_l", (0.006, 0.025, 0.108), (cx - 0.057, cy, cz), M["fan"], bevel=0.002),
        box(name + "_rim_r", (0.006, 0.025, 0.108), (cx + 0.057, cy, cz), M["fan"], bevel=0.002),
    ]
    parts += bladed_fan(name, c, "Y", 0.056, M["fan"], n=9)
    return join_parts(name, parts)


# ----------------------------------------------------------------------------
# Enhancements (joined into existing objects)
# ----------------------------------------------------------------------------
def enhance_motherboard(mobo, M):
    add = []
    # electrolytic capacitors in safe zones (audio row, below PCIe, right of socket)
    cap_spots = [(-0.105, 0.140), (-0.118, 0.140), (-0.131, 0.140), (-0.105, 0.155), (-0.118, 0.155),
                 (0.025, 0.160), (0.040, 0.160), (0.025, 0.172), (0.040, 0.172),
                 (0.105, 0.255), (0.118, 0.255), (0.105, 0.275), (0.118, 0.275)]
    for j, (cy, cz) in enumerate(cap_spots):
        add.append(cylinder(f"mb_cap{j}", 0.0035, 0.008, (0.0837, cy, cz), (0, math.radians(90), 0), M["alu_dark"]))
    # CMOS battery, SATA ports, front header, socket retention lever
    add.append(cylinder("mb_batt", 0.010, 0.003, (0.0845, 0.140, 0.210), (0, math.radians(90), 0), M["steel"]))
    add.append(box("mb_sata0", (0.008, 0.014, 0.007), (0.0837, 0.155, 0.128), M["connector"]))
    add.append(box("mb_sata1", (0.008, 0.014, 0.007), (0.0837, 0.155, 0.140), M["connector"]))
    add.append(box("mb_header", (0.005, 0.034, 0.008), (0.0852, -0.140, 0.120), M["connector"]))
    add.append(cylinder("mb_lever", 0.0015, 0.055, (0.0865, 0.082, 0.270), (0, 0, 0), M["steel"]))
    merge_into(mobo, add)


def enhance_case(case, M):
    add = [
        cylinder("case_pwr_btn", 0.006, 0.004, (-0.060, -0.195, 0.460), (0, 0, 0), M["steel"]),
        box("case_usb0", (0.012, 0.006, 0.004), (-0.030, -0.195, 0.461), M["connector"]),
        box("case_usb1", (0.012, 0.006, 0.004), (-0.012, -0.195, 0.461), M["connector"]),
    ]
    merge_into(case, add)


def enhance_psu(psu, M):
    add = [
        box("psu_inlet", (0.030, 0.002, 0.022), (0.060, 0.2172, 0.045), M["connector"]),
        box("psu_switch", (0.008, 0.002, 0.014), (0.020, 0.2172, 0.052), M["connector"]),
        box("psu_label", (0.001, 0.100, 0.060), (-0.0452, 0.148, 0.045), M["label"]),
    ]
    merge_into(psu, add)


def enhance_storage(st, M):
    lab = box("st_label", (0.060, 0.088, 0.001), (-0.020, -0.140, 0.0985), M["label"])
    merge_into(st, [lab])


def enhance_m2(m2, M):
    lab = box("m2_label", (0.001, 0.056, 0.016), (0.0792, 0.052, 0.229), M["label"])
    merge_into(m2, [lab])


def enhance_cpu(cpu, M):
    sub = box("cpu_sub", (0.0012, 0.045, 0.045), (0.0846, 0.050, 0.270), M["substrate"])
    merge_into(cpu, [sub])
    swap(cpu, "MAT_CPU", M["ihs"])


# ----------------------------------------------------------------------------
def main():
    # The blend is loaded via the CLI argument (proven stable in background
    # mode). open_mainfile is only a fallback if run without one.
    if not bpy.data.objects.get("PC_ROOT"):
        bpy.ops.wm.open_mainfile(filepath=IN_BLEND)
    M = build_detail_materials()

    # --- rebuilds (same envelope/origin/parent/props) -----------------------
    cap = capture("CPU_COOLER"); retire(cap)
    register(build_cooler(M), cap, (SF - 0.004, 0.050, 0.270))

    cap = capture("GPU"); retire(cap)
    register(build_gpu(M), cap, (BS, 0.040, 0.171))

    for i, y in enumerate([-0.002, -0.012, -0.022, -0.032], start=1):
        cap = capture(f"RAM_{i:02d}"); retire(cap)
        register(build_ram(i, y, M), cap, (BS, y, 0.270))

    for name, c in (("CASE_FAN_01", (0.0, -0.194, 0.170)),
                    ("CASE_FAN_02", (0.0, -0.194, 0.310)),
                    ("CASE_FAN_03", (-0.010, 0.194, 0.330))):
        cap = capture(name); retire(cap)
        register(build_case_fan(name, c, M), cap, c)

    # --- enhancements --------------------------------------------------------
    enhance_cpu(bpy.data.objects["CPU"], M)
    enhance_motherboard(bpy.data.objects["MOTHERBOARD"], M)
    enhance_case(bpy.data.objects["CASE"], M)
    enhance_psu(bpy.data.objects["PSU"], M)
    enhance_storage(bpy.data.objects["STORAGE"], M)
    enhance_m2(bpy.data.objects["M2_SSD"], M)

    # --- material language on remaining/old slots ----------------------------
    case = bpy.data.objects["CASE"]
    swap(case, "MAT_CASE", M["chassis"])
    swap(bpy.data.objects["CASE_SIDE_PANEL"], "MAT_GLASS", M["glass"])

    mobo = bpy.data.objects["MOTHERBOARD"]
    swap(mobo, "MAT_PCB", M["pcb"])
    swap(mobo, "MAT_PLASTIC", M["connector"])
    # metal on the mobo: I/O + socket frame = zinc steel, heatsinks = aluminum
    swap(mobo, "MAT_METAL", M["alu"])
    reassign(mobo, "MAT_ALU_HEATSINK", M["steel"],
             lambda c: c.y > 0.160 or (0.020 < c.y < 0.080 and 0.240 < c.z < 0.300 and c.x > 0.0845))

    for c in ("CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER"):
        swap(bpy.data.objects[c], "MAT_CABLE", M["cable"])

    swap(bpy.data.objects["PSU"], "MAT_PSU", M["psu"])
    swap(bpy.data.objects["STORAGE"], "MAT_STORAGE", M["storage"])
    swap(bpy.data.objects["M2_SSD"], "MAT_STORAGE", M["pcb"])   # M.2 stick = bare PCB

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, check_existing=False)
    total = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            total += len(o.data.loop_triangles)
    print("TRIS_TOTAL", total)
    print("DETAIL_OK ->", OUT_BLEND)


if __name__ == "__main__":
    main()
