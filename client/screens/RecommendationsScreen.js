import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { DrawerLayout } from 'react-native-gesture-handler';
import GameCard from '../components/GameCard';
import api, { logout } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const RecommendationsScreen = ({ navigation, route }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    genres: [],
    features: []
  });
  const [availableFilters, setAvailableFilters] = useState({
    genres: [],
    features: []
  });
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const drawerRef = React.useRef(null);
  const { colors, isDarkTheme } = useTheme();
  const { setIsAuthenticated } = useAuth();
  const fetchData = async () => {
    try {
      setError(null);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      console.log('RecommendationsScreen - Current selectedFriend:', selectedFriend);
      let url = `/recommend?token=${token}`;
      if (selectedFriend?.id) {
        url += `&friend_steam_id=${selectedFriend.id}`;
      }
      console.log('RecommendationsScreen - Request URL:', url);
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      const response = await api.get(url, config);
      console.log('RecommendationsScreen - Response:', response.data);
      setRecommendations(response.data.recommendations);
    } catch (err) {
      console.error('RecommendationsScreen - Error:', err);
      if (err.message === 'Требуется авторизация' || err.response?.status === 401) {
        Alert.alert(
          'Ошибка авторизации',
          'Требуется повторный вход',
          [
            {
              text: 'OK',
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            }
          ]
        );
        return;
      }
      setError(`Ошибка при загрузке рекомендаций: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    if (route.params?.friendId && route.params?.friendName) {
      console.log('RecommendationsScreen - Received params:', route.params);
      const newSelectedFriend = {
        id: route.params.friendId,
        name: route.params.friendName
      };
      setSelectedFriend(newSelectedFriend);
      navigation.setParams({ friendId: undefined, friendName: undefined });
    }
  }, [route.params]);
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    fetchData();
  }, [selectedFriend, isInitialLoad]);
  const fetchFilters = async () => {
    try {
      setLoadingFilters(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      const response = await api.get('/get-genres-tags-features', {
        params: { token }
      });
      if (response.data && response.data[0]) {
        setAvailableFilters({
          genres: response.data[0].genres || [],
          features: response.data[0].features || []
        });
      }
    } catch (err) {
      console.error('Ошибка при загрузке фильтров:', err);
      Alert.alert('Ошибка', 'Не удалось загрузить фильтры');
    } finally {
      setLoadingFilters(false);
    }
  };
  const toggleFilter = (type, value) => {
    setFilters(prev => {
      const currentFilters = prev[type];
      const newFilters = currentFilters.includes(value)
        ? currentFilters.filter(item => item !== value)
        : [...currentFilters, value];
      return {
        ...prev,
        [type]: newFilters
      };
    });
  };
  const applyFilters = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('Требуется авторизация');
      }
      let url = `/recommend?token=${token}`;
      filters.genres.forEach(genre => {
        url += `&genres=${encodeURIComponent(genre)}`;
      });
      filters.features.forEach(feature => {
        url += `&categories=${encodeURIComponent(feature)}`;
      });
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      const response = await api.get(url, config);
      setRecommendations(response.data.recommendations);
      setIsFilterModalVisible(false);
    } catch (err) {
      console.error('Ошибка при применении фильтров:', err);
      Alert.alert('Ошибка', 'Не удалось применить фильтры');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (isFilterModalVisible) {
      fetchFilters();
    }
  }, [isFilterModalVisible]);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [selectedFriend]);
  const handleLogout = async () => {
    try {
      await logout();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Ошибка при выходе:', error);
      Alert.alert('Ошибка', 'Не удалось выйти из аккаунта');
    }
  };
  const renderDrawerContent = () => {
    return (
      <View style={[styles.drawerContent, { backgroundColor: colors.background }]}>
        <View style={[styles.drawerHeader, { backgroundColor: colors.card }]}>
          <Text style={[styles.drawerHeaderText, { color: colors.text }]}>Меню</Text>
        </View>
        <View style={styles.drawerItems}>
          <TouchableOpacity 
            style={[styles.drawerItem, { borderBottomColor: colors.border }]}
            onPress={() => {
              drawerRef.current?.closeDrawer();
              navigation.navigate('SelectFriend');
            }}
          >
            <Text style={[styles.drawerItemText, { color: colors.text }]}>Рекомендации с другом</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.drawerItem, { borderBottomColor: colors.border }]}
            onPress={() => {
              drawerRef.current?.closeDrawer();
              navigation.navigate('Blacklist');
            }}
          >
            <Text style={[styles.drawerItemText, { color: colors.text }]}>Черный список</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.drawerItem, { borderBottomColor: colors.border }]}
            onPress={() => {
              drawerRef.current?.closeDrawer();
              navigation.navigate('Wishlist');
            }}
          >
            <Text style={[styles.drawerItemText, { color: colors.text }]}>Список желаемого</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.drawerItem, { borderBottomColor: colors.border }]}
            onPress={handleLogout}
          >
            <Text style={[styles.drawerItemText, { color: colors.text }]}>Выйти</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  const renderFilterItem = (type, item) => {
    const isSelected = filters[type].includes(item);
    return (
      <TouchableOpacity
        key={item}
        style={[
          styles.filterItem,
          { 
            backgroundColor: isSelected ? colors.primary : colors.card,
            borderColor: colors.border
          }
        ]}
        onPress={() => toggleFilter(type, item)}
      >
        <Text style={[
          styles.filterItemText,
          { color: isSelected ? '#fff' : colors.text }
        ]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };
  const renderFilterSection = (title, type, items) => (
    <View style={styles.filterSection}>
      <Text style={[styles.filterSectionTitle, { color: colors.text }]}>
        {title}
      </Text>
      <View style={styles.filterItemsContainer}>
        {items.map(item => renderFilterItem(type, item))}
      </View>
    </View>
  );
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => setSelectedFriend(null)}
        >
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <DrawerLayout
      ref={drawerRef}
      drawerWidth={Dimensions.get('window').width * 0.75}
      drawerPosition="left"
      renderNavigationView={renderDrawerContent}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity 
          style={[styles.menuButton, { backgroundColor: colors.card }]}
          onPress={() => drawerRef.current?.openDrawer()}
        >
          <Text style={[styles.menuButtonText, { color: isDarkTheme ? '#ffffff' : colors.primary }]}>☰</Text>
        </TouchableOpacity>

        {selectedFriend && (
          <View style={[styles.selectedFriendContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.selectedFriendText, { color: colors.text }]}>
              Рекомендации с другом: {selectedFriend.name}
            </Text>
          </View>
        )}

        {!selectedFriend && (
          <TouchableOpacity 
            style={[styles.filterButton, { backgroundColor: colors.primary }]}
            onPress={() => setIsFilterModalVisible(true)}
          >
            <Text style={styles.filterButtonText}>Фильтры</Text>
          </TouchableOpacity>
        )}

        {recommendations.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {filters.genres.length > 0 || filters.features.length > 0 
                ? 'По выбранным фильтрам игры не найдены'
                : 'Рекомендации не найдены'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={recommendations}
            renderItem={({ item }) => (
              <GameCard 
                game={item} 
                onPress={(gameId) => navigation.navigate('GameDetails', { gameId })}
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

        <Modal
          animationType="slide"
          transparent={true}
          visible={isFilterModalVisible}
          onRequestClose={() => setIsFilterModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Фильтры</Text>
                <TouchableOpacity 
                  onPress={() => setIsFilterModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.filterContent}>
                {loadingFilters ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <>
                    {renderFilterSection('Жанры', 'genres', availableFilters.genres)}
                    {renderFilterSection('Особенности', 'features', availableFilters.features)}
                  </>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.applyButton, { backgroundColor: colors.primary }]}
                  onPress={applyFilters}
                >
                  <Text style={styles.applyButtonText}>Применить</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </DrawerLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingVertical: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuButton: {
    position: 'absolute',
    top: 90,
    left: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuButtonText: {
    fontSize: 24,
    lineHeight: 24,
  },
  drawerContent: {
    flex: 1,
  },
  drawerHeader: {
    height: 100,
    justifyContent: 'center',
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  drawerHeaderText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  drawerItems: {
    flex: 1,
    paddingTop: 20,
  },
  drawerItem: {
    padding: 16,
    borderBottomWidth: 1,
    marginHorizontal: 16,
  },
  drawerItemText: {
    fontSize: 18,
    fontWeight: '500',
  },
  filterButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  filterItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterItemText: {
    fontSize: 14,
  },
  modalFooter: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  applyButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterContent: {
    maxHeight: '70%',
  },
  selectedFriendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 40,
    marginHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  selectedFriendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default React.memo(RecommendationsScreen); 