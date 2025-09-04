# app/models.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, func

from .database import Base
 
class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)

    hashed_password = Column(String, nullable=False)

    is_admin = Column(Boolean, default=False)
 
class Vehicle(Base):

    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)

    plate = Column(String, unique=True, index=True, nullable=False)

    brand = Column(String)

    model = Column(String)

    color = Column(String)

    year_make = Column(String)

    year_model = Column(String)

    vin = Column(String)

    tag_code = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
 
class ParkingSpot(Base):

    __tablename__ = "parking_spots"

    id = Column(Integer, primary_key=True)

    zone = Column(String, index=True)

    number = Column(Integer, index=True)

    is_occupied = Column(Boolean, default=False)
 
class ParkingSession(Base):

    __tablename__ = "parking_sessions"

    id = Column(Integer, primary_key=True)

    plate = Column(String, index=True)

    tag_code = Column(String)

    zone = Column(String, index=True)

    spot_number = Column(Integer)

    start_ts = Column(DateTime(timezone=True), server_default=func.now())

    end_ts = Column(DateTime(timezone=True), nullable=True)

 