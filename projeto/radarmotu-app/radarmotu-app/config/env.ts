// config/env.ts

// Troque pelo IP LOCAL da sua máquina (mesma rede do celular)

export const SERVER_HOST = "10.48.203.15"; // <<< ajuste aqui

export const RADAR_API_BASE = `http://${SERVER_HOST}:8000`;

export const WS_URL         = `ws://${SERVER_HOST}:8000/ws/position`;

 