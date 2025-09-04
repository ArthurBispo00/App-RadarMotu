from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from typing import Optional

from ..database import SessionLocal

from .. import models
 
router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])
 
def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()
 
def _norm_plate(p: str) -> str:

    return (p or "").strip().upper()
 
@router.post("")

def create_vehicle(payload: dict, db: Session = Depends(get_db)):

    """

    Cria (ou atualiza se já existir) um veículo.

    Espera: {plate, brand, model, color, year_make, year_model, vin, tag_code}

    """

    plate = _norm_plate(payload.get("plate", ""))

    if not plate:

        raise HTTPException(status_code=400, detail="plate é obrigatório")
 
    v: Optional[models.Vehicle] = db.query(models.Vehicle).filter(models.Vehicle.plate == plate).first()

    if v is None:

        v = models.Vehicle(plate=plate)

        db.add(v)
 
    # atualiza campos

    v.brand      = payload.get("brand", v.brand)

    v.model      = payload.get("model", v.model)

    v.color      = payload.get("color", v.color)

    v.year_make  = payload.get("year_make", v.year_make)

    v.year_model = payload.get("year_model", v.year_model)

    v.vin        = payload.get("vin", v.vin)

    v.tag_code   = payload.get("tag_code", v.tag_code)
 
    db.commit()

    db.refresh(v)

    return {

        "id": v.id, "plate": v.plate, "brand": v.brand, "model": v.model, "color": v.color,

        "year_make": v.year_make, "year_model": v.year_model, "vin": v.vin, "tag_code": v.tag_code

    }
 
@router.get("/by-plate/{plate}")

def get_by_plate(plate: str, db: Session = Depends(get_db)):

    p = _norm_plate(plate)

    v = db.query(models.Vehicle).filter(models.Vehicle.plate == p).first()

    if not v:

        raise HTTPException(status_code=404, detail="Not Found")

    return {

        "id": v.id, "plate": v.plate, "brand": v.brand, "model": v.model, "color": v.color,

        "year_make": v.year_make, "year_model": v.year_model, "vin": v.vin, "tag_code": v.tag_code

    }
 
@router.put("/{plate}")

def update_vehicle(plate: str, payload: dict, db: Session = Depends(get_db)):

    p = _norm_plate(plate)

    v = db.query(models.Vehicle).filter(models.Vehicle.plate == p).first()

    if not v:

        raise HTTPException(status_code=404, detail="Not Found")

    for k in ["brand","model","color","year_make","year_model","vin","tag_code"]:

        if k in payload:

            setattr(v, k, payload[k])

    db.commit(); db.refresh(v)

    return {

        "id": v.id, "plate": v.plate, "brand": v.brand, "model": v.model, "color": v.color,

        "year_make": v.year_make, "year_model": v.year_model, "vin": v.vin, "tag_code": v.tag_code

    }
 
@router.delete("/{plate}")

def delete_vehicle(plate: str, db: Session = Depends(get_db)):

    p = _norm_plate(plate)

    v = db.query(models.Vehicle).filter(models.Vehicle.plate == p).first()

    if not v:

        raise HTTPException(status_code=404, detail="Not Found")

    db.delete(v); db.commit()

    return {"status": "deleted"}

 