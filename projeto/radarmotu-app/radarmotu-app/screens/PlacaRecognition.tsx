import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const radarMotuGreen = '#22DD44';
const textColorLight = '#FFFFFF';
const screenDarkBackground = '#1A1D21';
const labelColor = '#A0A0A0';
const inputBorderColor = '#4F545C';

interface PlacaRecognitionProps { onPlacaRecognized: (placa: string) => void; }

export default function PlacaRecognition({ onPlacaRecognized }: PlacaRecognitionProps) {
  const [imagemPlaca, setImagemPlaca] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPickingImage, setIsPickingImage] = useState<boolean>(false);

  const apiUrl = 'http://191.238.222.198:3000/upload'; // sua API OCR

  const selectImage = async (useCamera: boolean) => {
    setIsPickingImage(true);
    let result: ImagePicker.ImagePickerResult | undefined;
    const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 } as const;
    try {
      if (useCamera) {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraPermission.status !== 'granted') { Alert.alert('Permissão Necessária', 'Acesso à câmera é necessário.'); setIsPickingImage(false); return; }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (mediaLibraryPermission.status !== 'granted') { Alert.alert('Permissão Necessária', 'Acesso à galeria é necessário.'); setIsPickingImage(false); return; }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImagemPlaca(asset.uri);
        const fileName = asset.fileName || asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;
        recognizeTextFromImage(asset.uri, fileName);
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    } finally { setIsPickingImage(false); }
  };

  const handleChooseImageSource = () => {
    Alert.alert('Escanear Placa', 'Escolha a origem da imagem:', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tirar Foto...', onPress: () => selectImage(true) },
      { text: 'Escolher da Galeria...', onPress: () => selectImage(false) }
    ]);
  };

  const recognizeTextFromImage = async (imageUri: string, fileName: string) => {
    setIsLoading(true);
    const formData = new FormData();
    let fileType = fileName.includes('.') ? `image/${fileName.split('.').pop()}` : 'image/jpeg';
    if (fileType === 'image/jpg') fileType = 'image/jpeg';
    formData.append('image', { uri: imageUri, name: fileName, type: fileType } as any);
    try {
      const apiResponse = await fetch(apiUrl, { method: 'POST', body: formData });
      if (!apiResponse.ok) {
        let errorMsg = `Erro do servidor: ${apiResponse.status}`;
        try { const errorData = await apiResponse.json(); errorMsg = errorData.error || errorData.message || errorMsg; }
        catch { const textError = await apiResponse.text(); errorMsg = textError || errorMsg; }
        throw new Error(errorMsg);
      }
      const responseData = await apiResponse.json();
      if (responseData.placa) onPlacaRecognized(responseData.placa);
      else onPlacaRecognized(responseData.message || responseData.mensagem || 'Placa não reconhecida');
    } catch (error: any) {
      console.error('Erro na API de OCR:', error);
      Alert.alert('Erro de OCR', error.message || 'Não foi possível processar a imagem.');
      onPlacaRecognized('Erro ao processar imagem');
    } finally { setIsLoading(false); }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleChooseImageSource} style={styles.styledButton} disabled={isPickingImage || isLoading}>
        {isPickingImage ? (<ActivityIndicator color={textColorLight} />) : (<Text style={styles.buttonText}>Escanear Placa</Text>)}
      </TouchableOpacity>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={radarMotuGreen} />
          <Text style={styles.loadingText}>Reconhecendo Placa...</Text>
        </View>
      )}

      {imagemPlaca && !isLoading && (
        <View style={styles.imagePreviewContainer}>
          <Text style={styles.previewLabel}>Imagem da Placa:</Text>
          <Image source={{ uri: imagemPlaca }} style={styles.image} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%', paddingVertical: 10 },
  styledButton: { backgroundColor: radarMotuGreen, paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, minWidth: '70%', alignItems: 'center', justifyContent: 'center', height: 48 },
  buttonText: { color: textColorLight, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  loadingText: { marginTop: 10, fontSize: 16, color: textColorLight },
  imagePreviewContainer: { alignItems: 'center', marginTop: 20, marginBottom: 10 },
  previewLabel: { fontSize: 14, color: labelColor, marginBottom: 8 },
  image: { width: 280, height: 180, resizeMode: 'contain', borderWidth: 1, borderColor: inputBorderColor, borderRadius: 8 },
});
