import React, { useState, useLayoutEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../App';

const radarMotuGreen = '#22DD44';
const screenDarkBackground = '#1A1D21';
const headerScreenColor = '#202328';
const textColorLight = '#FFFFFF';
const itemBackgroundColor = '#2C2F33';
const itemTextColor = '#E0E0E0';
const itemTitleColor = '#FFFFFF';
const buttonTextColor = '#FFFFFF';

interface Veiculo {
  placa: string; marca: string; modelo: string; cor: string;
  anoFabricacao: string; anoModelo: string; chassi: string;
}

type ListagemScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'ListarVeiculos'>;
export default function Listagem() {
  const navigation = useNavigation<ListagemScreenNavigationProp>();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerStyle: { backgroundColor: headerScreenColor }, headerTintColor: textColorLight });
  }, [navigation]);

  useFocusEffect(React.useCallback(() => { carregarVeiculos(); }, []));

  async function carregarVeiculos() {
    setIsLoading(true);
    try {
      const listaVeiculosJson = await AsyncStorage.getItem('@lista_veiculos');
      const listaVeiculos = listaVeiculosJson ? JSON.parse(listaVeiculosJson) : [];
      setVeiculos(listaVeiculos);
    } catch (error) {
      console.error('Erro ao carregar os veículos:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const renderItem = ({ item }: { item: Veiculo }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemTitle}>{item.placa} - {item.modelo}</Text>
      <Text style={styles.itemText}>Marca: {item.marca}</Text>
      <Text style={styles.itemText}>Cor: {item.cor}</Text>
      <Text style={styles.itemText}>Ano: {item.anoFabricacao}/{item.anoModelo}</Text>
      <Text style={styles.itemText}>Chassi: {item.chassi}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={radarMotuGreen} />
        <Text style={styles.loadingText}>Carregando Veículos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Veículos Cadastrados</Text>
      <FlatList
        data={veiculos}
        keyExtractor={(item, index) => item.placa + index}
        renderItem={renderItem}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <View style={styles.emptyListComponent}>
            <Text style={styles.emptyListText}>Nenhum veículo cadastrado ainda.</Text>
            <Text style={styles.emptyListSubText}>Vá para a tela de cadastro para adicionar.</Text>
          </View>
        }
      />
      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => navigation.navigate('CadastrarVeiculo')}>
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Cadastrar Novo Veículo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 15, paddingTop: 20, paddingBottom: 10, backgroundColor: screenDarkBackground },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: textColorLight },
  heading: { fontSize: 24, fontWeight: 'bold', color: textColorLight, marginBottom: 20, textAlign: 'center' },
  listContentContainer: { paddingBottom: 10 },
  itemContainer: { backgroundColor: itemBackgroundColor, padding: 18, borderRadius: 10, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  itemTitle: { fontSize: 18, fontWeight: 'bold', color: itemTitleColor, marginBottom: 8 },
  itemText: { fontSize: 15, color: itemTextColor, lineHeight: 22, marginBottom: 3 },
  emptyListComponent: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyListText: { fontSize: 18, color: textColorLight, marginBottom: 10 },
  emptyListSubText: { fontSize: 14, color: itemTextColor },
  button: { backgroundColor: radarMotuGreen, paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 15, marginBottom: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: radarMotuGreen, borderWidth: 2 },
  secondaryButtonText: { color: radarMotuGreen },
});
