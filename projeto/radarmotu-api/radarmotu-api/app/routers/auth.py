from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from .. import schemas, models, security
from ..database import SessionLocal

router = APIRouter(tags=["auth"])

def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email==form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha incorretos")
    access_token = security.create_access_token(data={"sub": user.email, "is_admin": user.is_admin})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/users/")
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.email==user.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email já registrado")
    new_user = models.User(id=user.email, email=user.email,
                           hashed_password=security.get_password_hash(user.password),
                           is_admin=user.is_admin)
    db.add(new_user); db.commit(); return {"id": new_user.id, "email": new_user.email}
