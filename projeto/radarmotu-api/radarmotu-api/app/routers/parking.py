from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from sqlalchemy import and_

from typing import Optional

from datetime import datetime

from ..database import SessionLocal

from .. import models
 
router = APIRouter(prefix="/api/parking", tags=["parking"])
 
def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()
 
def _norm_plate(p: str) -> str:

    return (p or "").strip().upper()
 
def ensure_spots(db: Session):

    # cria 30 vagas na zona A se não existir nenhuma

    total = db.query(models.ParkingSpot).count()

    if total == 0:

        for n in range(1, 31):

            db.add(models.ParkingSpot(zone="A", number=n, is_occupied=False))

        db.commit()
 
@router.post("/store")

def store(plate: str, db: Session = Depends(get_db)):

    """

    Aloca uma vaga para a PLACA.

    Retorna: {zone, spot, sessionId}

    """

    plate = _norm_plate(plate)

    v = db.query(models.Vehicle).filter(models.Vehicle.plate == plate).first()

    if not v:

        raise HTTPException(status_code=404, detail="Veículo não cadastrado")
 
    # Se já tem sessão ativa, apenas retorna

    active = db.query(models.ParkingSession).filter(

        and_(models.ParkingSession.plate == plate, models.ParkingSession.end_ts.is_(None))

    ).first()

    if active:

        return {"zone": active.zone, "spot": active.spot_number, "sessionId": active.id}
 
    ensure_spots(db)

    free = db.query(models.ParkingSpot).filter(models.ParkingSpot.is_occupied == False).order_by(

        models.ParkingSpot.zone.asc(), models.ParkingSpot.number.asc()

    ).first()

    if not free:

        raise HTTPException(status_code=409, detail="Sem vagas disponíveis")
 
    # ocupa vaga e cria sessão

    free.is_occupied = True

    s = models.ParkingSession(

        plate=plate, tag_code=v.tag_code, zone=free.zone, spot_number=free.number, start_ts=datetime.utcnow()

    )

    db.add(s)

    db.commit(); db.refresh(s)
 
    return {"zone": s.zone, "spot": s.spot_number, "sessionId": s.id}
 
@router.post("/release")

def release(plate: str, db: Session = Depends(get_db)):

    """

    Libera a vaga da PLACA (se tiver sessão ativa).

    """

    plate = _norm_plate(plate)

    s: Optional[models.ParkingSession] = db.query(models.ParkingSession).filter(

        and_(models.ParkingSession.plate == plate, models.ParkingSession.end_ts.is_(None))

    ).first()

    if not s:

        raise HTTPException(status_code=404, detail="Sessão não encontrada")
 
    # libera spot

    spot = db.query(models.ParkingSpot).filter(

        and_(models.ParkingSpot.zone == s.zone, models.ParkingSpot.number == s.spot_number)

    ).first()

    if spot:

        spot.is_occupied = False
 
    s.end_ts = datetime.utcnow()

    db.commit()

    return {"status": "released", "zone": s.zone, "spot": s.spot_number}

 