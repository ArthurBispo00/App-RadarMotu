// screens/Cadastro.tsx

import React, { useState, useLayoutEffect } from 'react';

import { View, Text, TextInput, StyleSheet, Alert, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useNavigation } from '@react-navigation/native';

import { DrawerNavigationProp } from '@react-navigation/drawer';

import { DrawerParamList } from '../App';

import PlacaRecognition from './PlacaRecognition';

import { createVehicle, updateVehicle, getVehicleByPlate, storeByPlate } from '../services/api';
 
const radarMotuGreen = '#22DD44';

const screenDarkBackground = '#1A1D21';

const headerScreenColor = '#202328';

const textColorLight = '#FFFFFF';

const placeholderTextColor = '#A0A0A0';

const inputBackgroundColor = '#2C2F33';

const inputBorderColor = '#4F545C';

const buttonTextColor = '#FFFFFF';
 
type CadastroScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'CadastrarVeiculo'>;
 
export default function CadastroVeiculo() {

  const navigation = useNavigation<CadastroScreenNavigationProp>();

  const [placa, setPlaca] = useState('');

  const [marca, setMarca] = useState('');

  const [modelo, setModelo] = useState('');

  const [cor, setCor] = useState('');

  const [anoFabricacao, setAnoFabricacao] = useState('');

  const [anoModelo, setAnoModelo] = useState('');

  const [chassi, setChassi] = useState('');

  const [tagCode, setTagCode] = useState('TAG01');
 
  const [saving, setSaving] = useState(false);

  const [storing, setStoring] = useState(false);
 
  useLayoutEffect(() => {

    navigation.setOptions({ headerStyle: { backgroundColor: headerScreenColor }, headerTintColor: textColorLight });

  }, [navigation]);
 
  const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i;
 
  function validarCampos(): string | null {

    if (!placa || !marca || !modelo || !cor || !anoFabricacao || !anoModelo || !chassi) return 'Preencha todos os campos.';

    if (!placaRegex.test(placa)) return 'Placa inválida. Formato: AAA-1234 ou ABC1D23.';

    if (!/^\d{4}$/.test(anoFabricacao) || !/^\d{4}$/.test(anoModelo)) return 'Anos devem ter 4 dígitos.';

    return null;

  }
 
  async function salvarLocal(novoVeiculo: any) {

    const veiculosSalvos = await AsyncStorage.getItem('@lista_veiculos');

    const lista = veiculosSalvos ? JSON.parse(veiculosSalvos) : [];

    const idx = lista.findIndex((v: any) => (v?.placa||'').toUpperCase() === novoVeiculo.placa.toUpperCase());

    if (idx >= 0) lista[idx] = novoVeiculo; else lista.push(novoVeiculo);

    await AsyncStorage.setItem('@lista_veiculos', JSON.stringify(lista));

  }
 
  async function syncCreateOrUpdate(novoVeiculo: any) {

    // se já existe no banco → UPDATE; senão → CREATE

    let serverOk = false, action = "create";

    try {

      const exists = await getVehicleByPlate(placa.toUpperCase()).catch(()=>null);

      if (exists?.plate) {

        action = "update";

        await updateVehicle(placa.toUpperCase(), {

          brand: marca, model: modelo, color: cor, year_make: anoFabricacao,

          year_model: anoModelo, vin: chassi, tag_code: tagCode || undefined

        });

      } else {

        await createVehicle(novoVeiculo as any);

      }

      const check = await getVehicleByPlate(placa.toUpperCase()).catch(()=>null);

      serverOk = !!check?.plate;

    } catch {}

    return { serverOk, action };

  }
 
  async function salvarVeiculo() {

    const erro = validarCampos(); if (erro) return Alert.alert('Erro', erro);

    const novoVeiculo = { placa, marca, modelo, cor, anoFabricacao, anoModelo, chassi, tag_code: tagCode || undefined };
 
    try {

      setSaving(true);

      await salvarLocal(novoVeiculo);

      const { serverOk, action } = await syncCreateOrUpdate(novoVeiculo);

      Alert.alert('Sucesso', `Veículo ${action === "update" ? "atualizado" : "criado"}.\nServidor: ${serverOk ? 'OK (gravado no banco)' : 'falhou (salvou só no aparelho)'}`);

      if (serverOk) { setPlaca(''); setMarca(''); setModelo(''); setCor(''); setAnoFabricacao(''); setAnoModelo(''); setChassi(''); }

    } catch {

      Alert.alert('Erro', 'Não foi possível salvar o veículo.');

    } finally { setSaving(false); }

  }
 
  async function salvarEArmazenar() {

    const erro = validarCampos(); if (erro) return Alert.alert('Erro', erro);

    const novoVeiculo = { placa, marca, modelo, cor, anoFabricacao, anoModelo, chassi, tag_code: tagCode || undefined };
 
    try {

      setStoring(true);

      await salvarLocal(novoVeiculo);

      const { serverOk, action } = await syncCreateOrUpdate(novoVeiculo);
 
      const resp = await storeByPlate(placa.toUpperCase());

      const zona = resp?.zone || '-';

      const vaga = resp?.spot || '-';
 
      Alert.alert(

        'Vaga Alocada',

        `Zona: ${zona}\nVaga: ${vaga}\nServidor: ${serverOk ? 'OK (gravado no banco)' : 'falhou (salvou só no aparelho)'}\n\nPara visualizar no mapa, use: Operações por Placa → Buscar.`

      );
 
      setPlaca(''); setMarca(''); setModelo(''); setCor(''); setAnoFabricacao(''); setAnoModelo(''); setChassi('');

    } catch (e:any) {

      Alert.alert('Erro ao Armazenar', e?.message || 'Falha ao alocar vaga.');

    } finally { setStoring(false); }

  }
 
  const handlePlacaRecognized = (txt: string) => {

    if (txt && placaRegex.test(txt)) {

      setPlaca(txt.toUpperCase());

      Alert.alert('Placa Reconhecida', txt.toUpperCase());

    } else {

      Alert.alert('Placa Inválida', txt || '');

    }

  };
 
  return (
<ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
<Text style={styles.label}>Placa</Text>
<TextInput style={styles.input} value={placa} onChangeText={setPlaca} placeholder="AAA-1234 ou ABC1D23" placeholderTextColor={placeholderTextColor} autoCapitalize="characters" />
<Text style={styles.label}>Marca</Text>
<TextInput style={styles.input} value={marca} onChangeText={setMarca} placeholder="Ex: Honda" placeholderTextColor={placeholderTextColor} />
<Text style={styles.label}>Modelo</Text>
<TextInput style={styles.input} value={modelo} onChangeText={setModelo} placeholder="Ex: CG 160 Titan" placeholderTextColor={placeholderTextColor} />
<Text style={styles.label}>Cor</Text>
<TextInput style={styles.input} value={cor} onChangeText={setCor} placeholder="Ex: Vermelha" placeholderTextColor={placeholderTextColor} />
<Text style={styles.label}>Ano Fabricação</Text>
<TextInput style={styles.input} value={anoFabricacao} onChangeText={(t) => setAnoFabricacao(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" maxLength={4} placeholder="Ex: 2023" placeholderTextColor={placeholderTextColor} />
<Text style={styles.label}>Ano Modelo</Text>
<TextInput style={styles.input} value={anoModelo} onChangeText={(t) => setAnoModelo(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" maxLength={4} placeholder="Ex: 2024" placeholderTextColor={placeholderTextColor} />
<Text style={styles.label}>Chassi</Text>
<TextInput style={styles.input} value={chassi} onChangeText={setChassi} placeholder="Número do chassi" placeholderTextColor={placeholderTextColor} autoCapitalize="characters" />
<Text style={styles.label}>TAG BLE vinculada</Text>
<TextInput style={styles.input} value={tagCode} onChangeText={setTagCode} placeholder="Ex: TAG01" placeholderTextColor={placeholderTextColor} autoCapitalize="characters" />
 
      <View style={styles.placaRecognitionContainer}><PlacaRecognition onPlacaRecognized={handlePlacaRecognized} /></View>
 
      <View style={{flexDirection:'row', gap:10}}>
<TouchableOpacity style={[styles.button,{flex:1}]} onPress={salvarVeiculo} disabled={saving||storing}>

          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Salvar</Text>}
</TouchableOpacity>
<TouchableOpacity style={[styles.buttonOutline,{flex:1}]} onPress={() => navigation.navigate('ListarVeiculos')} disabled={saving||storing}>
<Text style={styles.buttonOutlineText}>Listagem</Text>
</TouchableOpacity>
</View>
 
      <TouchableOpacity style={styles.buttonPrimary} onPress={salvarEArmazenar} disabled={saving||storing}>

        {storing ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonPrimaryText}>Salvar & Armazenar</Text>}
</TouchableOpacity>
</ScrollView>

  );

}
 
const styles = StyleSheet.create({

  container: { flexGrow: 1, padding: 20, backgroundColor: screenDarkBackground },

  label: { fontSize: 16, fontWeight: 'bold', color: textColorLight, marginBottom: 8, marginTop: 10 },

  input: { backgroundColor: inputBackgroundColor, color: textColorLight, borderWidth: 1, borderColor: inputBorderColor, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 15 : 10, marginBottom: 12, borderRadius: 8, fontSize: 16 },

  placaRecognitionContainer: { marginVertical: 16, alignItems: 'center' },

  button: { backgroundColor: radarMotuGreen, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },

  buttonText: { color: buttonTextColor, fontSize: 16, fontWeight: 'bold' },

  buttonOutline: { backgroundColor: 'transparent', borderColor: radarMotuGreen, borderWidth: 2, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },

  buttonOutlineText: { color: radarMotuGreen, fontSize: 16, fontWeight: 'bold' },

  buttonPrimary: { marginTop: 14, backgroundColor: '#00D084', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },

  buttonPrimaryText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

});

 