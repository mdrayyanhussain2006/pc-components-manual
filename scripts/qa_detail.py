"""Detail-pass QA (Step 3): runs on build/detail.blend.

Complements qa_blockout.py (which must ALSO pass on detail.blend for the
regression contract). This script verifies what the detail pass adds:

1. Material language: every component uses ONLY materials from the deliberate
   taxonomy, and carries its expected primary material(s). No blockout
   materials may remain assigned anywhere.
2. Polycount budget: total and per-object triangle counts stay web-friendly.
3. Manifest v3 semantics: motion_layers present, removal vs presentation
   separated, every stage object covered by removal primitives, M.2 uses
   pivot-first secondary mechanics, cooler stage precedes CPU stage.

Run:  blender -b build/detail.blend --python scripts/qa_detail.py
Out:  build/qa_detail_report.txt (+ console summary)
"""
import json
import os
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT = os.path.join(ROOT, "build", "qa_detail_report.txt")

TRI_BUDGET_TOTAL = 60000
TRI_BUDGET_OBJECT = 12000
TRI_TARGET = (15000, 30000)   # Step 3.5 realism target band (informational)

# Allowed material set per object (deliberate taxonomy, no ad-hoc mats)
TAXONOMY = {
    "CASE":            {"MAT_CHASSIS_COATED", "MAT_STEEL_ZINC", "MAT_CONNECTOR",
                        "MAT_ALU_ANODIZED", "MAT_FAN_PLASTIC"},
    "CASE_SIDE_PANEL": {"MAT_GLASS_TEMPERED"},
    "MOTHERBOARD":     {"MAT_PCB_MAIN", "MAT_CONNECTOR", "MAT_ALU_HEATSINK",
                        "MAT_ALU_ANODIZED", "MAT_STEEL_ZINC"},
    "CPU":             {"MAT_CPU_NICKEL", "MAT_CPU_SUBSTRATE"},
    "CPU_COOLER":      {"MAT_ALU_HEATSINK", "MAT_FAN_PLASTIC", "MAT_STEEL_ZINC"},
    "RAM_01":          {"MAT_PCB_MAIN", "MAT_RAM_SPREADER", "MAT_CONTACT_GOLD",
                        "MAT_ALU_ANODIZED", "MAT_CONNECTOR"},
    "RAM_02":          {"MAT_PCB_MAIN", "MAT_RAM_SPREADER", "MAT_CONTACT_GOLD",
                        "MAT_ALU_ANODIZED", "MAT_CONNECTOR"},
    "RAM_03":          {"MAT_PCB_MAIN", "MAT_RAM_SPREADER", "MAT_CONTACT_GOLD",
                        "MAT_ALU_ANODIZED", "MAT_CONNECTOR"},
    "RAM_04":          {"MAT_PCB_MAIN", "MAT_RAM_SPREADER", "MAT_CONTACT_GOLD",
                        "MAT_ALU_ANODIZED", "MAT_CONNECTOR"},
    "GPU":             {"MAT_SHROUD_PLASTIC", "MAT_FAN_PLASTIC", "MAT_PCB_MAIN",
                        "MAT_ALU_ANODIZED", "MAT_ALU_HEATSINK", "MAT_CONTACT_GOLD",
                        "MAT_STEEL_ZINC", "MAT_CONNECTOR"},
    "M2_SSD":          {"MAT_PCB_MAIN", "MAT_LABEL_NEUTRAL", "MAT_CONNECTOR",
                        "MAT_STEEL_ZINC"},
    "STORAGE":         {"MAT_STORAGE_CASE", "MAT_LABEL_NEUTRAL", "MAT_STEEL_ZINC"},
    "PSU":             {"MAT_PSU_COATED", "MAT_CONNECTOR", "MAT_LABEL_NEUTRAL",
                        "MAT_STEEL_ZINC"},
    "CASE_FAN_01":     {"MAT_FAN_PLASTIC"},
    "CASE_FAN_02":     {"MAT_FAN_PLASTIC"},
    "CASE_FAN_03":     {"MAT_FAN_PLASTIC"},
    "CABLE_24PIN":     {"MAT_CABLE_SLEEVE"},
    "CABLE_CPU_POWER": {"MAT_CABLE_SLEEVE"},
    "CABLE_GPU_POWER": {"MAT_CABLE_SLEEVE"},
}

# Primary materials each object MUST carry (the taxonomy must be visible)
REQUIRED_MATS = {
    "CASE":            ["MAT_CHASSIS_COATED"],
    "CASE_SIDE_PANEL": ["MAT_GLASS_TEMPERED"],
    "MOTHERBOARD":     ["MAT_PCB_MAIN"],
    "CPU":             ["MAT_CPU_NICKEL", "MAT_CPU_SUBSTRATE"],
    "CPU_COOLER":      ["MAT_ALU_HEATSINK", "MAT_FAN_PLASTIC"],
    "RAM_01":          ["MAT_PCB_MAIN", "MAT_RAM_SPREADER", "MAT_CONTACT_GOLD"],
    "RAM_02":          ["MAT_PCB_MAIN", "MAT_RAM_SPREADER", "MAT_CONTACT_GOLD"],
    "RAM_03":          ["MAT_PCB_MAIN", "MAT_RAM_SPREADER", "MAT_CONTACT_GOLD"],
    "RAM_04":          ["MAT_PCB_MAIN", "MAT_RAM_SPREADER", "MAT_CONTACT_GOLD"],
    "GPU":             ["MAT_SHROUD_PLASTIC", "MAT_PCB_MAIN", "MAT_CONTACT_GOLD",
                        "MAT_STEEL_ZINC"],
    "M2_SSD":          ["MAT_PCB_MAIN"],
    "STORAGE":         ["MAT_STORAGE_CASE"],
    "PSU":             ["MAT_PSU_COATED"],
    "CASE_FAN_01":     ["MAT_FAN_PLASTIC"],
    "CASE_FAN_02":     ["MAT_FAN_PLASTIC"],
    "CASE_FAN_03":     ["MAT_FAN_PLASTIC"],
    "CABLE_24PIN":     ["MAT_CABLE_SLEEVE"],
    "CABLE_CPU_POWER": ["MAT_CABLE_SLEEVE"],
    "CABLE_GPU_POWER": ["MAT_CABLE_SLEEVE"],
}

# Blockout materials that must be fully replaced (zero assigned slots)
RETIRED_MATS = ["MAT_CASE", "MAT_GLASS", "MAT_PCB", "MAT_METAL", "MAT_PLASTIC",
                "MAT_GPU", "MAT_PSU", "MAT_RAM", "MAT_STORAGE", "MAT_CPU", "MAT_CABLE"]

results = []


def check(ok, label, detail=""):
    results.append((bool(ok), label, detail))


def slot_mats(o):
    return [s.material.name for s in o.material_slots if s.material]


def manifest_from_scene():
    """The manifest travels with the blend as a scene text datablock."""
    t = bpy.data.texts.get("DISASSEMBLY_MANIFEST.json")
    return json.loads(t.as_string()) if t else None


def main():
    # 1. material taxonomy --------------------------------------------------
    for name, allowed in TAXONOMY.items():
        o = bpy.data.objects.get(name)
        check(o is not None, f"taxonomy:object {name}")
        if not o:
            continue
        mats = set(slot_mats(o))
        check(mats and mats.issubset(allowed), f"taxonomy:allowed {name}",
              f"slots={sorted(mats)} allowed={sorted(allowed)}")
        for req in REQUIRED_MATS[name]:
            check(req in mats, f"taxonomy:required {name} has {req}")

    # retired blockout materials must not be assigned anywhere
    for name in RETIRED_MATS:
        m = bpy.data.materials.get(name)
        users = [o.name for o in bpy.data.objects
                 if o.type in ("MESH", "CURVE") and name in slot_mats(o)]
        check(m is None or not users, f"taxonomy:retired {name} unassigned",
              f"still on {users}" if users else "")

    # 2. polycount budget -----------------------------------------------------
    total = 0
    worst = ("", 0)
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        o.data.calc_loop_triangles()
        n = len(o.data.loop_triangles)
        total += n
        if n > worst[1]:
            worst = (o.name, n)
        check(n <= TRI_BUDGET_OBJECT, f"polycount:{o.name} <= {TRI_BUDGET_OBJECT}", str(n))
    check(total <= TRI_BUDGET_TOTAL, f"polycount:total <= {TRI_BUDGET_TOTAL}",
          f"total={total} worst={worst[0]}:{worst[1]}")
    if TRI_TARGET[0] <= total <= TRI_TARGET[1]:
        results.append((True,
                        f"info:polycount within {TRI_TARGET[0]}-{TRI_TARGET[1]} realism band",
                        f"total={total}"))
    else:
        # informational only - the hard ceilings above are the contract
        results.append((True,
                        f"INFO polycount outside {TRI_TARGET[0]}-{TRI_TARGET[1]} realism band",
                        f"total={total}"))

    # 3. manifest v3 semantics ------------------------------------------------
    man = manifest_from_scene()
    check(man is not None, "manifest:scene text present")
    if man:
        check(man.get("version") == 3, "manifest:version 3", str(man.get("version")))
        check(set(man.get("motion_layers", {})) == {"removal", "presentation"},
              "manifest:motion_layers removal+presentation")
        check(man.get("primitive_types") == ["translate", "pivot"],
              "manifest:primitive_types")

        stages = man.get("stages", [])
        ids = [s["id"] for s in stages]
        check("CPU_COOLER_OUT" in ids and "CPU_OUT" in ids
              and ids.index("CPU_COOLER_OUT") < ids.index("CPU_OUT"),
              "manifest:order cooler before cpu")

        for s in stages:
            if s["id"] == "FINAL_EXPLODE":
                check(s.get("organized") and s.get("offsets"),
                      "manifest:final explode organized+offsets")
                continue
            rem = s.get("removal", {})
            pres = s.get("presentation", {})
            check(bool(rem), f"manifest:removal layer {s['id']}")
            check(bool(pres), f"manifest:presentation layer {s['id']}")
            # every stage object covered by removal primitives
            objs = s.get("objects", [])
            covered = set(rem.keys())
            check(set(objs).issubset(covered),
                  f"manifest:removal covers {s['id']}",
                  f"objects={objs} covered={sorted(covered)}")
            for obj, prims in rem.items():
                ok = all(p.get("type") in ("translate", "pivot") for p in prims)
                check(ok, f"manifest:primitive types {s['id']}:{obj}")

        # M.2 secondary mechanics: pivot-first, then disengage, then clear
        st7 = next(s for s in stages if s["id"] == "STORAGE_OUT")
        m2 = st7["removal"]["M2_SSD"]
        check(len(m2) >= 3 and m2[0]["type"] == "pivot"
              and m2[0].get("pivot_at") == "connector_edge"
              and m2[0].get("angle_deg", 0) > 0
              and all(p["type"] == "translate" for p in m2[1:]),
              "manifest:m2 pivot->disengage->translate",
              str([p["type"] for p in m2]))
        # removal vs presentation are distinct layers (M2: 3 primitives vs 1 park pose)
        check(st7["presentation"]["M2_SSD"] != m2,
              "manifest:removal != presentation (m2)")

    # report ------------------------------------------------------------------
    fails = [r for r in results if not r[0]]
    lines = ["DETAIL-PASS QA REPORT (build/detail.blend)",
             "=" * 60]
    for ok, label, detail in results:
        lines.append(("PASS " if ok else "FAIL ") + label
                     + (("  " + detail) if detail and not ok else ""))
    lines.append("-" * 60)
    lines.append(f"checks: {len(results)}  failures: {len(fails)}")
    lines.append("QA_DETAIL_RESULT: " + ("QA_PASS" if not fails else "QA_FAIL"))
    text = "\n".join(lines)
    print(text)
    with open(REPORT, "w", encoding="utf-8") as f:
        f.write(text + "\n")


if __name__ == "__main__":
    main()
