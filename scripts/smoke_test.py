"""Headless pipeline smoke test: create one named object with a PBR material and export GLB.

Run: blender -b --python scripts/smoke_test.py
"""
import os
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "build", "smoke_test.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)

bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0.0, 0.0, 0.0))
cube = bpy.context.active_object
cube.name = "TestCube"

mat = bpy.data.materials.new(name="TestMaterial")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.8, 0.1, 0.1, 1.0)
bsdf.inputs["Metallic"].default_value = 0.0
bsdf.inputs["Roughness"].default_value = 0.5
cube.data.materials.append(mat)

bpy.ops.export_scene.gltf(
    filepath=OUTPUT,
    export_format="GLB",
    export_yup=True,
)
print("SMOKE_TEST_OK ->", OUTPUT)
