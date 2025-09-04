// components/VehicleCard.tsx

import React from "react";

import { View, Text, StyleSheet } from "react-native";
 
const card="#2C2F33", border="#4F545C", txt="#E0E0E0", dim="#B0B0B0";
 
export default function VehicleCard({ vehicle }: { vehicle: any }) {

  if (!vehicle) return null;

  return (
<View style={s.card}>
<Text style={s.placa}>{vehicle.plate}</Text>
<Text style={s.line}><Text style={s.dim}>Modelo:</Text> {vehicle.model || "-"}</Text>
<Text style={s.line}><Text style={s.dim}>Marca:</Text> {vehicle.brand || "-"}</Text>
<Text style={s.line}><Text style={s.dim}>Cor:</Text> {vehicle.color || "-"}</Text>
<Text style={s.line}><Text style={s.dim}>Ano:</Text> {vehicle.year_make || "-"} / {vehicle.year_model || "-"}</Text>
<Text style={s.line}><Text style={s.dim}>Chassi:</Text> {vehicle.vin || "-"}</Text>
<Text style={s.line}><Text style={s.dim}>TAG:</Text> {vehicle.tag_code || "—"}</Text>
</View>

  );

}
 
const s = StyleSheet.create({

  card:{ backgroundColor:card, borderRadius:10, padding:12, borderWidth:1, borderColor:border, marginTop:10 },

  placa:{ color:"#fff", fontWeight:"bold", fontSize:16, marginBottom:6 },

  line:{ color:txt, marginTop:2 },

  dim:{ color:dim }

});

 