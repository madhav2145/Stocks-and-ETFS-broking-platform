import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCachedTopGainersLosers } from '../api/alphaVantage';

// Main WatchlistScreen component
export default function WatchlistScreen() {
  // State for watchlist groups and selected group
  const [groups, setGroups] = useState<{ [group: string]: string[] }>({});
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedStocks, setSelectedStocks] = useState<{ symbol: string; image: string; price: string }[]>([]);
  const router = useRouter();

  // Load watchlist groups from AsyncStorage on mount
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const data = await AsyncStorage.getItem('WATCHLIST_GROUPS');
        if (data) setGroups(JSON.parse(data));
      } catch {
        // error handling (optional)
      }
    };
    loadGroups();
  }, []);

  // Delete a group from watchlist
  const deleteGroup = async (group: string) => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete the group "${group}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            const updated = { ...groups };
            delete updated[group];
            await AsyncStorage.setItem('WATCHLIST_GROUPS', JSON.stringify(updated));
            setGroups(updated);
            if (selectedGroup === group) setSelectedGroup(null);
          }
        }
      ]
    );
  };

  // Render a single group row
  const renderGroup = ({ item }: { item: string }) => (
    <View style={styles.groupRow}>
      <TouchableOpacity style={styles.groupBtn} onPress={() => setSelectedGroup(item)}>
        <Text style={styles.groupName}>{item}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => deleteGroup(item)} style={styles.deleteBtn}>
  <Ionicons name="trash" size={22} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  // Render a single stock in a group
  const renderStock = ({ item }: { item: { symbol: string; image: string; price: string } }) => (
    <TouchableOpacity style={styles.stockCard} onPress={() => router.push({ pathname: '/details/[symbol]', params: { symbol: item.symbol } })}>
      <Image source={ item.image ? { uri: item.image } : require('../../assets/images/stock-placeholder.png') } style={styles.stockIcon} />
      <Text style={styles.stockSymbol}>{item.symbol}</Text>
      <Text style={styles.stockPrice}>{item.price}</Text>
    </TouchableOpacity>
  );

  // When a group is selected, fetch its stocks' images and prices (best-effort)
  useEffect(() => {
    if (!selectedGroup) return;
    const symbols = groups[selectedGroup] || [];
    async function loadDetails() {
      // First try to get prices from cached top gainers/losers used on the index page
      let cached: any = null;
      try {
        cached = await getCachedTopGainersLosers();
      } catch {}

      const results = await Promise.all(symbols.map(async (sym) => {
        const upper = sym.toUpperCase();
        const imageUrl = `https://financialmodelingprep.com/image-stock/${upper}.png`;
        let price = '--';

        // Look up in cached gainers/losers first
        if (cached) {
          const all = [ ...(cached.top_gainers || []), ...(cached.top_losers || []) ];
          const found = all.find((s: any) => (s.ticker || s.symbol || s.name || '').toUpperCase() === upper);
          if (found) {
            price = found.price || found.close || found.last || price;
            if (typeof price === 'number') price = `$${Number(price).toFixed(2)}`;
          }
        }

        // Fallback: try quick quote endpoint if still no price
        if (!price || price === '--') {
          try {
            const res = await fetch(`https://financialmodelingprep.com/api/v3/quote-short/${upper}`);
            if (res.ok) {
              const j = await res.json();
              if (Array.isArray(j) && j[0] && j[0].price != null) price = `$${Number(j[0].price).toFixed(2)}`;
            }
          } catch {}
        }

        // Preload image (best-effort)
        try { await Image.prefetch(imageUrl); } catch {}
        return { symbol: sym, image: imageUrl, price };
      }));
      setSelectedStocks(results);
    }
    loadDetails();
  }, [selectedGroup, groups]);

  // Show empty state if no groups exist
  if (!Object.keys(groups).length) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Watchlist</Text>
        <Text style={styles.subText}>Your watchlists will appear here.</Text>
      </View>
    );
  }

  // Show stocks in selected group
  if (selectedGroup) {
    return (
      <View style={[styles.selectedContainer, { paddingTop: 16, paddingBottom: 16 }]}>
        <TouchableOpacity onPress={() => setSelectedGroup(null)}>
          <Text style={styles.backBtn}>{'< Back to Groups'}</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>
          {groups[selectedGroup] && groups[selectedGroup].length === 0
            ? `No stocks in ${selectedGroup}`
            : selectedGroup}
        </Text>
        <FlatList
          data={selectedStocks}
          keyExtractor={(item) => item.symbol}
          renderItem={renderStock}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={{ paddingTop: 12 }}
        />
      </View>
    );
  }

  // Show all groups
  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <View style={styles.center}>
        <TouchableOpacity onPress={() => router.push('/')}>
          <Text style={styles.backBtn}>{'< Back to Stocks'}</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Watchlist Groups</Text>
        <FlatList
          data={Object.keys(groups)}
          keyExtractor={(item) => item}
          renderItem={renderGroup}
        />
      </View>
    </View>
  );
}

// Styles for the WatchlistScreen and its components
const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  backgroundColor: '#FAFAFA',
    padding: 20,
    flex: 1,
  },
  heading: {
    fontSize: 26,
    fontWeight: '600',
  color: '#1C1C1E',
    marginBottom: 16,
    textAlign: 'center',
  },
  subText: {
    fontSize: 16,
  color: '#2C2C2E',
    textAlign: 'center',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 250,
    marginBottom: 14,
  backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
  borderColor: '#D1D5DB',
    justifyContent: 'space-between',
  },
  groupBtn: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '500',
  color: '#1C1C1E',
  },
  deleteBtn: {
    padding: 8,
  },
  stockBtn: {
    padding: 14,
  backgroundColor: '#FAFAFA',
    borderRadius: 10,
    marginBottom: 12,
    width: 220,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  stockName: {
    fontSize: 16,
  color: '#3B82F6',
    fontWeight: '500',
  },
  backBtn: {
  color: '#3B82F6',
    marginBottom: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  selectedContainer: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    flex: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  stockCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
  borderColor: '#D1D5DB',
  },
  stockIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 8,
  backgroundColor: '#FAFAFA',
  },
  stockSymbol: {
    fontSize: 16,
    fontWeight: '700',
  color: '#1C1C1E',
    marginBottom: 4,
  },
  stockPrice: {
    fontSize: 14,
    fontWeight: '600',
  color: '#3B82F6',
  },
});
