import React, { useEffect, useState, useMemo } from "react";

import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";

import { useRoute, useNavigation } from "@react-navigation/native";

import { RADAR_API_BASE, WS_URL } from "../config/env";
 
const W = 320, H = 220;
 
type Anchor = { x:number; y:number };

type Anchors = Record<string, Anchor>;

type Pos = { x:number; y:number };
 
async function tryGetJSON(url: string) {

  try { const r = await fetch(url); if (!r.ok) throw new Error(); return await r.json(); }

  catch { return null; }

}
 
export default function MapaScreen() {

  const route = useRoute<any>();

  const nav = useNavigation<any>();

  const plate: string | undefined = (route.params?.plate || "").toUpperCase();
 
  const [position, setPosition] = useState<Pos | null>(null);

  const [anchors, setAnchors] = useState<Anchors>({});

  const [mapScale, setMapScale] = useState({ scaleX: 1, scaleY: 1 });

  const [status, setStatus] = useState("Conectando...");

  const [tagCode, setTagCode] = useState<string | null>(null);

  const [locInfo, setLocInfo] = useState<any>(null);
 
  useEffect(() => {

    if (!plate) {

      Alert.alert("Acesso inválido", "Abra o mapa via: Operações por Placa → Buscar.");

      nav.goBack();

    }

  }, [plate]);
 
  useEffect(() => {

    let mounted = true;

    async function boot() {

      const v = await tryGetJSON(`${RADAR_API_BASE}/api/vehicles/by-plate/${encodeURIComponent(plate)}`);

      if (mounted) setTagCode(v?.tag_code || null);

      const loc = await tryGetJSON(`${RADAR_API_BASE}/api/locate/${encodeURIComponent(plate)}`);

      if (mounted && loc) setLocInfo(loc);

    }

    if (plate) boot();

    return () => { mounted = false; };

  }, [plate]);
 
  useEffect(() => {

    let mounted = true;

    async function loadAnchors(a: Anchors) {

      const vals = Object.values(a || {});

      const maxX = Math.max(...vals.map(p=>p.x), 1);

      const maxY = Math.max(...vals.map(p=>p.y), 1);

      if (mounted) {

        setAnchors(a);

        setMapScale({ scaleX: W/maxX, scaleY: H/maxY });

      }

    }

    (async () => {

      const a1 = await tryGetJSON(`${RADAR_API_BASE}/api/anchors`);

      if (a1) return loadAnchors(a1);

      const a2 = await tryGetJSON(`${RADAR_API_BASE}/anchors.json`);

      if (a2) return loadAnchors(a2);

    })();

    return () => { mounted = false; };

  }, []);
 
  useEffect(() => {

    if (!plate) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setStatus("Conectado");

    ws.onclose = () => setStatus("Desconectado");

    ws.onerror = () => setStatus("Erro");
 
    ws.onmessage = (event) => {

      try {

        const data = JSON.parse(event.data);

        if (data?.type === "initial_setup") {

          const backendAnchors: Anchors = data.payload?.anchors || {};

          const initialPos: Pos | null = data.payload?.initial_pos || null;

          const vals = Object.values(backendAnchors);

          const maxX = Math.max(...vals.map(p=>p.x), 1);

          const maxY = Math.max(...vals.map(p=>p.y), 1);

          setAnchors(backendAnchors);

          setMapScale({ scaleX: W/maxX, scaleY: H/maxY });

          if (initialPos) setPosition(initialPos);

          return;

        }

        if (data?.type === "position_update") {

          const pos: Pos | null = data.payload?.pos || null;

          const id: string | undefined = (data.payload?.id || "").toUpperCase();

          // Aceita frames da TAG vinculada

          if (pos && id && id === (tagCode || "TAG01").toUpperCase()) {

            setPosition(pos);

          }

          return;

        }

        if (data?.pos && data?.id && (data.id || "").toUpperCase() === (tagCode || "TAG01").toUpperCase()) {

          setPosition(data.pos);

        }

      } catch {}

    };
 
    return () => { try { ws.close(); } catch {} };

  }, [plate, tagCode]);
 
  const onBuzz = async () => {

    try {

      const tag = (tagCode || "TAG01").toUpperCase();

      await fetch(`${RADAR_API_BASE}/api/tags/${encodeURIComponent(tag)}/alarm`, { method: "POST" });

      Alert.alert("Comando Enviado", `TOGGLE_BUZZER → ${tag}`);

    } catch {

      Alert.alert("Erro", "Não foi possível enviar comando para a TAG.");

    }

  };
 
  return (
<View style={s.container}>
<Text style={s.title}>Mapa do Pátio</Text>
<Text style={s.info}>Status: {status}</Text>
<Text style={s.info}>Placa: {plate}{tagCode ? `  |  TAG: ${tagCode}` : ""}</Text>
<Text style={s.info}>{locInfo ? `Zona: ${locInfo.zone || "-"}  |  Vaga: ${locInfo.spot || "-"}` : "Sem info de zona/vaga"}</Text>
 
      <View style={s.map}>

        {Object.entries(anchors).map(([id, pos]) => (
<View key={id} style={[s.dotAnchor, { left: pos.x * mapScale.scaleX - 8, top: pos.y * mapScale.scaleY - 8 }]}>
<Text style={s.anchorText}>{id}</Text>
</View>

        ))}

        {position && (
<View style={[s.dotMoto, { left: position.x * mapScale.scaleX - 6, top: position.y * mapScale.scaleY - 6 }]} />

        )}
</View>
 
      <TouchableOpacity style={s.btn} onPress={onBuzz}>
<Text style={s.btnT}>Buzinar / LED</Text>
</TouchableOpacity>
 
      <TouchableOpacity

        style={[s.btn, { backgroundColor:"#3B82F6", marginTop:10 }]}

        onPress={() => nav.navigate("RadarProximidade", { plate, tag: tagCode })}
>
<Text style={{color:"#fff", fontWeight:"bold"}}>Abrir Radar</Text>
</TouchableOpacity>
</View>

  );

}
 
const s = StyleSheet.create({

  container: { flex: 1, backgroundColor: "#1A1D21", padding: 16 },

  title: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginBottom: 8 },

  info: { color: "#E0E0E0", marginBottom: 6 },

  map: { width: W, height: H, backgroundColor: "#23272A", borderRadius: 8, borderWidth: 1, borderColor: '#444', position:"relative", overflow:"hidden" },

  dotAnchor: { position: 'absolute', width: 16, height: 16, borderRadius: 2, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },

  anchorText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },

  dotMoto: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#fff' },

  btn: { backgroundColor: "#22DD44", padding: 15, borderRadius: 8, marginTop: 20, alignItems: 'center' },

  btnT: { color: '#000', fontWeight: 'bold' }

});

 