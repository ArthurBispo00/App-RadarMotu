import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const bg = '#1A1D21';
const header = '#202328';
const txt = '#E0E0E0';
const pri = '#22DD44';

export default function SobreNosScreen() {
  const nav = useNavigation();
  useLayoutEffect(() => { (nav as any).setOptions?.({ headerStyle: { backgroundColor: header }, headerTintColor: '#fff' }); }, [nav]);

  return (
    <View style={s.c}>
      <Text style={s.h1}>Radar Motu</Text>
      <Text style={s.p}>Ecossistema de gerenciamento de estacionamento de motos com OCR de placa, localização BLE, mapa em tempo real e painel gerencial.</Text>
      <TouchableOpacity style={s.btn} onPress={() => Linking.openURL('https://example.com')}>
        <Text style={s.btnT}>Saiba mais</Text>
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  c:{flex:1, backgroundColor:bg, padding:16}, h1:{color:'#fff',fontSize:22,fontWeight:'bold',marginBottom:10}, p:{color:txt,lineHeight:20},
  btn:{marginTop:16, backgroundColor:pri, paddingVertical:10, paddingHorizontal:12, borderRadius:8, alignSelf:'flex-start'}, btnT:{color:'#000',fontWeight:'bold'}
});
