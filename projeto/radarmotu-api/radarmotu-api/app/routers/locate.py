from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from sqlalchemy import and_

from ..database import SessionLocal

from .. import models
 
router = APIRouter(prefix="/api", tags=["locate"])
 
def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()
 
def _norm_plate(p: str) -> str:

    return (p or "").strip().upper()
 
@router.get("/locate/{plate}")

def locate(plate: str, db: Session = Depends(get_db)):

    p = _norm_plate(plate)

    s = db.query(models.ParkingSession).filter(

        and_(models.ParkingSession.plate == p, models.ParkingSession.end_ts.is_(None))

    ).first()

    if not s:

        raise HTTPException(status_code=404, detail="Not Found")

    return {"zone": s.zone, "spot": s.spot_number}

 