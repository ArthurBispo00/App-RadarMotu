// screens/RadarProximidade.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { BleManager, Device, State as BleState } from "react-native-ble-plx";
import { request, PERMISSIONS, RESULTS } from "react-native-permissions";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { Magnetometer } from "expo-sensors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRoute } from "@react-navigation/native";
import { alarmTag, getTagByPlate } from "../services/api";

// ---------- Constantes de radar ----------
const SIZE = 320;                 // diâmetro do radar
const R = SIZE / 2;               // raio em px
const MAX_METERS = 20;            // distância máxima representada no radar
const SWEEP_SPEED_DEG_PER_S = 120; // velocidade da varredura (graus/seg)

// ---------- Calibração ----------
const DEFAULT_TX_POWER = -61;     // RSSI @1m
const DEFAULT_N_PATH = 2.5;       // 2.0~3.5 indoor
const STORAGE_TX = "radar.txpower";
const STORAGE_NP = "radar.npath";

// ---------- Utils ----------
const clamp = (v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const toRad = (deg:number)=>deg*Math.PI/180;
const toDeg = (rad:number)=>rad*180/Math.PI;
function normAngle(deg:number){ let d=deg%360; if(d<0) d+=360; return d; }
function angDiff(a:number,b:number){ // menor diferença absoluta 0..180
  const d = Math.abs(normAngle(a)-normAngle(b));
  return d>180? 360-d : d;
}
function median(a:number[]){ if(!a.length) return NaN; const b=[...a].sort((x,y)=>x-y); const m=Math.floor(b.length/2); return b.length%2? b[m] : (b[m-1]+b[m])/2; }
function mad(a:number[], m:number){ const d=a.map(v=>Math.abs(v-m)).sort((x,y)=>x-y); const k=Math.floor(d.length/2); return d.length%2? d[k] : (d[k-1]+d[k])/2; }
function rssiToMeters(rssi:number, TX:number, NP:number){
  if(rssi==null) return null;
  const d = Math.pow(10,(TX - rssi)/(10*NP));
  return clamp(d, 0, 100);
}
function headingFromMag({x,y}:{x:number;y:number}){ // 0..360
  let deg = toDeg(Math.atan2(y, x));
  if(deg < 0) deg += 360;
  return deg;
}

export default function RadarProximidade(){
  useKeepAwake();
  const route = useRoute<any>();
  const plateParam: string | undefined = (route.params?.plate || "").toUpperCase();
  const tagParam: string | undefined = (route.params?.tag || "").toUpperCase();

  // Estado base
  const [tagCode, setTagCode] = useState<string | null>(tagParam || null);
  const [scanning, setScanning] = useState(false);
  const [rssiRaw, setRssiRaw] = useState<number | null>(null);
  const [rssiSmooth, setRssiSmooth] = useState<number | null>(null);
  const [meters, setMeters] = useState<number | null>(null);
  const [txPower, setTxPower] = useState(DEFAULT_TX_POWER);
  const [nPath, setNPath] = useState(DEFAULT_N_PATH);
  const [err, setErr] = useState<string | null>(null);

  // Direção (bearing) contínua
  const [heading, setHeading] = useState(0);
  const [bearing, setBearing] = useState<number | null>(null); // 0..360 (onde a moto estaria)
  const [bearingConf, setBearingConf] = useState(0);           // 0..1

  // BLE & buffers
  const managerRef = useRef(new BleManager());
  const emaRef = useRef<number | null>(null);
  const winRef = useRef<number[]>([]);
  const lastHitMsRef = useRef(0);

  // Varredura (sonar)
  const [sweepDeg, setSweepDeg] = useState(0);

  // Carregar tag por placa + calibração salva
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!tagCode && plateParam) {
        try {
          const t = await getTagByPlate(plateParam);
          if (mounted) setTagCode(t);
        } catch {}
      }
      const tx = await AsyncStorage.getItem(STORAGE_TX);
      const np = await AsyncStorage.getItem(STORAGE_NP);
      if (mounted) {
        if (tx) setTxPower(parseFloat(tx));
        if (np) setNPath(parseFloat(np));
      }
    })();
    return ()=>{ mounted=false; };
  }, [plateParam, tagCode]);

  // Bússola contínua
  useEffect(() => {
    const sub = Magnetometer.addListener((d) => {
      const h = headingFromMag({ x: d.x ?? 0, y: d.y ?? 0 });
      setHeading(Math.round(h));
    });
    Magnetometer.setUpdateInterval(120);
    return () => sub && sub.remove();
  }, []);

  // Varredura 360° (JS RAF loop — simples e estável)
  useEffect(() => {
    let raf:number;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setSweepDeg(prev => normAngle(prev + SWEEP_SPEED_DEG_PER_S * dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Permissões
  async function ensurePermissions() {
    try {
      if (Platform.OS === "android") {
        if (Platform.Version >= 31) {
          const p1 = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
          const p2 = await request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
          if (p1 !== RESULTS.GRANTED || p2 !== RESULTS.GRANTED) throw new Error("Permissões de Bluetooth negadas");
        } else {
          const p = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
          if (p !== RESULTS.GRANTED) throw new Error("Permissão de Localização negada");
        }
      } else {
        await request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL as any);
      }
      return true;
    } catch (e:any) {
      Alert.alert("Permissões", e?.message || "Permissão negada");
      return false;
    }
  }

  // Estimativa de direção (RSSI x heading) — janela de 6s
  type DirSample = { t:number; h:number; r:number };
  const dirWinRef = useRef<DirSample[]>([]);
  function updateBearingContinuous(rssi:number){
    const now = Date.now();
    // mantemos últimos 6s
    dirWinRef.current.push({ t: now, h: heading, r: rssi });
    dirWinRef.current = dirWinRef.current.filter(s => now - s.t <= 6000);

    // precisa haver variação de heading
    const hs = dirWinRef.current.map(s=>s.h);
    if (hs.length < 12) return; // amostras mínimas
    const minH = Math.min(...hs), maxH = Math.max(...hs);
    const spread = (maxH - minH + 360) % 360; // aproxima
    if (spread < 60) { setBearingConf(0); return; } // não girou o suficiente

    // normaliza pesos por RSSI (quanto melhor, maior peso)
    const rs = dirWinRef.current.map(s=>s.r);
    const rMed = median(rs);
    const rMad = mad(rs, rMed) || 1;
    // z-score robusto (quanto mais positivo, melhor)
    let sumX=0, sumY=0, sumW=0;
    dirWinRef.current.forEach(s=>{
      const z = (s.r - rMed) / (1.4826 * rMad);
      const w = Math.max(0, z + 1); // só positivo
      if (w > 0) {
        sumX += w * Math.cos(toRad(s.h));
        sumY += w * Math.sin(toRad(s.h));
        sumW += w;
      }
    });
    if (sumW <= 0) { setBearingConf(0); return; }
    const bx = sumX / sumW, by = sumY / sumW;
    const br = normAngle(toDeg(Math.atan2(by, bx)));
    // confiança ~ razão do vetor resultante
    const conf = clamp(Math.sqrt(bx*bx + by*by), 0, 1);
    setBearing(br);
    setBearingConf(conf);
  }

  // Inicia/para scan BLE
  async function toggleScan(){
    const mgr = managerRef.current;
    if (scanning){
      try { mgr.stopDeviceScan(); } catch {}
      setScanning(false);
      return;
    }
    if (!tagCode) { Alert.alert("Sem TAG", "Não há TAG vinculada a esta placa."); return; }
    const ok = await ensurePermissions(); if (!ok) return;
    const st = await mgr.state(); if (st !== BleState.PoweredOn){ Alert.alert("Bluetooth", "Ative o Bluetooth."); return; }

    setErr(null); setScanning(true);
    emaRef.current = null; winRef.current = []; dirWinRef.current = [];

    mgr.startDeviceScan(null, { allowDuplicates: true }, (error, device: Device | null) => {
      if (error){ setErr(error.message); setScanning(false); return; }
      if (!device) return;
      const name = (device.localName || device.name || "").toUpperCase();
      if (name !== tagCode.toUpperCase()) return;
      if (typeof device.rssi !== "number") return;

      // janela + mediana/MAD
      const win = winRef.current;
      win.push(device.rssi);
      if (win.length > 25) win.shift();
      const med = median(win);
      const _mad = mad(win, med) || 1;
      const cutLow = med - 3*_mad, cutHigh = med + 3*_mad;
      const clipped = clamp(device.rssi, cutLow, cutHigh);

      // EMA
      const alpha = 0.25;
      emaRef.current = emaRef.current == null ? clipped : (alpha*clipped + (1-alpha)*(emaRef.current as number));
      const smooth = Math.round(emaRef.current);
      setRssiRaw(Math.round(device.rssi));
      setRssiSmooth(smooth);

      // Distância
      const d = rssiToMeters(smooth, txPower, nPath);
      if (d != null) setMeters(d);

      // Atualiza direção contínua
      updateBearingContinuous(smooth);
    });
  }

  // Fecha scan ao sair
  useEffect(()=>()=>{ try{ managerRef.current.stopDeviceScan(); }catch{} },[]);

  // Calibrar @1m
  const calibrateOneMeter = async () => {
    if (!scanning){ Alert.alert("Calibração", "Inicie o sonar para calibrar."); return; }
    const samples:number[] = [];
    winRef.current = [];
    const start = Date.now();
    Alert.alert("Calibração", "Mantenha o celular a ~1m da TAG por 3s.");
    const id = setInterval(()=>{
      if (rssiRaw != null) samples.push(rssiRaw);
      if (Date.now() - start > 3000){
        clearInterval(id);
        if (samples.length >= 10){
          const med = Math.round(median(samples));
          setTxPower(med);
          AsyncStorage.setItem(STORAGE_TX, String(med));
          Alert.alert("OK", `TX_POWER ajustado para ${med} dBm`);
        } else {
          Alert.alert("Calibração", "Poucas amostras. Tente novamente.");
        }
      }
    }, 80);
  };

  // “Buzinar”
  const onBuzz = async () => {
    try {
      const tag = (tagCode || "TAG01").toUpperCase();
      await alarmTag(tag);
      Alert.alert("Comando enviado", `TOGGLE_BUZZER → ${tag}`);
    } catch {
      Alert.alert("Erro", "Falha ao enviar comando para a TAG.");
    }
  };

  // Posição do blip da moto no radar (centro = você, raio proporcional à distância)
  const blip = useMemo(() => {
    if (meters == null) return null;
    // raio relativo: 0 no centro, 1 na borda
    const rRel = clamp(meters / MAX_METERS, 0, 1); // <<<<<<<<<<< AQUI ESTÁ A CORREÇÃO
    const rPx = 8 + rRel * (R - 12); // pequena margem
    const angle = bearing ?? 0;      // se não sabe direção, fixa em 0 (topo)
    const x = R + rPx * Math.sin(toRad(angle)); // sin -> x (porque ângulo 0 fica pra cima)
    const y = R - rPx * Math.cos(toRad(angle)); // cos -> y
    return { x, y, rPx, angle };
  }, [meters, bearing]);

  // Quando a varredura "acerta" o blip: ping + haptics
  useEffect(() => {
    if (!blip) return;
    const diff = angDiff(sweepDeg, blip.angle);
    if (diff < 10) {
      const now = Date.now();
      if (now - lastHitMsRef.current > 500) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        lastHitMsRef.current = now;
      }
    }
  }, [sweepDeg, blip]);

  // Cores conforme distância
  const ringColor = useMemo(()=>{
    if (meters == null) return "#334155";
    if (meters < 2) return "#22DD44";
    if (meters < 5) return "#A3E635";
    if (meters < 10) return "#F59E0B";
    return "#F87171";
  }, [meters]);

  const title = plateParam ? `Sonar — ${plateParam}${tagCode ? ` / ${tagCode}` : ""}` : `Sonar ${tagCode || ""}`;

  return (
    <View style={s.c}>
      <Text style={s.t}>{title}</Text>

      <View style={s.radarWrap}>
        <Svg width={SIZE} height={SIZE}>
          {/* Fundo */}
          <Circle cx={R} cy={R} r={R} fill="#0F131A" stroke="#273244" strokeWidth={2} />
          {/* Anéis */}
          <Circle cx={R} cy={R} r={R*0.75} fill="none" stroke="#263142" strokeWidth={1}/>
          <Circle cx={R} cy={R} r={R*0.5}  fill="none" stroke="#263142" strokeWidth={1}/>
          <Circle cx={R} cy={R} r={R*0.25} fill="none" stroke="#263142" strokeWidth={1}/>

          {/* Varredura */}
          {(() => {
            const x2 = R + (R-4) * Math.sin(toRad(sweepDeg));
            const y2 = R - (R-4) * Math.cos(toRad(sweepDeg));
            return (
              <Line
                x1={R}
                y1={R}
                x2={x2}
                y2={y2}
                stroke="#38BDF8"
                strokeOpacity={0.85}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })()}

          {/* Blip da moto */}
          {blip && (
            <>
              <Circle cx={blip.x} cy={blip.y} r={8} fill={ringColor} stroke="#0F131A" strokeWidth={2} />
              <SvgText x={blip.x} y={blip.y - 12} fill="#E5E7EB" fontSize="10" fontWeight="bold" textAnchor="middle">
                🏍️
              </SvgText>
            </>
          )}

          {/* Centro (você) */}
          <Circle cx={R} cy={R} r={5} fill="#22DD44" />
        </Svg>
      </View>

      <View style={s.kpis}>
        <Text style={s.info}>RSSI: {rssiSmooth ?? (rssiRaw ?? "—")} dBm</Text>
        <Text style={s.info}>Distância: {meters != null ? `${meters.toFixed(1)} m` : "—"}</Text>
        <Text style={s.info}>
          Direção: {bearing != null ? `${Math.round(bearing)}°` : "—"}  {"  "}
          Confiança: {Math.round(bearingConf*100)}%
        </Text>
        {bearingConf < 0.35 && (
          <Text style={s.tip}>Gire devagar 360° para melhorar a direção.</Text>
        )}
      </View>

      <View style={s.row}>
        <TouchableOpacity style={[s.btn, scanning ? s.btnStop : s.btnGo]} onPress={toggleScan}>
          <Text style={s.btnT}>{scanning ? "Parar Sonar" : "Iniciar Sonar"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnBuzz]} onPress={onBuzz}>
          <Text style={s.btnTB}>Buzinar / LED</Text>
        </TouchableOpacity>
      </View>

      <View style={s.row}>
        <TouchableOpacity style={[s.btn, s.btnCal]} onPress={calibrateOneMeter}>
          <Text style={s.btnT}>Calibrar @1m</Text>
        </TouchableOpacity>
        <View style={[s.param, {borderColor:"#1F2733"}]}>
          <Text style={s.paramT}>TX:{txPower} dBm  ·  N:{nPath.toFixed(1)}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  c:{ flex:1, backgroundColor:"#0D1117", padding:16 },
  t:{ color:"#fff", fontSize:18, fontWeight:"bold", marginBottom:12 },

  radarWrap:{ alignSelf:"center", width:SIZE, height:SIZE, borderRadius:R, overflow:"hidden",
    backgroundColor:"#0F131A", borderWidth:1, borderColor:"#1E293B" },

  kpis:{ marginTop:10 },
  info:{ color:"#D1D5DB", marginTop:4 },
  tip:{ color:"#94A3B8", marginTop:6, fontStyle:"italic" },

  row:{ flexDirection:"row", gap:12, marginTop:14, alignItems:"center" },
  btn:{ flex:1, paddingVertical:14, borderRadius:10, alignItems:"center" },
  btnGo:{ backgroundColor:"#22DD44" },
  btnStop:{ backgroundColor:"#F59E0B" },
  btnBuzz:{ backgroundColor:"#3B82F6" },
  btnCal:{ backgroundColor:"#374151" },
  btnT:{ color:"#000", fontWeight:"bold" },
  btnTB:{ color:"#fff", fontWeight:"bold" },

  param:{ paddingVertical:12, paddingHorizontal:14, borderRadius:10, borderWidth:1, backgroundColor:"#121826" },
  paramT:{ color:"#9CA3AF", fontWeight:"bold" },
});