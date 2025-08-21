import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { checkAuth } from './config/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import BlacklistScreen from './screens/BlacklistScreen';
import GameDetailsScreen from './screens/GameDetailsScreen';
import LoginScreen from './screens/LoginScreen';
import RecommendationsScreen from './screens/RecommendationsScreen';
import RegisterScreen from './screens/RegisterScreen';
import SelectFriendScreen from './screens/SelectFriendScreen';
import WishlistScreen from './screens/WishlistScreen';

const Stack = createNativeStackNavigator();

function AppContent() {
  const [isLoading, setIsLoading] = React.useState(true);
  const { isAuthenticated, setIsAuthenticated } = useAuth();
  const { isDarkTheme, toggleTheme, colors } = useTheme();
  React.useEffect(() => {
    checkInitialAuth();
  }, []);
  const checkInitialAuth = async () => {
    try {
      const isAuth = await checkAuth();
      setIsAuthenticated(isAuth);
    } catch (error) {
      console.error('Ошибка при проверке авторизации:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: isDarkTheme ? colors.card : '#ffffff',
          },
          headerTintColor: isDarkTheme ? '#ffffff' : colors.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen 
              name="Recommendations" 
              component={RecommendationsScreen}
              options={{ 
                title: 'Рекомендации',
                headerRight: () => (
                  <TouchableOpacity
                    onPress={toggleTheme}
                    style={{ marginRight: 15 }}
                  >
                    <Text style={{ color: isDarkTheme ? '#ffffff' : colors.text, fontSize: 20 }}>
                      {isDarkTheme ? '☀️' : '🌙'}
                    </Text>
                  </TouchableOpacity>
                ),
              }}
            />
            <Stack.Screen 
              name="GameDetails" 
              component={(props) => <GameDetailsScreen {...props} />}
              options={{
                title: 'Информация об игре',
              }}
            />
            <Stack.Screen 
              name="Wishlist" 
              component={(props) => <WishlistScreen {...props} />}
              options={{
                title: 'Список желаемого',
              }}
            />
            <Stack.Screen 
              name="Blacklist" 
              component={(props) => <BlacklistScreen {...props} />}
              options={{
                title: 'Черный список',
              }}
            />
            <Stack.Screen 
              name="SelectFriend" 
              component={SelectFriendScreen}
              options={{ 
                title: 'Выбор друга',
                headerShown: true 
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen 
              name="Login" 
              component={(props) => <LoginScreen {...props} />}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Register" 
              component={(props) => <RegisterScreen {...props} />}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <BottomSheetModalProvider>
            <AppContent />
          </BottomSheetModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
} 