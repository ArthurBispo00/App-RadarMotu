# app/routers/tags.py
from fastapi import APIRouter
from ..services.mqtt import mqtt_client

router = APIRouter(prefix="/api/tags", tags=["tags"])

@router.post("/{tag_id}/alarm")
def trigger_tag_alarm(tag_id: str):
    """
    Envia comando de alarme (toggle) para a TAG via MQTT.
    """
    topic = f"radarmottu/tags/{tag_id}/command"
    message = "TOGGLE_BUZZER"
    print(f"Publicando MQTT -> tópico='{topic}', mensagem='{message}'")
    mqtt_client.publish(topic, message)
    return {"status": "comando toggle enviado", "tag_id": tag_id}
