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
import { loginUser } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const { setIsAuthenticated } = useAuth();
  const { colors, isDarkTheme } = useTheme();
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const handleLogin = async () => {
    setLoginError('');
    if (!email || !password) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный email');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль не может содержать менее 6 символов');
      return;
    }
    try {
      setIsLoading(true);
      await loginUser(email, password);
      setIsAuthenticated(true);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Вход</Text>
      
      <TextInput
        style={[styles.input, { 
          backgroundColor: colors.card, 
          color: isDarkTheme ? '#FFFFFF' : '#000000',
          borderColor: colors.border
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
          color: isDarkTheme ? '#FFFFFF' : '#000000',
          borderColor: colors.border
        }]}
        placeholder="Пароль"
        placeholderTextColor={colors.text + '80'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />

      {loginError ? (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {loginError}
        </Text>
      ) : null}

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled, { backgroundColor: colors.primary }]} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Войти</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.linkButton}
        onPress={() => navigation.navigate('Register')}
        disabled={isLoading}
      >
        <Text style={[styles.linkText, { color: colors.primary }]}>Нет аккаунта? Зарегистрироваться</Text>
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
    marginBottom: 30,
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
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default LoginScreen; 