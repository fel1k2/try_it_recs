import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import api from '../config/api';
import { useTheme } from '../context/ThemeContext';

const SelectFriendScreen = ({ navigation }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const fetchFriends = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      const response = await api.get('/get-friends', {
        params: { token }
      });
      setFriends(response.data.friends);
    } catch (err) {
      console.error('Ошибка при загрузке списка друзей:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить список друзей');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchFriends();
  }, []);
  const handleFriendSelect = (friendId, friendName) => {
    console.log('SelectFriendScreen - Selected friend:', { id: friendId, name: friendName });
    console.log('SelectFriendScreen - Navigation params:', { friendId, friendName });
    navigation.navigate('Recommendations', { friendId, friendName });
  };
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {friends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            У вас пока нет друзей
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.friendItem, { backgroundColor: colors.card }]}
              onPress={() => handleFriendSelect(item[0], item[1])}
            >
              <Text style={[styles.friendName, { color: colors.text }]}>
                {item[1]}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item[0]}
          contentContainerStyle={styles.list}
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
    padding: 16,
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
  friendItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SelectFriendScreen; 