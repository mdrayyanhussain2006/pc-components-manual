"""PC anatomy realism refinement (Step 3.5).

Loads build/detail.blend and raises visual realism while preserving every
existing contract (names, hierarchy, origins, props, envelopes, manifest,
material taxonomy, QA suites). No architecture changes; component meshes
are rebuilt/extended inside their approved envelopes.

Priorities (per review verdict):
  P1 motherboard population (VRM phases/inductors/MOSFETs, caps, chipset
     fins, 2nd M.2 slot + heatsink, DIMM latches, PCIe latch, audio block,
     headers, rear I/O ports, extra SATA)
  P2 GPU (open shroud, internal fin stack, profiled blades, hub caps,
     bracket tab/port tongues/power pins)
  P3 CPU cooler (denser fins, U-bent heatpipes, two-segment blades, hub
     dome, corner posts, mounting bracket + spring screws)
  P4 PSU (hex vent field, modular connector panel, seams, corner screws)
  P5 RAM (gold edge contacts, IC chips, spreader accents)
  P6 cable connector ends (parented to the cable curves; curves preserved)
  P7 subtle procedural bump/roughness micro-detail on existing materials
     (preview realism; glTF baking is a later Step-5 decision)

Triangle target 15k-30k, hard ceiling 60k (checked by qa_detail.py).

Run:  blender -b build/detail.blend --python scripts/build_realism.py
Out:  build/detail.blend (enhanced in place)
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)
import build_blockout as BB
import build_detail as BD

ROOT = BB.ROOT
BLEND = os.path.join(ROOT, "build", "detail.blend")
BS, SF = BB.BS, BB.SF

box, cylinder, join_parts = BB.box, BB.cylinder, BB.join_parts
capture, retire, register, merge_into = BD.capture, BD.retire, BD.register, BD.merge_into


def sphere(name, r, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=12, ring_count=8)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.materials.append(mat)
    return o


# ----------------------------------------------------------------------------
# two-segment profiled fan blades + capped hub
# ----------------------------------------------------------------------------
def bladed_fan2(prefix, center, axis, r_out, mat, n=9):
    parts = []
    rot = {"X": (0, math.radians(90), 0), "Y": (math.radians(90), 0, 0),
           "Z": (0, 0, 0)}[axis]
    capd = {"X": (-1, 0, 0), "Y": (0, -1, 0), "Z": (0, 0, -1)}[axis]
    parts.append(cylinder(prefix + "_hub", r_out * 0.30, 0.020, center, rot, mat))
    cc = tuple(c + d * 0.011 for c, d in zip(center, capd))
    parts.append(cylinder(prefix + "_cap", r_out * 0.21, 0.008, cc, rot, mat))
    p1 = math.radians(28)
    for k in range(n):
        ang = 2 * math.pi * k / n
        base = Matrix.Translation(center) @ Matrix.Rotation(ang, 4, axis)
        if axis == "Z":
            dims = (r_out * 0.40, 0.011, 0.012)
            t1 = Matrix.Translation((r_out * 0.36, 0, 0)) @ Matrix.Rotation(p1, 4, 'X')
            t2 = Matrix.Translation((r_out * 0.68, 0, 0)) @ Matrix.Rotation(p1 + math.radians(20), 4, 'X')
        else:
            dims = (0.012, 0.011, r_out * 0.40) if axis == "X" else (0.011, 0.012, r_out * 0.40)
            t1 = Matrix.Translation((0, 0, r_out * 0.36)) @ Matrix.Rotation(p1, 4, 'Z')
            t2 = Matrix.Translation((0, 0, r_out * 0.68)) @ Matrix.Rotation(p1 + math.radians(20), 4, 'Z')
        for tag, t in (("a", t1), ("b", t2)):
            b = box(prefix + f"_b{k}{tag}", dims, (0, 0, 0), mat, bevel=0.0008)
            b.matrix_world = base @ t
            parts.append(b)
    return parts


# ----------------------------------------------------------------------------
# P1 motherboard
# ----------------------------------------------------------------------------
def enhance_motherboard(mobo, M):
    add = []
    # VRM phase array: inductors + MOSFETs (top row + rear column)
    ys = [0.016 + 0.010 * k for k in range(8)]
    for y in ys:
        add.append(box("mr_ind_t", (0.006, 0.008, 0.008), (0.0847, y, 0.300), M["ALU_ANODIZED"], bevel=0.0006))
        add.append(box("mr_fet_t", (0.0035, 0.005, 0.004), (0.0857, y, 0.292), M["CONNECTOR"]))
    zs = [0.246 + 0.010 * k for k in range(6)]
    for z in zs:
        add.append(box("mr_ind_r", (0.006, 0.008, 0.008), (0.0847, 0.100, z), M["ALU_ANODIZED"], bevel=0.0006))
        add.append(box("mr_fet_r", (0.0035, 0.004, 0.005), (0.0857, 0.092, z), M["CONNECTOR"]))
    # small polymer caps around VRM / audio
    for (cy, cz) in [(0.020, 0.312), (0.040, 0.312), (0.060, 0.312), (0.080, 0.312),
                     (0.108, 0.250), (0.108, 0.270), (0.108, 0.290),
                     (-0.088, 0.150), (-0.096, 0.150), (-0.092, 0.158)]:
        add.append(cylinder("mr_cap", 0.0018, 0.007, (0.0847, cy, cz), (0, math.radians(90), 0), M["ALU_ANODIZED"]))
    # VRM heatsink rails over the phase array (finned blocks)
    add.append(box("mr_vrm_rail_t", (0.010, 0.088, 0.016), (0.0867, 0.051, 0.298), M["ALU_ANODIZED"], bevel=0.0008))
    add.append(box("mr_vrm_rail_r", (0.010, 0.016, 0.066), (0.0867, 0.098, 0.271), M["ALU_ANODIZED"], bevel=0.0008))
    for fy in (0.022, 0.038, 0.054, 0.070):
        add.append(box("mr_vrm_fin", (0.011, 0.0018, 0.018), (0.0867, fy, 0.298), M["ALU_HEATSINK"]))
    for fz in (0.248, 0.262, 0.276, 0.290):
        add.append(box("mr_vrm_fin", (0.011, 0.018, 0.0018), (0.0867, 0.098, fz), M["ALU_HEATSINK"]))
    # chipset fin heatsink
    for fx in (0.077, 0.080, 0.083, 0.086):
        add.append(box("mr_chp_fin", (0.0018, 0.036, 0.020), (fx, 0.100, 0.131), M["ALU_HEATSINK"], bevel=0.0004))
    # second M.2 slot (empty) with low heatsink
    add.append(box("mr_m2b_conn", (0.006, 0.012, 0.006), (0.0847, 0.105, 0.205), M["CONNECTOR"]))
    add.append(cylinder("mr_m2b_post", 0.0018, 0.005, (0.0852, 0.150, 0.205), (0, math.radians(90), 0), M["STEEL_ZINC"]))
    add.append(box("mr_m2b_sink", (0.004, 0.060, 0.014), (0.0847, 0.122, 0.205), M["ALU_ANODIZED"], bevel=0.0008))
    # DIMM latches (both ends of each slot)
    for sy in (-0.002, -0.012, -0.022, -0.032):
        add.append(box("mr_latch_lo", (0.004, 0.008, 0.005), (0.0857, sy, 0.199), M["CONNECTOR"], bevel=0.0006))
        add.append(box("mr_latch_hi", (0.004, 0.008, 0.005), (0.0857, sy, 0.341), M["CONNECTOR"], bevel=0.0006))
    # PCIe retention latch
    add.append(box("mr_pcie_latch", (0.004, 0.006, 0.006), (0.0857, 0.153, 0.186), M["CONNECTOR"], bevel=0.0006))
    # audio codec block
    add.append(box("mr_audio", (0.004, 0.010, 0.010), (0.0857, -0.105, 0.135), M["CONNECTOR"], bevel=0.0006))
    # headers: USB, front panel, two fan headers
    add.append(box("mr_hdr_usb", (0.004, 0.018, 0.008), (0.0857, -0.140, 0.140), M["CONNECTOR"]))
    add.append(box("mr_hdr_fp", (0.004, 0.026, 0.006), (0.0857, -0.150, 0.120), M["CONNECTOR"]))
    add.append(box("mr_hdr_fan0", (0.004, 0.010, 0.006), (0.0857, -0.060, 0.150), M["CONNECTOR"]))
    add.append(box("mr_hdr_fan1", (0.004, 0.010, 0.006), (0.0857, -0.075, 0.150), M["CONNECTOR"]))
    # rear I/O port stack (USB/LAN blocks, display outputs, audio jacks)
    add.append(box("mr_io_a", (0.008, 0.016, 0.022), (0.0847, 0.1725, 0.300), M["STEEL_ZINC"], bevel=0.0006))
    add.append(box("mr_io_b", (0.008, 0.016, 0.022), (0.0847, 0.1725, 0.276), M["STEEL_ZINC"], bevel=0.0006))
    add.append(box("mr_io_dp0", (0.006, 0.012, 0.009), (0.0847, 0.1725, 0.240), M["STEEL_ZINC"], bevel=0.0005))
    add.append(box("mr_io_dp1", (0.006, 0.012, 0.009), (0.0847, 0.1725, 0.251), M["STEEL_ZINC"], bevel=0.0005))
    for j, ay in enumerate((0.164, 0.172, 0.180)):
        add.append(cylinder(f"mr_io_jack{j}", 0.003, 0.008, (0.0847, ay, 0.228), (0, math.radians(90), 0), M["CONNECTOR"]))
    # two extra SATA ports
    add.append(box("mr_sata2", (0.008, 0.014, 0.007), (0.0837, 0.155, 0.152), M["CONNECTOR"]))
    add.append(box("mr_sata3", (0.008, 0.014, 0.007), (0.0837, 0.155, 0.166), M["CONNECTOR"]))
    # visible mounting screw heads at standoff positions
    for sy, sz in ((-0.160, 0.100), (-0.160, 0.320), (0.165, 0.100), (0.165, 0.320), (0.050, 0.350)):
        add.append(cylinder("mr_screw", 0.0022, 0.0015, (0.0884, sy, sz), (0, math.radians(90), 0), M["STEEL_ZINC"]))
    # secondary PCIe x1 slots
    add.append(box("mr_pcie_x1a", (0.005, 0.030, 0.008), (0.0847, 0.060, 0.150), M["CONNECTOR"], bevel=0.0004))
    add.append(box("mr_pcie_x1b", (0.005, 0.030, 0.008), (0.0847, 0.060, 0.132), M["CONNECTOR"], bevel=0.0004))
    merge_into(mobo, add)


# ----------------------------------------------------------------------------
# P2 GPU
# ----------------------------------------------------------------------------
def build_gpu(M):
    parts = [
        # open shroud: perimeter walls + top frame strips + center spine
        box("gpu_wall_x0", (0.004, 0.260, 0.030), (-0.0355, 0.030, 0.165), M["SHROUD_PLASTIC"], bevel=0.0015),
        box("gpu_wall_x1", (0.004, 0.260, 0.030), (0.0785, 0.030, 0.165), M["SHROUD_PLASTIC"], bevel=0.0015),
        box("gpu_wall_y0", (0.110, 0.004, 0.030), (0.0215, -0.098, 0.165), M["SHROUD_PLASTIC"], bevel=0.0015),
        box("gpu_wall_y1", (0.110, 0.004, 0.030), (0.0215, 0.158, 0.165), M["SHROUD_PLASTIC"], bevel=0.0015),
        box("gpu_top_y0", (0.110, 0.012, 0.004), (0.0215, -0.094, 0.178), M["SHROUD_PLASTIC"]),
        box("gpu_top_y1", (0.110, 0.012, 0.004), (0.0215, 0.154, 0.178), M["SHROUD_PLASTIC"]),
        box("gpu_spine", (0.110, 0.014, 0.004), (0.0215, -0.005, 0.178), M["SHROUD_PLASTIC"]),
        # fan bay rims
        cylinder("gpu_rim_a", 0.046, 0.010, (0.0215, -0.055, 0.146), (0, 0, 0), M["SHROUD_PLASTIC"]),
        cylinder("gpu_rim_b", 0.046, 0.010, (0.0215, 0.045, 0.146), (0, 0, 0), M["SHROUD_PLASTIC"]),
    ]
    # internal heatsink fin stack (visible through the fan bays)
    y = -0.094
    while y <= 0.154:
        parts.append(box("gpu_fin", (0.096, 0.0012, 0.026), (0.0215, y, 0.1655), M["ALU_HEATSINK"], bevel=0.0003))
        y += 0.006
    # fans sit 1 mm proud-lower so hub tops never coplanar with rim tops
    parts += bladed_fan2("gpu_fan_a", (0.0215, -0.055, 0.140), "Z", 0.040, M["FAN_PLASTIC"], n=11)
    parts += bladed_fan2("gpu_fan_b", (0.0215, 0.045, 0.140), "Z", 0.040, M["FAN_PLASTIC"], n=11)
    parts += [
        box("gpu_pcb", (0.112, 0.220, 0.0016), (0.0295, 0.054, 0.1808), M["PCB_MAIN"], bevel=0.0003),
        box("gpu_backplate", (0.112, 0.258, 0.0024), (0.024, 0.032, 0.183), M["ALU_ANODIZED"], bevel=0.0006),
        box("gpu_fingers", (0.0045, 0.078, 0.003), (0.08545, 0.105, 0.1795), M["CONTACT_GOLD"]),
        box("gpu_bracket", (0.120, 0.003, 0.036), (0.0277, 0.1815, 0.160), M["STEEL_ZINC"], bevel=0.0005),
        box("gpu_bracket_tab", (0.008, 0.003, 0.014), (-0.0345, 0.1815, 0.184), M["STEEL_ZINC"], bevel=0.0005),
        box("gpu_port1", (0.014, 0.004, 0.007), (-0.010, 0.1822, 0.155), M["CONNECTOR"]),
        box("gpu_port2", (0.014, 0.004, 0.007), (0.012, 0.1822, 0.155), M["CONNECTOR"]),
        box("gpu_port3", (0.018, 0.004, 0.007), (0.036, 0.1822, 0.155), M["CONNECTOR"]),
        box("gpu_tongue1", (0.010, 0.006, 0.002), (-0.010, 0.1822, 0.155), M["STEEL_ZINC"]),
        box("gpu_tongue2", (0.010, 0.006, 0.002), (0.012, 0.1822, 0.155), M["STEEL_ZINC"]),
        box("gpu_tongue3", (0.014, 0.006, 0.002), (0.036, 0.1822, 0.155), M["STEEL_ZINC"]),
        box("gpu_pwr", (0.020, 0.024, 0.010), (-0.020, 0.125, 0.188), M["CONNECTOR"], bevel=0.0008),
    ]
    # backplate + bracket screws
    for sx, sy in ((-0.028, -0.090), (-0.028, 0.150), (0.076, -0.090), (0.076, 0.150)):
        parts.append(cylinder("gpu_screw", 0.0022, 0.0012, (sx, sy, 0.1848), (0, 0, 0), M["STEEL_ZINC"]))
    parts.append(cylinder("gpu_br_screw", 0.0028, 0.002, (0.070, 0.1832, 0.176), (math.radians(90), 0, 0), M["STEEL_ZINC"]))
    # power connector pin rows + latch clip
    for px in (-0.026, -0.020, -0.014):
        for py in (0.120, 0.128):
            parts.append(box("gpu_pin", (0.003, 0.003, 0.004), (px, py, 0.194), M["CONTACT_GOLD"]))
    parts.append(box("gpu_pwr_latch", (0.006, 0.008, 0.004), (-0.020, 0.136, 0.192), M["CONNECTOR"], bevel=0.0005))
    return join_parts("GPU", parts)


# ----------------------------------------------------------------------------
# P3 CPU cooler
# ----------------------------------------------------------------------------
def build_cooler(M):
    fan_cx = 0.0177
    parts = [box("cl_base", (0.006, 0.090, 0.060), (0.0782, 0.050, 0.272), M["ALU_HEATSINK"])]
    z = 0.2075
    while z <= 0.3275:
        parts.append(box("cl_fin", (0.045, 0.088, 0.0012), (0.0527, 0.050, z), M["ALU_HEATSINK"], bevel=0.0003))
        z += 0.003
    # heatpipes kept INSIDE the fin depth (they clear the M.2 stick that
    # mounts beside the stack at Y~0.05, Z~0.23) + end elbows
    for py in (0.028, -0.028):
        for pz in (0.235, 0.305):
            parts.append(cylinder("cl_pipe", 0.0035, 0.045, (0.0527, 0.050 + py, pz),
                                  (0, math.radians(90), 0), M["ALU_HEATSINK"]))
            parts.append(sphere("cl_elbow", 0.0035, (0.0302, 0.050 + py, pz), M["ALU_HEATSINK"]))
    # open rim fan frame + corner posts
    parts += [
        box("cl_rim_t", (0.025, 0.120, 0.006), (fan_cx, 0.050, 0.327), M["FAN_PLASTIC"], bevel=0.002),
        box("cl_rim_b", (0.025, 0.120, 0.006), (fan_cx, 0.050, 0.213), M["FAN_PLASTIC"], bevel=0.002),
        box("cl_rim_l", (0.025, 0.006, 0.108), (fan_cx, -0.007, 0.270), M["FAN_PLASTIC"], bevel=0.002),
        box("cl_rim_r", (0.025, 0.006, 0.108), (fan_cx, 0.107, 0.270), M["FAN_PLASTIC"], bevel=0.002),
    ]
    for sy in (-0.001, 0.101):
        for sz in (0.216, 0.324):
            parts.append(box("cl_post", (0.023, 0.008, 0.008), (fan_cx, sy, sz), M["FAN_PLASTIC"], bevel=0.002))
    parts += bladed_fan2("cl_fan", (fan_cx, 0.050, 0.270), "X", 0.056, M["FAN_PLASTIC"], n=11)
    # mounting bracket plate under the stack (clears the DIMM banks at Y<0
    # and the M.2 stick whose beveled edge starts at X~0.0787)
    parts.append(box("cl_bracket", (0.004, 0.072, 0.006), (0.0755, 0.050, 0.238), M["STEEL_ZINC"], bevel=0.0008))
    return join_parts("CPU_COOLER", parts)


def build_case_fan(name, c, M):
    cx, cy, cz = c
    parts = [
        box(name + "_rim_t", (0.120, 0.025, 0.006), (cx, cy, cz + 0.057), M["FAN_PLASTIC"], bevel=0.002),
        box(name + "_rim_b", (0.120, 0.025, 0.006), (cx, cy, cz - 0.057), M["FAN_PLASTIC"], bevel=0.002),
        box(name + "_rim_l", (0.006, 0.025, 0.108), (cx - 0.057, cy, cz), M["FAN_PLASTIC"], bevel=0.002),
        box(name + "_rim_r", (0.006, 0.025, 0.108), (cx + 0.057, cy, cz), M["FAN_PLASTIC"], bevel=0.002),
    ]
    for sy in (-0.053, 0.053):
        for sz in (-0.053, 0.053):
            parts.append(box(name + "_post", (0.008, 0.023, 0.008), (cx + sy, cy, cz + sz), M["FAN_PLASTIC"], bevel=0.002))
    parts += bladed_fan2(name, c, "Y", 0.056, M["FAN_PLASTIC"], n=11)
    return join_parts(name, parts)


def enhance_case(case, M):
    add = [
        # top ventilation strips + front accent groove
        box("cs_vent0", (0.080, 0.140, 0.0012), (0.020, 0.060, 0.4605), M["CHASSIS_COATED"]),
        box("cs_vent1", (0.080, 0.140, 0.0012), (0.020, -0.100, 0.4605), M["CHASSIS_COATED"]),
        box("cs_front_accent", (0.010, 0.0012, 0.380), (-0.075, -0.2205, 0.240), M["ALU_ANODIZED"]),
        # rear expansion slot covers
        box("cs_slot0", (0.018, 0.0015, 0.036), (-0.010, 0.2175, 0.120), M["STEEL_ZINC"], bevel=0.0005),
        box("cs_slot1", (0.018, 0.0015, 0.036), (-0.032, 0.2175, 0.120), M["STEEL_ZINC"], bevel=0.0005),
        box("cs_slot2", (0.018, 0.0015, 0.036), (-0.054, 0.2175, 0.120), M["STEEL_ZINC"], bevel=0.0005),
    ]
    # front intake slats (just proud of the front wall at Y=-0.220)
    for k in range(9):
        add.append(box("cs_slat", (0.170, 0.002, 0.012), (0.0, -0.2206, 0.070 + 0.036 * k),
                       M["CHASSIS_COATED"], bevel=0.0008))
    # case feet
    for fx in (-0.085, 0.085):
        for fy in (-0.185, 0.185):
            add.append(box("cs_foot", (0.030, 0.030, 0.008), (fx, fy, -0.004), M["FAN_PLASTIC"], bevel=0.001))
    merge_into(case, add)


# ----------------------------------------------------------------------------
# P4 PSU / P5 RAM
# ----------------------------------------------------------------------------
def enhance_psu(psu, M):
    add = []
    for hx in (-0.035, -0.021, -0.007, 0.007, 0.035):
        for hz in (0.024, 0.040, 0.056, 0.072):
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.0045, depth=0.0012,
                                                location=(hx, 0.2174, hz),
                                                rotation=(math.radians(90), 0, 0))
            add.append(bpy.context.active_object)
            add[-1].name = "psu_hex"
            add[-1].data.materials.append(M["PSU_COATED"])
    add.append(box("psu_mod_panel", (0.070, 0.0012, 0.030), (0.030, 0.0786, 0.040), M["CONNECTOR"]))
    for sx in (0.000, 0.020, 0.040, 0.060, 0.080, 0.100):
        add.append(box("psu_mod_sock", (0.012, 0.002, 0.008), (sx, 0.0792, 0.040), M["CONNECTOR"]))
    add.append(box("psu_seam0", (0.0008, 0.120, 0.004), (-0.0452, 0.148, 0.070), M["PSU_COATED"]))
    add.append(box("psu_seam1", (0.0008, 0.120, 0.004), (-0.0452, 0.148, 0.020), M["PSU_COATED"]))
    for sx in (-0.038, 0.098):
        for sz in (0.010, 0.080):
            add.append(cylinder("psu_screw", 0.0025, 0.001, (sx, 0.2176, sz), (math.radians(90), 0, 0), M["STEEL_ZINC"]))
    # rocker switch face beside the existing inlet (detail pass) + rear seam
    add.append(box("psu_rocker", (0.014, 0.002, 0.024), (0.088, 0.2172, 0.045), M["CONNECTOR"], bevel=0.0006))
    merge_into(psu, add)


def enhance_m2(m2, M):
    """NAND packages + controller + standoff screw on the component face."""
    add = []
    for ny in (0.030, 0.052, 0.074):
        add.append(box("m2_nand", (0.0006, 0.014, 0.016), (0.0880, ny, 0.229), M["CONNECTOR"], bevel=0.0002))
    add.append(box("m2_ctrl", (0.0006, 0.008, 0.008), (0.0880, 0.016, 0.229), M["CONNECTOR"], bevel=0.0002))
    add.append(cylinder("m2_screw", 0.0018, 0.0010, (0.0880, 0.086, 0.229), (0, math.radians(90), 0), M["STEEL_ZINC"]))
    merge_into(m2, add)


def enhance_storage(st, M):
    add = []
    for sx, sy in ((-0.048, -0.175), (0.008, -0.175), (-0.048, -0.105), (0.008, -0.105)):
        add.append(cylinder("st_screw", 0.002, 0.001, (sx, sy, 0.0983), (0, 0, 0), M["STEEL_ZINC"]))
    merge_into(st, add)


def build_ram(i, y, M):
    parts = [
        box(f"ram{i}_pcb", (0.044, 0.0016, 0.133), (BS - 0.022, y, 0.270), M["PCB_MAIN"]),
        box(f"ram{i}_sp_a", (0.040, 0.0024, 0.116), (BS - 0.022, y - 0.0026, 0.2765), M["RAM_SPREADER"], bevel=0.001),
        box(f"ram{i}_sp_b", (0.040, 0.0024, 0.116), (BS - 0.022, y + 0.0026, 0.2765), M["RAM_SPREADER"], bevel=0.001),
        box(f"ram{i}_top", (0.040, 0.0062, 0.010), (BS - 0.022, y, 0.330), M["RAM_SPREADER"], bevel=0.0015),
        # gold edge contacts on both faces
        box(f"ram{i}_au_a", (0.036, 0.0006, 0.006), (BS - 0.022, y - 0.0011, 0.2075), M["CONTACT_GOLD"]),
        box(f"ram{i}_au_b", (0.036, 0.0006, 0.006), (BS - 0.022, y + 0.0011, 0.2075), M["CONTACT_GOLD"]),
        # spreader accent grooves
        box(f"ram{i}_ac_a", (0.034, 0.0008, 0.090), (BS - 0.022, y - 0.0040, 0.282), M["ALU_ANODIZED"], bevel=0.0004),
        box(f"ram{i}_ac_b", (0.034, 0.0008, 0.090), (BS - 0.022, y + 0.0040, 0.282), M["ALU_ANODIZED"], bevel=0.0004),
        # memory ICs peeking at the contact end
        box(f"ram{i}_ic0", (0.004, 0.0018, 0.006), (BS - 0.032, y, 0.216), M["CONNECTOR"]),
        box(f"ram{i}_ic1", (0.004, 0.0018, 0.006), (BS - 0.012, y, 0.216), M["CONNECTOR"]),
    ]
    return join_parts(f"RAM_{i:02d}", parts)


# ----------------------------------------------------------------------------
# P6 cable connector ends (mesh children of the cable curves)
# ----------------------------------------------------------------------------
def cable_connectors(M):
    specs = [
        ("CABLE_24PIN", "MB", (0.0815, -0.105, 0.166), (0.012, 0.022, 0.012)),
        ("CABLE_24PIN", "PSU", (0.075, 0.150, 0.090), (0.010, 0.016, 0.010)),
        ("CABLE_CPU_POWER", "MB", (0.0815, 0.150, 0.348), (0.010, 0.014, 0.010)),
        ("CABLE_CPU_POWER", "PSU", (0.060, 0.170, 0.088), (0.008, 0.012, 0.008)),
        ("CABLE_GPU_POWER", "GPU", (-0.020, 0.125, 0.196), (0.014, 0.022, 0.010)),
        ("CABLE_GPU_POWER", "PSU", (0.010, 0.090, 0.088), (0.008, 0.012, 0.008)),
    ]
    for cname, end, loc, dims in specs:
        b = box(f"{cname}_CONN_{end}", dims, loc, M["CONNECTOR"], bevel=0.0008)
        BB.set_parent(b, bpy.data.objects[cname])


# ----------------------------------------------------------------------------
# P7 subtle surface finish: roughness variation ONLY (no bump/normal noise).
# Visible grain in previews came from bump nodes; product-clean surfaces get
# their realism from value/roughness separation and edge response instead.
# ----------------------------------------------------------------------------
def micro(mat_name, scale, rvar):
    m = bpy.data.materials.get(mat_name)
    if not m or not m.use_nodes:
        return
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    if not b:
        return
    base_r = b.inputs["Roughness"].default_value
    tc = nt.nodes.new("ShaderNodeTexCoord")
    tex = nt.nodes.new("ShaderNodeTexNoise")
    # object-space (metre) coordinates: scale = features per metre, so the
    # variation stays broad (sheen patches) instead of bounding-box speckle
    nt.links.new(tc.outputs["Object"], tex.inputs["Vector"])
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = 2.0
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = max(0.0, base_r - rvar)
    mr.inputs["To Max"].default_value = min(1.0, base_r + rvar)
    nt.links.new(tex.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])


def main():
    if not bpy.data.objects.get("PC_ROOT"):
        bpy.ops.wm.open_mainfile(filepath=BLEND)
    M = {n: bpy.data.materials["MAT_" + n] for n in
         ("CHASSIS_COATED", "PCB_MAIN", "ALU_HEATSINK", "ALU_ANODIZED",
          "STEEL_ZINC", "CPU_NICKEL", "SHROUD_PLASTIC", "FAN_PLASTIC",
          "RAM_SPREADER", "CONNECTOR", "LABEL_NEUTRAL", "CONTACT_GOLD",
          "PSU_COATED", "STORAGE_CASE")}

    # rebuilds inside approved envelopes
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

    # joined enhancements
    enhance_motherboard(bpy.data.objects["MOTHERBOARD"], M)
    enhance_case(bpy.data.objects["CASE"], M)
    enhance_psu(bpy.data.objects["PSU"], M)
    enhance_m2(bpy.data.objects["M2_SSD"], M)
    enhance_storage(bpy.data.objects["STORAGE"], M)
    cable_connectors(M)

    # micro surface finish: broad, gentle roughness variation only
    # (no bump -> no grain; low scale -> sheen patches, not speckle)
    micro("MAT_CHASSIS_COATED", 30, 0.025)
    micro("MAT_ALU_HEATSINK", 40, 0.020)
    micro("MAT_PCB_MAIN", 60, 0.020)
    micro("MAT_SHROUD_PLASTIC", 50, 0.020)
    micro("MAT_FAN_PLASTIC", 60, 0.020)
    micro("MAT_RAM_SPREADER", 40, 0.020)
    micro("MAT_PSU_COATED", 30, 0.025)
    micro("MAT_STEEL_ZINC", 50, 0.020)
    # NOTE: anisotropy removed — EEVEE aniso without tangent maps reads as
    # grain on the backplate/spreaders; clean satin response instead.

    bpy.ops.wm.save_as_mainfile(filepath=BLEND, check_existing=False)
    total = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            total += len(o.data.loop_triangles)
    print("TRIS_TOTAL", total)
    print("REALISM_OK ->", BLEND)


if __name__ == "__main__":
    main()
