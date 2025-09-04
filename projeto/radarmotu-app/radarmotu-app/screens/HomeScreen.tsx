import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../App';


const radarMotuGreen = '#22DD44';
const screenDarkBackground = '#1A1D21';
const headerFooterScreenColor = '#202328';
const textColorLight = '#FFFFFF';
const buttonTextColor = '#FFFFFF';
const footerTextColor = '#999999';


type HomeScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Home'>;
export default function HomeScreen() {
const navigation = useNavigation<HomeScreenNavigationProp>();
const currentYear = new Date().getFullYear();


useLayoutEffect(() => {
navigation.setOptions({ headerStyle: { backgroundColor: headerFooterScreenColor }, headerTintColor: textColorLight });
}, [navigation]);


return (
<SafeAreaView style={styles.safeArea}>
<View style={styles.mainContent}>
<Text style={styles.title}>Bem-vindo ao Radar Motu!</Text>
<Text style={styles.subtitle}>Sua frota sob controle, seu pátio na palma da mão.</Text>
<TouchableOpacity style={styles.styledButton} onPress={() => navigation.navigate('OperacoesPorPlaca')}>
<Text style={styles.buttonText}>Operações por Placa (OCR)</Text>
</TouchableOpacity>
<TouchableOpacity style={styles.styledButton} onPress={() => navigation.navigate('ListarVeiculos')}>
<Text style={styles.buttonText}>Ver Veículos Cadastrados</Text>
</TouchableOpacity>
</View>
<View style={styles.screenFooter}>
<Text style={styles.screenFooterText}>Radar Motu App</Text>
<Text style={styles.screenFooterText}>© {currentYear} - Metamind Solution</Text>
</View>
</SafeAreaView>
);
}


const styles = StyleSheet.create({
safeArea: { flex: 1, backgroundColor: screenDarkBackground },
mainContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
title: { fontSize: 26, fontWeight: 'bold', color: textColorLight, marginBottom: 10, textAlign: 'center' },
subtitle: { fontSize: 16, color: '#B0B0B0', marginBottom: 40, textAlign: 'center', paddingHorizontal: 20 },
styledButton: { backgroundColor: radarMotuGreen, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 8, marginVertical: 10, width: '90%', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
buttonText: { color: buttonTextColor, fontSize: 16, fontWeight: 'bold' },
screenFooter: { paddingVertical: 15, paddingHorizontal: 20, backgroundColor: headerFooterScreenColor, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#303338' },
screenFooterText: { fontSize: 12, color: footerTextColor, textAlign: 'center', marginVertical: 2 },
});