import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import Svg, { Circle, Line as SvgLine, Text as SvgText } from "react-native-svg";
import { BleManager, Device, State as BleState } from "react-native-ble-plx";
import { request, PERMISSIONS, RESULTS } from "react-native-permissions";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useKeepAwake } from "expo-keep-awake";
import { Magnetometer } from "expo-sensors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRoute } from "@react-navigation/native";
import { alarmTag, getTagByPlate } from "../services/api";

// ---------- Constantes ----------
const SIZE = 320;                 // diâmetro do radar
const R = SIZE / 2;               // raio em px
const MAX_METERS = 20;            // distância máxima representada no radar (ajuste pro seu pátio)
const EDGE_MARGIN = 12;           // margem interna da borda
const CENTER_MIN = 2;             // distância visual mínima do centro
const SWEEP_SPEED_DEG_PER_S = 120;

// Calibração
const DEFAULT_TX_POWER = -61;     // RSSI @1m (ajuste com Calibrar @1m)
const DEFAULT_N_PATH = 2.5;
const STORAGE_TX = "radar.txpower";
const STORAGE_NP = "radar.npath";

// ---------- Utils ----------
const clamp = (v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const toRad = (deg:number)=>deg*Math.PI/180;
const toDeg = (rad:number)=>rad*180/Math.PI;
function normAngle(deg:number){ let d=deg%360; if(d<0) d+=360; return d; }
function angDiff180(a:number,b:number){
  // diferença de a→b em [-180,+180]
  let d = (b - a + 540) % 360 - 180;
  return d;
}
function median(a:number[]){ if(!a.length) return NaN; const b=[...a].sort((x,y)=>x-y); const m=Math.floor(b.length/2); return b.length%2? b[m] : (b[m-1]+b[m])/2; }
function mad(a:number[], m:number){ const d=a.map(v=>Math.abs(v-m)).sort((x,y)=>x-y); const k=Math.floor(d.length/2); return d.length%2? d[k] : (d[k-1]+d[k])/2; }
function rssiToMeters(rssi:number, TX:number, NP:number){
  if(rssi==null) return null;
  const d = Math.pow(10,(TX - rssi)/(10*NP));
  return clamp(d, 0, 100);
}
function headingFromMag({x,y}:{x:number;y:number}){ let deg = toDeg(Math.atan2(y, x)); if(deg < 0) deg += 360; return deg; }
function arrowFromDelta(delta:number){
  // delta: turn right positivo, left negativo (relativo à frente do usuário)
  const a = Math.abs(delta);
  if (a <= 22.5) return "⬆️";
  if (a <= 67.5)  return delta > 0 ? "↗️" : "↖️";
  if (a <= 112.5) return delta > 0 ? "➡️" : "⬅️";
  if (a <= 157.5) return delta > 0 ? "↘️" : "↙️";
  return "⬇️";
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
  const [metersSmoothed, setMetersSmoothed] = useState<number | null>(null);
  const [txPower, setTxPower] = useState(DEFAULT_TX_POWER);
  const [nPath, setNPath] = useState(DEFAULT_N_PATH);
  const [err, setErr] = useState<string | null>(null);

  // Direção (bearing) absoluta estimada
  const [heading, setHeading] = useState(0);
  const [bearingDeg, setBearingDeg] = useState<number | null>(null); // 0..360 (absoluto)
  const [bearingConf, setBearingConf] = useState(0);                 // 0..1

  // BLE & buffers
  const managerRef = useRef(new BleManager());
  const emaRssiRef = useRef<number | null>(null);
  const winRef = useRef<number[]>([]);
  const lastHitMsRef = useRef(0);

  // EMA da distância (extra estabilidade)
  const emaDistRef = useRef<number | null>(null);

  // Suavização circular do bearing via vetor unitário
  const bearingVecRef = useRef<{x:number,y:number} | null>(null);

  // Varredura (sonar)
  const [sweepDeg, setSweepDeg] = useState(0);

  // --------- GUIA DE NAVEGAÇÃO (texto/voz) ---------
  const [instruction, setInstruction] = useState<string>("Aguardando direção...");
  const [arrow, setArrow] = useState<string>("⬆️");
  const lastInstrRef = useRef<string>("");
  const lastTtsRef = useRef<number>(0);
  const lastInstrChangeRef = useRef<number>(0);

  const SPEAK_MIN_MS = 2000;    // mínimo entre falas
  const INSTR_MIN_MS = 1200;    // mínimo entre trocas de instrução
  const YAW_STICK = 6;          // histerese angular em graus para evitar oscilações

  // Carregar TAG pela placa + calibração salva
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!tagCode && plateParam) {
        try { const t = await getTagByPlate(plateParam); if (mounted) setTagCode(t); } catch {}
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

  // Varredura 360° (loop JS)
  useEffect(() => {
    let raf:number, last=Date.now();
    const tick = () => {
      const now = Date.now(), dt = (now-last)/1000; last=now;
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

  // Estimativa contínua do bearing (RSSI x heading) com suavização circular
  type DirSample = { t:number; h:number; r:number };
  const dirWinRef = useRef<DirSample[]>([]);
  function updateBearingContinuous(rssi:number){
    const now = Date.now();
    dirWinRef.current.push({ t: now, h: heading, r: rssi });
    dirWinRef.current = dirWinRef.current.filter(s => now - s.t <= 6000);

    const hs = dirWinRef.current.map(s=>s.h);
    if (hs.length < 12) return;

    // precisa haver rotação suficiente
    const minH = Math.min(...hs), maxH = Math.max(...hs);
    const spread = (maxH - minH + 360) % 360;
    if (spread < 60) { setBearingConf(0); return; }

    // pesos por qualidade do RSSI (robusto)
    const rs = dirWinRef.current.map(s=>s.r);
    const rMed = median(rs);
    const rMad = mad(rs, rMed) || 1;

    let vx=0, vy=0, wsum=0;
    dirWinRef.current.forEach(s=>{
      const z = (s.r - rMed) / (1.4826 * rMad);
      const w = Math.max(0, z + 1); // só positivo
      if (w > 0) {
        vx += w * Math.cos(toRad(s.h));
        vy += w * Math.sin(toRad(s.h));
        wsum += w;
      }
    });
    if (wsum <= 0) { setBearingConf(0); return; }

    // vetor “melhor direção”
    let nx = vx/wsum, ny = vy/wsum;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    const conf = clamp(Math.sqrt((vx/wsum)**2 + (vy/wsum)**2), 0, 1);

    if (conf > 0.35) {
      const betaA = 0.18; // suavização angular
      const prev = bearingVecRef.current || { x: nx, y: ny };
      const mix = { x: (1-betaA)*prev.x + betaA*nx, y: (1-betaA)*prev.y + betaA*ny };
      const L = Math.hypot(mix.x, mix.y) || 1;
      const sx = mix.x / L, sy = mix.y / L;
      bearingVecRef.current = { x: sx, y: sy };
      setBearingDeg(normAngle(toDeg(Math.atan2(sy, sx))));
      setBearingConf(conf);
    } else {
      setBearingConf(conf);
    }
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
    emaRssiRef.current = null; winRef.current = []; dirWinRef.current = [];
    emaDistRef.current = null;

    mgr.startDeviceScan(null, { allowDuplicates: true }, (error, device: Device | null) => {
      if (error){ setErr(error.message); setScanning(false); return; }
      if (!device) return;

      // Nome/LOCALNAME da TAG tolerante (trim + includes)
      const name = (device.localName || device.name || "").toUpperCase().trim();
      const wanted = tagCode.toUpperCase().trim();
      if (!name || !wanted || !name.includes(wanted)) return;
      if (typeof device.rssi !== "number") return;

      // janela + mediana/MAD (outliers)
      const w = winRef.current;
      w.push(device.rssi);
      if (w.length > 40) w.shift();
      const med = median(w);
      const _mad = mad(w, med) || 1;
      const cutLow = med - 3*_mad, cutHigh = med + 3*_mad;
      const clipped = clamp(device.rssi, cutLow, cutHigh);

      // EMA de RSSI (estável)
      const alphaRssi = 0.18;
      emaRssiRef.current = emaRssiRef.current == null ? clipped : (alphaRssi*clipped + (1-alphaRssi)*(emaRssiRef.current as number));
      const smooth = Math.round(emaRssiRef.current);
      setRssiRaw(Math.round(device.rssi));
      setRssiSmooth(smooth);

      // Distância por modelo + EMA da distância + histerese (com init correto)
      const d = rssiToMeters(smooth, txPower, nPath);
      if (d != null) {
        if (emaDistRef.current == null) {
          emaDistRef.current = d;
          setMetersSmoothed(d);
        } else {
          const alphaDist = 0.15;
          const prev = emaDistRef.current;
          const cand = alphaDist * d + (1 - alphaDist) * prev;
          if (Math.abs(cand - prev) > 0.05) { // ignora “respiração” < 5 cm
            emaDistRef.current = cand;
            setMetersSmoothed(cand);
          }
        }
      }

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

  // Buzinar
  const onBuzz = async () => {
    try {
      const tag = (tagCode || "TAG01").toUpperCase();
      await alarmTag(tag);
      Alert.alert("Comando enviado", `TOGGLE_BUZZER → ${tag}`);
    } catch {
      Alert.alert("Erro", "Falha ao enviar comando para a TAG.");
    }
  };

  // ====== POSIÇÃO DO BLIP (longe -> borda, perto -> centro) ======
  const blip = useMemo(() => {
    if (metersSmoothed == null) return null;
    const norm = clamp(metersSmoothed / MAX_METERS, 0, 1); // 0..1
    const rPx = CENTER_MIN + norm * (R - EDGE_MARGIN - CENTER_MIN);
    const angle = bearingDeg ?? 0; // se ainda sem direção, 0° (topo)
    const x = R + rPx * Math.sin(toRad(angle)); // sin -> x
    const y = R - rPx * Math.cos(toRad(angle)); // cos -> y
    return { x, y, angle };
  }, [metersSmoothed, bearingDeg]);

  // Ping + haptics quando a varredura cruza o blip
  useEffect(() => {
    if (!blip) return;
    const diff = Math.abs(angDiff180(sweepDeg, blip.angle));
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
    if (metersSmoothed == null) return "#334155";
    if (metersSmoothed < 2) return "#22DD44";
    if (metersSmoothed < 5) return "#A3E635";
    if (metersSmoothed < 10) return "#F59E0B";
    return "#F87171";
  }, [metersSmoothed]);

  // ====== GUIA: calcula instrução textual + seta ======
  useEffect(() => {
    const now = Date.now();

    if (metersSmoothed == null || bearingDeg == null) {
      const msg = "Aguardando direção...";
      if (now - lastInstrChangeRef.current > INSTR_MIN_MS && msg !== lastInstrRef.current) {
        setInstruction(msg); setArrow("⬆️");
        lastInstrRef.current = msg; lastInstrChangeRef.current = now;
      }
      return;
    }

    if (bearingConf < 0.35) {
      const msg = "Gire devagar 360° para obter direção";
      if (now - lastInstrChangeRef.current > INSTR_MIN_MS && msg !== lastInstrRef.current) {
        setInstruction(msg); setArrow("🔄");
        lastInstrRef.current = msg; lastInstrChangeRef.current = now;
      }
      return;
    }

    // delta relativo à frente do usuário: direita = +, esquerda = -
    let delta = angDiff180(heading, bearingDeg);

    // histerese angular suave (evita ficar trocando “levemente”/“vire” perto do limiar)
    const prev = lastInstrRef.current;
    if (prev.includes("Levemente") || prev.includes("Vire")) {
      if (Math.abs(delta) < YAW_STICK) delta = 0;
    }

    const absd = Math.abs(delta);
    let msg = "";
    if (metersSmoothed < 1.5) msg = "Chegou • a ≤1,5 m";
    else if (absd <= 15) msg = "Siga em frente";
    else if (absd <= 35) msg = delta > 0 ? "Levemente à direita" : "Levemente à esquerda";
    else if (absd <= 100) msg = delta > 0 ? "Vire à direita" : "Vire à esquerda";
    else msg = "Retorne";

    const arr = arrowFromDelta(delta);

    // aplica limites de troca e fala
    if (now - lastInstrChangeRef.current > INSTR_MIN_MS && msg !== lastInstrRef.current) {
      setInstruction(msg);
      setArrow(arr);
      lastInstrRef.current = msg;
      lastInstrChangeRef.current = now;

      if (now - lastTtsRef.current > SPEAK_MIN_MS) {
        try { Speech.speak(msg, { language: "pt-BR", pitch: 1.0, rate: 1.0 }); } catch {}
        lastTtsRef.current = now;
      }
    }
  }, [heading, bearingDeg, bearingConf, metersSmoothed]);

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
          <Circle cx={R} cy={R} r={R*0.5}  fill="none" stroke="#263142" strokeWidth={1}/>
          <Circle cx={R} cy={R} r={R*0.25} fill="none" stroke="#263142" strokeWidth={1}/>

          {/* Varredura */}
          {(() => {
            const x2 = R + (R-4) * Math.sin(toRad(sweepDeg));
            const y2 = R - (R-4) * Math.cos(toRad(sweepDeg));
            return (
              <SvgLine
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

      {/* GUIA DE NAVEGAÇÃO */}
      <View style={s.guideBox}>
        <Text style={s.arrow}>{arrow}</Text>
        <View style={{flex:1}}>
          <Text style={s.guideMain}>{instruction}</Text>
          <Text style={s.guideSub}>
            Distância: {metersSmoothed != null ? `${metersSmoothed.toFixed(1)} m` : "—"}  ·  Confiança: {Math.round(bearingConf*100)}%
          </Text>
        </View>
      </View>

      {/* KPIs + Diagnóstico */}
      <View style={s.kpis}>
        <Text style={s.info}>TAG alvo: {tagCode || "—"}</Text>
        <Text style={s.info}>RSSI (raw/smooth): {rssiRaw ?? "—"} / {rssiSmooth ?? "—"} dBm</Text>
        {err && <Text style={[s.info, {color:"#FCA5A5"}]}>Erro: {err}</Text>}
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
          <Text style={s.paramT}>TX:{txPower} dBm  ·  N:{nPath.toFixed(1)}</Text>
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

  guideBox:{ marginTop:12, flexDirection:"row", alignItems:"center", gap:12, padding:12, borderRadius:12,
    backgroundColor:"#121826", borderWidth:1, borderColor:"#1F2733" },
  arrow:{ fontSize:28, width:38, textAlign:"center" },
  guideMain:{ color:"#E5E7EB", fontSize:16, fontWeight:"bold" },
  guideSub:{ color:"#9CA3AF", marginTop:2 },

  kpis:{ marginTop:10 },
  info:{ color:"#D1D5DB", marginTop:4 },

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
