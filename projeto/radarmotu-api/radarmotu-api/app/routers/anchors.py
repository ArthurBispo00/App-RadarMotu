from fastapi import APIRouter

from pathlib import Path

import json
 
router = APIRouter(prefix="/api", tags=["anchors"])
 
@router.get("/anchors")

def get_anchors():

    anchors_path = Path(__file__).resolve().parents[1] / "anchors.json"

    if not anchors_path.exists():

        return {}

    return json.loads(anchors_path.read_text(encoding="utf-8"))

 