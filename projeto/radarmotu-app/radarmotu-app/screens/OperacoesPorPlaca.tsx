import React, { useCallback, useRef, useState } from "react";

import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from "react-native";

import PlacaRecognition from "./PlacaRecognition";

import { storeByPlate, releaseByPlate } from "../services/api";

import { useNavigation } from "@react-navigation/native";
 
const radarMotuGreen = "#22DD44", textColorLight="#FFFFFF", bg="#1A1D21", card="#2C2F33", border="#4F545C";
 
export default function OperacoesPorPlaca() {

  const nav = useNavigation<any>();

  const [plate, setPlate] = useState<string>("");

  const [busy, setBusy] = useState(false);

  const last = useRef<string>("");
 
  const onPlacaRecognized = useCallback((t: string) => {

    const re = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i;

    if (!t || !re.test(t)) { Alert.alert("Placa inválida", t||""); return; }

    const p = t.toUpperCase();

    if (p === last.current) return;

    last.current = p;

    setPlate(p);

    Alert.alert("Placa", p);

  }, []);
 
  const doStore = async () => {

    if (!plate) return Alert.alert("Escaneie a placa");

    try { setBusy(true);

      const r = await storeByPlate(plate);

      Alert.alert("Alocada", `Zona: ${r.zone || "-"}\nVaga: ${r.spot || "-"}`);

    } catch(e:any){ Alert.alert("Erro", e?.message||"Falha"); }

    finally{ setBusy(false); }

  };
 
  const doRelease = async () => {

    if (!plate) return Alert.alert("Escaneie a placa");

    try { setBusy(true);

      await releaseByPlate(plate);

      Alert.alert("Liberada", "Vaga liberada.");

    } catch(e:any){ Alert.alert("Erro", e?.message||"Falha"); }

    finally{ setBusy(false); }

  };
 
  return (
<View style={s.c}>
<Text style={s.t}>Operações por Placa (OCR)</Text>
<View style={s.card}>
<PlacaRecognition onPlacaRecognized={onPlacaRecognized} />
<View style={s.row}><Text style={s.lab}>Placa:</Text><Text style={s.plate}>{plate||"—"}</Text></View>
<View style={s.buttons}>
<TouchableOpacity style={[s.btn,s.primary]} onPress={doStore} disabled={busy||!plate}>

            {busy? <ActivityIndicator color="#000"/> : <Text style={s.btnP}>Armazenar</Text>}
</TouchableOpacity>
<TouchableOpacity style={[s.btn,s.secondary]} onPress={()=>nav.navigate("MapaDoPatio", { plate })} disabled={!plate}>
<Text style={s.btnS}>Buscar (Mapa)</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.btn,s.infoB]} onPress={()=>nav.navigate("RadarProximidade", { plate })} disabled={!plate}>
<Text style={s.btnI}>Radar</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.btn,s.warn]} onPress={doRelease} disabled={busy||!plate}>
<Text style={s.btnW}>Liberar</Text>
</TouchableOpacity>
</View>
</View>
</View>

  );

}

const s = StyleSheet.create({

  c:{flex:1, backgroundColor:bg, padding:16},

  t:{color:textColorLight,fontWeight:"bold",fontSize:18,marginBottom:12},

  card:{backgroundColor:card,borderRadius:10,padding:16,borderWidth:1,borderColor:border},

  row:{flexDirection:"row",gap:8,marginTop:12}, lab:{color:"#B0B0B0"}, plate:{color:textColorLight,fontWeight:"bold"},

  buttons:{flexDirection:"row",gap:10,marginTop:16, flexWrap:"wrap"},

  btn:{paddingVertical:12,paddingHorizontal:14,borderRadius:8,minWidth:120,alignItems:"center"},

  primary:{backgroundColor:radarMotuGreen}, btnP:{color:"#000",fontWeight:"bold"},

  secondary:{borderWidth:2,borderColor:radarMotuGreen}, btnS:{color:radarMotuGreen,fontWeight:"bold"},

  infoB:{backgroundColor:"#3B82F6"}, btnI:{color:"#fff",fontWeight:"bold"},

  warn:{backgroundColor:"#FFB020"}, btnW:{color:"#000",fontWeight:"bold"},

});

 