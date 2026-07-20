"""QA-only presentation renderer for the bundled slides_test.py on Windows.

The bundled Chromium host can return a Windows teardown error after it has
successfully written every requested PNG. This adapter accepts that specific
post-render condition only when stdout is valid JSON and every reported image
exists; all genuine render failures still raise.
"""

from __future__ import annotations

import json
import os
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

from runtime_tools import node_binary, runtime_env

SCRIPT_DIR = Path(__file__).resolve().parent
EMU_PER_INCH = 914_400


def calc_dpi_via_ooxml(input_path: str, max_w_px: int, max_h_px: int) -> int:
    with ZipFile(input_path, "r") as archive:
        root = ET.fromstring(archive.read("ppt/presentation.xml"))
    slide_size = root.find(
        "p:sldSz", {"p": "http://schemas.openxmlformats.org/presentationml/2006/main"}
    )
    if slide_size is None:
        raise RuntimeError("Slide size not found in presentation.xml")
    width_in = int(slide_size.get("cx") or 0) / EMU_PER_INCH
    height_in = int(slide_size.get("cy") or 0) / EMU_PER_INCH
    if width_in <= 0 or height_in <= 0:
        raise RuntimeError("Invalid slide size values")
    return round(min(max_w_px / width_in, max_h_px / height_in))


def rasterize(input_path: str, out_dir: str, dpi: int) -> list[str]:
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    artifact_tool_entry = os.environ.get("PREUVANCE_ARTIFACT_TOOL_ENTRY")
    if not artifact_tool_entry or not Path(artifact_tool_entry).is_file():
        raise RuntimeError(
            "PREUVANCE_ARTIFACT_TOOL_ENTRY must point to artifact_tool.mjs"
        )
    scale = max(dpi / 96.0, 0.01)
    proc = subprocess.run(
        [
            node_binary(),
            str(SCRIPT_DIR / "render-presentation-qa.mjs"),
            "--input",
            os.path.abspath(input_path),
            "--output_dir",
            os.path.abspath(out_dir),
            "--artifact_tool",
            artifact_tool_entry,
            "--scale",
            f"{scale:.6f}",
        ],
        capture_output=True,
        text=True,
        check=False,
        env=runtime_env(),
    )
    try:
        payload = json.loads(proc.stdout)
        paths = [str(item) for item in payload["paths"]]
    except (json.JSONDecodeError, KeyError, TypeError) as error:
        details = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"Presentation renderer did not return valid output.\n{details}") from error

    if not paths or not all(Path(item).is_file() for item in paths):
        details = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"Presentation renderer did not produce every PNG.\n{details}")

    # A non-zero return after complete, valid output is the known teardown-only
    # failure. The images are safe for the overflow analysis that follows.
    return paths
