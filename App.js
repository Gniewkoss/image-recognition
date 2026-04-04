import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORAGE = '@openai_api_key';
const SERVER_URL = 'http://localhost:5001';

export default function App() {
  const [image, setImage] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const savedKey = await AsyncStorage.getItem(API_KEY_STORAGE);
      if (savedKey) {
        setApiKey(savedKey);
      }
    } catch (e) {
      console.error('Failed to load API key:', e);
    }
  };

  const saveApiKey = async () => {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE, tempApiKey);
      setApiKey(tempApiKey);
      setShowApiKeyModal(false);
      Alert.alert('Success', 'API key saved successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to save API key');
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload images.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setResult('');
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow camera access to take photos.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setResult('');
    }
  };

  const analyzeImage = async () => {
    if (!apiKey) {
      setTempApiKey('');
      setShowApiKeyModal(true);
      return;
    }

    if (!image) {
      Alert.alert('No Image', 'Please select or take a photo first.');
      return;
    }

    setAnalyzing(true);
    setResult('');

    try {
      const base64 = await FileSystem.readAsStringAsync(image, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(`${SERVER_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          image_base64: base64,
        }),
      });

      const data = await response.json();

      if (data.error) {
        Alert.alert('Error', data.error);
      } else {
        setResult(data.result);
      }
    } catch (e) {
      Alert.alert(
        'Connection Error', 
        'Could not connect to the server. Make sure the Python backend is running.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImage(null);
    setResult('');
  };

  const openApiKeySettings = () => {
    setTempApiKey(apiKey);
    setShowApiKeyModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Image Recognition</Text>
        <TouchableOpacity onPress={openApiKeySettings} style={styles.settingsButton}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.subtitle}>
        {apiKey ? 'API key configured ✓' : 'Tap ⚙️ to add API key'}
      </Text>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Text style={styles.buttonText}>📁 Upload</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Text style={styles.buttonText}>📷 Camera</Text>
          </TouchableOpacity>
        </View>

        {image && (
          <TouchableOpacity 
            style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]} 
            onPress={analyzeImage}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.analyzeButtonText}>🔍 What's in this photo?</Text>
            )}
          </TouchableOpacity>
        )}

        {result ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Analysis Result:</Text>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}

        {image && !analyzing && (
          <TouchableOpacity style={styles.clearButton} onPress={clearImage}>
            <Text style={styles.clearButtonText}>Clear Image</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={showApiKeyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowApiKeyModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>OpenAI API Key</Text>
            <Text style={styles.modalSubtitle}>
              Enter your OpenAI API key to analyze images. Your key is stored locally on your device.
            </Text>
            
            <TextInput
              style={styles.apiKeyInput}
              placeholder="sk-..."
              value={tempApiKey}
              onChangeText={setTempApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowApiKeyModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalSaveButton, !tempApiKey && styles.modalSaveButtonDisabled]}
                onPress={saveApiKey}
                disabled={!tempApiKey}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    position: 'relative',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    position: 'absolute',
    right: 20,
    top: 60,
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#a8e6b8',
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  clearButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#b0d4ff',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
