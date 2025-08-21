import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const deviceTheme = useColorScheme();
  const [isDarkTheme, setIsDarkTheme] = useState(deviceTheme === 'dark');
  useEffect(() => {
    loadSavedTheme();
  }, []);
  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        setIsDarkTheme(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Ошибка при загрузке темы:', error);
    }
  };
  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkTheme;
      setIsDarkTheme(newTheme);
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Ошибка при сохранении темы:', error);
    }
  };
  const colors = {
    primary: '#007AFF',
    background: isDarkTheme ? '#000000' : '#FFFFFF',
    card: isDarkTheme ? '#1C1C1E' : '#F2F2F7',
    text: isDarkTheme ? '#FFFFFF' : '#000000',
    border: isDarkTheme ? '#38383A' : '#C6C6C8',
    error: '#FF3B30',
  };
  return (
    <ThemeContext.Provider value={{ isDarkTheme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext); 