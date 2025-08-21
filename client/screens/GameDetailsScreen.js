import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import api from '../config/api';
import { useTheme } from '../context/ThemeContext';

const GameDetailsScreen = ({ route, navigation }) => {
  const { gameId, source } = route.params;
  const [gameInfo, setGameInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  useEffect(() => {
    fetchGameInfo();
  }, []);
  const fetchGameInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      const response = await api.get('/get-game-info', {
        params: { token, game_id: gameId }
      });
      setGameInfo(response.data);
      navigation.setOptions({ title: response.data.game_title });
    } catch (err) {
      console.error('Ошибка при загрузке информации об игре:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить информацию об игре');
    } finally {
      setLoading(false);
    }
  };
  const handleRemoveFromList = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      const endpoint = source === 'wishlist' ? '/remove-from-wishlist' : '/remove-from-blacklist';
      await api.post(endpoint, null, {
        params: { token, game_id: gameId }
      });
      Alert.alert('Успех', 'Игра удалена из списка', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);
    } catch (err) {
      console.error('Ошибка при удалении игры из списка:', err);
      Alert.alert('Ошибка', 'Не удалось удалить игру из списка');
    }
  };
  const handleAddToWishlist = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      await api.post('/add-to-wishlist', null, {
        params: { token, game_id: gameId }
      });
      Alert.alert('Успех', 'Игра добавлена в список желаемого');
    } catch (err) {
      console.error('Ошибка при добавлении в список желаемого:', err);
      Alert.alert('Ошибка', 'Не удалось добавить игру в список желаемого');
    }
  };
  const handleAddToBlacklist = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      await api.post('/add-to-blacklist', null, {
        params: { token, game_id: gameId }
      });
      Alert.alert('Успех', 'Игра добавлена в черный список');
    } catch (err) {
      console.error('Ошибка при добавлении в черный список:', err);
      Alert.alert('Ошибка', 'Не удалось добавить игру в черный список');
    }
  };
  const openSteamStore = async () => {
    const steamUrl = `https://store.steampowered.com/app/${gameId}`;
    const steamAppUrl = `steam://store/${gameId}`;
    try {
      const canOpenSteamApp = await Linking.canOpenURL(steamAppUrl);
      if (canOpenSteamApp) {
        await Linking.openURL(steamAppUrl);
        return;
      }
      const canOpenBrowser = await Linking.canOpenURL(steamUrl);
      if (canOpenBrowser) {
        await Linking.openURL(steamUrl);
      } else {
        Alert.alert('Ошибка', 'Не удалось открыть ссылку на Steam');
      }
    } catch (err) {
      console.error('Ошибка при открытии ссылки:', err);
      Alert.alert('Ошибка', 'Не удалось открыть ссылку на Steam');
    }
  };
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!gameInfo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          Не удалось загрузить информацию об игре
        </Text>
      </View>
    );
  }
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={{ uri: gameInfo.image_url }}
        style={styles.image}
        resizeMode="cover"
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{gameInfo.game_title}</Text>
          <View style={[styles.ratingContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.rating, { color: colors.text }]}>
              {gameInfo.rating}% положительных отзывов
            </Text>
          </View>
        </View>

        {gameInfo.description && (
          <Text style={[styles.description, { color: colors.text }]}>
            {gameInfo.description}
          </Text>
        )}

        <View style={styles.actionButtonsContainer}>
          {source === 'wishlist' || source === 'blacklist' ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error }]}
              onPress={handleRemoveFromList}
            >
              <Text style={styles.buttonText}>
                {source === 'wishlist' ? 'Удалить из списка желаемого' : 'Удалить из черного списка'}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleAddToWishlist}
              >
                <Text style={styles.buttonText}>Добавить в список желаемого</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                onPress={handleAddToBlacklist}
              >
                <Text style={styles.buttonText}>Добавить в черный список</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#171a21' }]}
            onPress={openSteamStore}
          >
            <Text style={styles.buttonText}>Открыть в Steam</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Жанры</Text>
          <View style={styles.tagsContainer}>
            {gameInfo.genres.map((genre, index) => (
              <View
                key={index}
                style={[styles.tag, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.tagText, { color: colors.text }]}>{genre}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Особенности</Text>
          <View style={styles.tagsContainer}>
            {gameInfo.features.map((feature, index) => (
              <View
                key={index}
                style={[styles.tag, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.tagText, { color: colors.text }]}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Теги</Text>
          <View style={styles.tagsContainer}>
            {gameInfo.tags.map((tag, index) => (
              <View
                key={index}
                style={[styles.tag, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    width: Dimensions.get('window').width,
    height: 200,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  ratingContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  rating: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 14,
  },
  removeButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  actionButtonsContainer: {
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
});

export default GameDetailsScreen; 