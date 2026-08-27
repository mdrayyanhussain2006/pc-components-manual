"""Encode build/diag/still_*.png (140-185) into an MP4 via the sequencer.

Standalone: blender -b --python scripts/encode_diag_mp4.py
"""
import bpy
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "diag")
F0, F1 = 140, 185

sc = bpy.context.scene
se = sc.sequence_editor_create()
for f in range(F0, F1 + 1):
    p = os.path.join(OUT, f"still_{f:04d}.png")
    if not os.path.exists(p):
        raise SystemExit(f"missing {p}")
    se.strips.new_image(name=f"diag_{f}", filepath=p, channel=1, frame_start=f)

sc.frame_start, sc.frame_end = F0, F1
sc.render.fps = 24
sc.render.resolution_x, sc.render.resolution_y = 960, 720
sc.render.resolution_percentage = 100
sc.render.image_settings.media_type = 'VIDEO'
sc.render.image_settings.file_format = "FFMPEG"
sc.render.ffmpeg.format = "MPEG4"
sc.render.ffmpeg.codec = "H264"
sc.render.ffmpeg.constant_rate_factor = "HIGH"
sc.render.filepath = os.path.join(OUT, "cable_diag_")
bpy.ops.render.render(animation=True)
for fn in os.listdir(OUT):
    if fn.startswith("cable_diag_") and fn.endswith(".mp4"):
        os.replace(os.path.join(OUT, fn), os.path.join(OUT, "cable_diag_140-185.mp4"))
        print("ENCODE_RENAMED", fn)
print("ENCODE_DONE")
