# app/main.py

import asyncio

import json

import time

from collections import defaultdict, deque

from pathlib import Path
 
import paho.mqtt.client as mqtt

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session

from sqlalchemy import text

from starlette.websockets import WebSocketState
 
from . import models, schemas

from .database import SessionLocal, engine

from .estimator import multilaterate
 
# ======== NOVO: routers REST (veículos, estacionamento, localizar, âncoras) ========

from .routers import vehicles, parking, locate, anchors as anchors_router
 
# -----------------------------------------------------------------------------------

# Boot básico

# -----------------------------------------------------------------------------------

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Radarmottu API - Versão Final")
 
# CORS (em dev pode deixar "*"; em prod restrinja)

app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)
 
START_TS = time.time()
 
# -----------------------------------------------------------------------------------

# Configuração das âncoras (para o mapa do app)

# -----------------------------------------------------------------------------------

anchors_path = Path(__file__).parent / "anchors.json"

try:

    anchors = {k: v for k, v in json.loads(anchors_path.read_text(encoding="utf-8")).items()}

    max_x = max(a["x"] for a in anchors.values())

    max_y = max(a["y"] for a in anchors.values())

    initial_position = {"x": max_x / 2, "y": max_y / 2}

except Exception:

    anchors = {}

    initial_position = {"x": 0.0, "y": 0.0}
 
# -----------------------------------------------------------------------------------

# Estado em memória

# -----------------------------------------------------------------------------------

# Você está agregando por ÂNCORA (funciona bem para 1 tag)

readings_history = defaultdict(lambda: deque(maxlen=5))

is_in_cooldown = False
 
# -----------------------------------------------------------------------------------

# MQTT (buzzer)

# -----------------------------------------------------------------------------------

MQTT_SERVER = "broker.hivemq.com"

MQTT_PORT = 1883

mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
 
def setup_mqtt():

    def on_connect(client, userdata, flags, rc):

        print("Backend conectado ao Broker MQTT!" if rc == 0 else f"Falha MQTT rc={rc}")

    mqtt_client.on_connect = on_connect

    mqtt_client.connect(MQTT_SERVER, MQTT_PORT, 60)

    mqtt_client.loop_start()
 
# -----------------------------------------------------------------------------------

# DB helper (para /health)

# -----------------------------------------------------------------------------------

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()
 
# -----------------------------------------------------------------------------------

# WebSocket manager

# -----------------------------------------------------------------------------------

class ConnectionManager:

    def __init__(self):

        self.active_connections: list[WebSocket] = []
 
    async def connect(self, ws: WebSocket):

        await ws.accept()

        self.active_connections.append(ws)

        # Envia setup inicial (anchors + posição inicial)

        initial_payload = json.dumps({

            "type": "initial_setup",

            "payload": {"initial_pos": initial_position, "anchors": anchors}

        })

        try:

            await ws.send_text(initial_payload)

        except Exception:

            pass
 
    def disconnect(self, ws: WebSocket):

        if ws in self.active_connections:

            self.active_connections.remove(ws)
 
    async def broadcast(self, msg: str):

        for c in self.active_connections[:]:

            try:

                if c.client_state == WebSocketState.CONNECTED:

                    await c.send_text(msg)

                else:

                    self.disconnect(c)

            except Exception:

                self.disconnect(c)
 
manager = ConnectionManager()
 
# -----------------------------------------------------------------------------------

# Endpoints REST mínimos (BLE + buzzer + health)

# -----------------------------------------------------------------------------------

@app.post("/api/reading/ble")

async def ingest_ble_reading(reading: schemas.BleReading):

    """

    Espera: { "tagId": "...", "anchorId": "A1", "rssi": -67 }

    Obs: sua lógica atual agrega por âncora (readings_history[anchorId])

    """

    global is_in_cooldown

    if not is_in_cooldown:

        readings_history[reading.anchorId].append(reading.rssi)

        print(f"[BLE] Âncora {reading.anchorId}: total leituras={len(readings_history[reading.anchorId])}")

    return {"status": "ok"}
 
@app.post("/api/tags/{tag_id}/alarm")

def trigger_tag_alarm(tag_id: str):

    topic = f"radarmottu/tags/{tag_id}/command"

    mqtt_client.publish(topic, "TOGGLE_BUZZER")

    return {"status": "comando toggle enviado", "tag_id": tag_id}
 
@app.get("/health")

def health(db: Session = Depends(get_db)):

    db_ok = False

    try:

        db.execute(text("SELECT 1"))

        db_ok = True

    except Exception:

        db_ok = False

    return {

        "status": "ok" if db_ok else "degraded",

        "uptime_s": round(time.time() - START_TS, 1),

        "db_ok": db_ok,

        "ws_clients": len(manager.active_connections),

        "anchors_count": len(anchors),

    }
 
# -----------------------------------------------------------------------------------

# WebSocket

# -----------------------------------------------------------------------------------

@app.websocket("/ws/position")

async def websocket_endpoint(websocket: WebSocket):

    await manager.connect(websocket)

    try:

        while True:

            await asyncio.sleep(1)

    except WebSocketDisconnect:

        manager.disconnect(websocket)
 
# -----------------------------------------------------------------------------------

# Tarefa de agregação/calculo (sua lógica mantida)

# -----------------------------------------------------------------------------------

async def aggregator_and_calculator_task():

    global is_in_cooldown

    while True:

        await asyncio.sleep(5)

        if is_in_cooldown:

            continue
 
        full_anchors = {k: v for k, v in readings_history.items() if len(v) == 5}

        print(f"[AGG] Âncoras com 5 leituras: {list(full_anchors.keys())}")
 
        if len(full_anchors) >= 3:

            print(">>> Condição atingida! Calculando posição média...")

            aggregated = [{"anchorId": k, "rssi": sum(v) / len(v)} for k, v in full_anchors.items()]

            pos = multilaterate(anchors, aggregated)

            if pos:

                payload = json.dumps({

                    "type": "position_update",

                    "payload": {"id": "TAG01", "kind": "tag", "pos": pos}

                })

                await manager.broadcast(payload)

                print(">>> Posição enviada. Iniciando ciclo de descanso...")

                is_in_cooldown = True

                readings_history.clear()

                await asyncio.sleep(5)

                is_in_cooldown = False

                print(">>> Ciclo de descanso finalizado.")
 
# -----------------------------------------------------------------------------------

# Startup: MQTT + tasks + REGISTRO DOS ROUTERS (resolve 404 do app)

# -----------------------------------------------------------------------------------

@app.on_event("startup")

async def on_startup():

    setup_mqtt()

    # tasks

    asyncio.create_task(aggregator_and_calculator_task())

    # routers REST (CRUD e estacionamento)

    app.include_router(vehicles.router)

    app.include_router(parking.router)

    app.include_router(locate.router)

    app.include_router(anchors_router.router)

 