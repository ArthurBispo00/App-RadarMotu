// services/api.ts

import { RADAR_API_BASE } from "../config/env";
 
// Aceita Promise<Response> OU Response e aguarda internamente

async function okOrThrow(p: Promise<Response> | Response) {

  const res = await p;

  if (!res.ok) {

    let body = "";

    try { body = await res.text(); } catch {}

    throw new Error(body || `HTTP ${res.status}`);

  }

  return res;

}
 
async function readJson<T = any>(res: Response): Promise<T> {

  const ct = res.headers.get("content-type") || "";

  const txt = await res.text();

  if (!txt) return {} as any;

  if (ct.includes("application/json")) return JSON.parse(txt);

  try { return JSON.parse(txt); } catch { return (txt as any); }

}
 
// ---------- CRUD de veículos ----------

export async function createVehicle(v: {

  placa:string; marca:string; modelo:string; cor:string;

  anoFabricacao:string; anoModelo:string; chassi:string; tag_code?:string;

}) {

  const res = await okOrThrow(fetch(`${RADAR_API_BASE}/api/vehicles`, {

    method:"POST",

    headers:{ "Content-Type":"application/json" },

    body: JSON.stringify({

      plate: v.placa,

      brand: v.marca,

      model: v.modelo,

      color: v.cor,

      year_make: v.anoFabricacao,

      year_model: v.anoModelo,

      vin: v.chassi,

      tag_code: v.tag_code

    })

  }));

  return readJson(res);

}
 
export async function getVehicleByPlate(plate: string) {

  const res = await okOrThrow(fetch(`${RADAR_API_BASE}/api/vehicles/by-plate/${encodeURIComponent(plate)}`));

  return readJson(res);

}
 
export async function updateVehicle(

  plate: string,

  data: Partial<{ brand:string; model:string; color:string; year_make:string; year_model:string; vin:string; tag_code?:string; }>

) {

  const res = await okOrThrow(fetch(`${RADAR_API_BASE}/api/vehicles/${encodeURIComponent(plate)}`, {

    method:"PUT",

    headers:{ "Content-Type":"application/json" },

    body: JSON.stringify(data)

  }));

  return readJson(res);

}
 
export async function deleteVehicle(plate: string) {

  const res = await okOrThrow(fetch(`${RADAR_API_BASE}/api/vehicles/${encodeURIComponent(plate)}`, { method:"DELETE" }));

  return readJson(res);

}
 
// ---------- Estacionamento ----------

export async function storeByPlate(plate: string) {

  const res = await okOrThrow(fetch(`${RADAR_API_BASE}/api/parking/store?plate=${encodeURIComponent(plate)}`, { method:"POST" }));

  return readJson<{ zone?: string; spot?: string; sessionId: string }>(res);

}
 
export async function releaseByPlate(plate: string) {

  const res = await okOrThrow(fetch(`${RADAR_API_BASE}/api/parking/release?plate=${encodeURIComponent(plate)}`, { method:"POST" }));

  return readJson<{ status: string }>(res);

}
 
export async function locateByPlate(plate: string) {

  const res = await okOrThrow(fetch(`${RADAR_API_BASE}/api/locate/${encodeURIComponent(plate)}`));

  return readJson(res);

}
 
// ---------- TAGs ----------

export async function alarmTag(tagCode: string) {

  const res = await okOrThrow(fetch(`${RADAR_API_BASE}/api/tags/${encodeURIComponent(tagCode)}/alarm`, { method:"POST" }));

  return readJson(res);

}
 
export async function getTagByPlate(plate: string): Promise<string | null> {

  try {

    const v = await getVehicleByPlate(plate);

    return v?.tag_code || null;

  } catch { return null; }

}
 
// ---------- Ping ----------

export async function ping() {

  try {

    const r = await fetch(`${RADAR_API_BASE}/health`);

    return r.ok;

  } catch { return false; }

}

 