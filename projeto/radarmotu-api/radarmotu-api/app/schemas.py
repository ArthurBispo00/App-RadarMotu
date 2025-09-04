from pydantic import BaseModel
from typing import Optional, List

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    email: str
    password: str
    is_admin: bool = False

class BleReading(BaseModel):
    tagId: str
    anchorId: str
    rssi: int

class VehicleIn(BaseModel):
    plate: str
    brand: str
    model: str
    color: str
    year_make: str
    year_model: str
    vin: str
    tag_code: Optional[str] = None
    operational: bool = True

class VehicleOut(BaseModel):
    id: str
    plate: str
    model: Optional[str]
    tag_code: Optional[str] = None
    class Config: orm_mode = True

class VehicleListItem(BaseModel):
    plate: str
    model: Optional[str]
    brand: Optional[str]
    color: Optional[str]
    tag_code: Optional[str] = None

class SpotOverview(BaseModel):
    zone: Optional[str]
    total: int
    occupied: int
    free: int

class AnchorOut(BaseModel):
    code: str
    x: float
    y: float
    online: bool
    lastSeenMs: Optional[int]
