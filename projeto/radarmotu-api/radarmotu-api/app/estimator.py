import numpy as np
from scipy.optimize import least_squares

TX_POWER = -61.0
N_PATH = 2.5

def rssi_to_dist(rssi: float) -> float:
    return 10 ** ((TX_POWER - rssi) / (10 * N_PATH))

def multilaterate(anchors: dict, readings: list[dict]) -> dict:
    known_readings = [r for r in readings if r["anchorId"] in anchors]
    if len(known_readings) < 3:
        return {}

    points = np.array([list(anchors[r["anchorId"]].values()) for r in known_readings])
    distances = np.array([rssi_to_dist(r["rssi"]) for r in known_readings])
    initial_guess = np.mean(points, axis=0)

    def residuals(xy):
        return np.linalg.norm(points - xy, axis=1) - distances

    res = least_squares(residuals, initial_guess, method="lm")
    return {"x": float(res.x[0]), "y": float(res.x[1])}
