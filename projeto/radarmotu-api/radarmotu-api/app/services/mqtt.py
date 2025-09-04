# app/services/mqtt.py
import paho.mqtt.client as mqtt

# Configurações do broker
MQTT_SERVER = "broker.hivemq.com"
MQTT_PORT = 1883

# Cliente MQTT único para todo o servidor
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)

def setup_mqtt():
    """Conecta e inicia o loop do cliente MQTT (chame no startup do FastAPI)."""
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print("Backend conectado ao Broker MQTT!")
        else:
            print(f"Falha ao conectar ao MQTT, código de erro: {rc}")

    mqtt_client.on_connect = on_connect
    mqtt_client.connect(MQTT_SERVER, MQTT_PORT, 60)
    mqtt_client.loop_start()
