// App.tsx

import "react-native-gesture-handler";

import React from "react";

import { View, Image, Text, StyleSheet } from "react-native";

import { NavigationContainer, DefaultTheme } from "@react-navigation/native";

import {

  createDrawerNavigator,

  DrawerContentScrollView,

  DrawerItemList,

  DrawerNavigationOptions,

} from "@react-navigation/drawer";
 
// --- Telas ---

import HomeScreen from "./screens/HomeScreen";

import Cadastro from "./screens/Cadastro";

import Listagem from "./screens/Listagem";

import MapaScreen from "./screens/MapaScreen";

import SobreNosScreen from "./screens/SobreNosScreen";

import OperacoesPorPlaca from "./screens/OperacoesPorPlaca";

import RadarProximidade from "./screens/RadarProximidade";
 
// --- Tema de cores ---

const radarMotuGreen = "#22DD44";

const darkBackground = "#1A1D21";

const textColorLight = "#FFFFFF";

const inactiveColor = "#A0A0A0";

const metamindTextColor = "#B0B0B0";
 
// --- Tipagem das rotas do Drawer ---

export type DrawerParamList = {

  Home: undefined;

  OperacoesPorPlaca: undefined;

  CadastrarVeiculo: undefined;

  ListarVeiculos: undefined;

  MapaDoPatio: { plate?: string } | undefined;

  RadarProximidade: { plate?: string; tag?: string } | undefined;

  Sobre: undefined;

};
 
const Drawer = createDrawerNavigator<DrawerParamList>();
 
// --- Cabeçalho do Drawer ---

function CustomDrawerHeader() {

  return (
<View style={styles.drawerHeader}>
<Image

        source={require("./assets/radarmotu-logo.png")}

        style={styles.drawerLogo}

      />
</View>

  );

}
 
// --- Conteúdo customizado do Drawer ---

function CustomDrawerContent(props: any) {

  const currentYear = new Date().getFullYear();

  return (
<View style={{ flex: 1, backgroundColor: darkBackground }}>
<DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
<CustomDrawerHeader />
<DrawerItemList {...props} />
</DrawerContentScrollView>
 
      <View style={styles.drawerFooter}>
<Image

          source={require("./assets/metamind-logo.png")}

          style={styles.drawerFooterLogo}

        />
<Text style={styles.drawerFooterText}>METAMIND SOLUTION</Text>
<Text style={styles.drawerFooterRightsText}>

          © {currentYear} Todos os direitos reservados.
</Text>
</View>
</View>

  );

}
 
// --- Opções globais das telas ---

const globalScreenOptions: DrawerNavigationOptions = {

  headerStyle: { backgroundColor: darkBackground },

  headerTintColor: textColorLight,

  headerTitleStyle: { fontWeight: "bold" },

  drawerStyle: { backgroundColor: darkBackground, width: 280 },

  drawerActiveTintColor: radarMotuGreen,

  drawerInactiveTintColor: inactiveColor,

  drawerActiveBackgroundColor: "rgba(34,221,68,0.1)",

  drawerLabelStyle: { fontWeight: "bold", fontSize: 15, marginLeft: -5 },

  drawerItemStyle: { marginVertical: 5 },

};
 
export default function App() {

  return (
<NavigationContainer

      theme={{

        ...DefaultTheme,

        colors: {

          ...DefaultTheme.colors,

          background: darkBackground,

          card: darkBackground,

          text: textColorLight,

          primary: radarMotuGreen,

        },

      }}
>
<Drawer.Navigator

        initialRouteName="Home"

        drawerContent={(props) => <CustomDrawerContent {...props} />}

        screenOptions={globalScreenOptions}
>
<Drawer.Screen

          name="Home"

          component={HomeScreen}

          options={{ title: "Início" }}

        />
<Drawer.Screen

          name="OperacoesPorPlaca"

          component={OperacoesPorPlaca}

          options={{ title: "Operações por Placa (OCR)" }}

        />
<Drawer.Screen

          name="CadastrarVeiculo"

          component={Cadastro}

          options={{ title: "Cadastrar Veículo" }}

        />
<Drawer.Screen

          name="ListarVeiculos"

          component={Listagem}

          options={{ title: "Veículos Cadastrados" }}

        />
<Drawer.Screen

          name="MapaDoPatio"

          component={MapaScreen}

          options={{ title: "Mapa do Pátio" }}

        />
<Drawer.Screen

          name="RadarProximidade"

          component={RadarProximidade}

          options={{ title: "Radar de Proximidade" }}

        />
<Drawer.Screen

          name="Sobre"

          component={SobreNosScreen}

          options={{ title: "Sobre Nós" }}

        />
</Drawer.Navigator>
</NavigationContainer>

  );

}
 
const styles = StyleSheet.create({

  drawerHeader: {

    backgroundColor: darkBackground,

    paddingVertical: 25,

    paddingHorizontal: 20,

    alignItems: "center",

  },

  drawerLogo: {

    width: 120,

    height: 60,

    resizeMode: "contain",

  },

  drawerFooter: {

    paddingVertical: 15,

    paddingHorizontal: 20,

    alignItems: "center",

    borderTopWidth: 1,

    borderTopColor: "#333333",

    backgroundColor: darkBackground,

  },

  drawerFooterLogo: {

    width: 100,

    height: 30,

    resizeMode: "contain",

    marginBottom: 8,

  },

  drawerFooterText: {

    color: metamindTextColor,

    fontSize: 13,

    fontWeight: "bold",

    textAlign: "center",

  },

  drawerFooterRightsText: {

    color: "#777",

    fontSize: 10,

    textAlign: "center",

    marginTop: 4,

  },

});

 