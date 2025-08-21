import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { registerUser } from '../config/api';
import { useTheme } from '../context/ThemeContext';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [steamId, setSteamId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { colors, isDarkTheme } = useTheme();
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const validateSteamId = (steamId) => {
    return /^\d{17}$/.test(steamId);
  };
  const handleRegister = async () => {
    if (!email || !steamId || !password || !confirmPassword) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный email');
      return;
    }
    if (!validateSteamId(steamId)) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный SteamID64');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    try {
      setIsLoading(true);
      await registerUser(email, password, steamId);
      Alert.alert(
        'Успех',
        'Регистрация успешно завершена',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Регистрация</Text>
      
      <View style={[styles.infoContainer, { backgroundColor: colors.card }]}>
        <Text style={[styles.infoText, { color: colors.text }]}>
          ⓘ Для корректной работы приложения необходимо, чтобы ваш Steam аккаунт был публичным.
        </Text>
      </View>

      <TextInput
        style={[styles.input, { 
          backgroundColor: colors.card,
          borderColor: colors.border,
          color: isDarkTheme ? '#FFFFFF' : '#000000'
        }]}
        placeholder="Email"
        placeholderTextColor={colors.text + '80'}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
      />

      <TextInput
        style={[styles.input, { 
          backgroundColor: colors.card,
          borderColor: colors.border,
          color: isDarkTheme ? '#FFFFFF' : '#000000'
        }]}
        placeholder="SteamID64"
        placeholderTextColor={colors.text + '80'}
        value={steamId}
        onChangeText={setSteamId}
        keyboardType="numeric"
        editable={!isLoading}
      />

      <TextInput
        style={[styles.input, { 
          backgroundColor: colors.card,
          borderColor: colors.border,
          color: isDarkTheme ? '#FFFFFF' : '#000000'
        }]}
        placeholder="Пароль"
        placeholderTextColor={colors.text + '80'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />

      <TextInput
        style={[styles.input, { 
          backgroundColor: colors.card,
          borderColor: colors.border,
          color: isDarkTheme ? '#FFFFFF' : '#000000'
        }]}
        placeholder="Подтвердите пароль"
        placeholderTextColor={colors.text + '80'}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!isLoading}
      />

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.primary }, isLoading && styles.buttonDisabled]} 
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Зарегистрироваться</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.linkButton}
        onPress={() => navigation.navigate('Login')}
        disabled={isLoading}
      >
        <Text style={[styles.linkText, { color: colors.primary }]}>Уже есть аккаунт? Войти</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoContainer: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 16,
  },
});

export default RegisterScreen; 