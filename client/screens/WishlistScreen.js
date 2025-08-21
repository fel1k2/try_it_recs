import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native';
import GameCard from '../components/GameCard';
import api from '../config/api';
import { useTheme } from '../context/ThemeContext';

const WishlistScreen = ({ navigation }) => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const fetchWishlist = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      const response = await api.get('/get-wishlist', {
        params: { token }
      });
      setWishlist(response.data.wishlist);
    } catch (err) {
      console.error('Ошибка при загрузке списка желаемого:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить список желаемого');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useFocusEffect(
    useCallback(() => {
      fetchWishlist();
    }, [])
  );
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWishlist();
  }, []);
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {wishlist.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Список желаемого пуст
          </Text>
        </View>
      ) : (
        <FlatList
          data={wishlist}
          renderItem={({ item }) => (
            <GameCard
              game={item}
              onPress={(gameId) => navigation.navigate('GameDetails', { gameId, source: 'wishlist' })}
            />
          )}
          keyExtractor={(item) => item.GameID}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
              title="Обновление..."
              titleColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default WishlistScreen; 