import { Link, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCachedTopGainersLosers } from '../api/alphaVantage';

// Number of stocks per page
const PAGE_SIZE = 10;

// Stock type for type safety
interface Stock {
  name: string;
  price: string;
}

// Main ViewAllPage component for paginated gainers/losers
export default function ViewAllPage() {
  // Get type (gainers/losers) from route params
  const { type } = useLocalSearchParams();
  const [data, setData] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  // Fetch all gainers/losers data on mount or when type changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const apiData = await getCachedTopGainersLosers();
        let stocks: any[] = [];
        if (type === 'gainers') {
          stocks = apiData.top_gainers || [];
        } else if (type === 'losers') {
          stocks = apiData.top_losers || [];
        }
        setData(
          stocks.map((s: any) => ({
            name: s.ticker || s.symbol || s.name,
            price: s.price || s.close || '$--',
          }))
        );
      } catch {
        setError('Failed to load data. Please try again.');
        setData([]);
      }
      setLoading(false);
    }
    fetchData();
  }, [type]);

  // Calculate pagination
  const title = type === 'gainers' ? 'All Top Gainers' : 'All Top Losers';
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const paginated = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Main render
  return (
  <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <StatusBar style="dark" backgroundColor="#fff" />
      {loading ? (
        <View style={[styles.loadingContainer, { flex: 1, minHeight: 700 }]}>
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginBottom: 16 }} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.container}>
            <Text style={styles.heading}>{title}</Text>
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
            {!loading && !error && paginated.length === 0 && (
              <Text style={styles.noDataText}>No data available.</Text>
            )}
            {/* Render paginated stock cards */}
            {paginated.map((stock) => (
              <Link key={stock.name} href={{ pathname: '/details/[symbol]', params: { symbol: stock.name } }} asChild>
                <TouchableOpacity style={styles.cardWrapper}>
                  <View style={styles.card}>
                    <Text style={styles.stockSymbol}>{stock.name}</Text>
                    <Text style={styles.stockPrice}>{stock.price}</Text>
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
            {/* Pagination controls */}
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageBtn, page === 1 && styles.disabledBtn]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <Text style={styles.pageBtnText}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.pageInfo}>{`Page ${page} of ${totalPages}`}</Text>
              <TouchableOpacity
                style={[styles.pageBtn, page === totalPages && styles.disabledBtn]}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Styles for the ViewAllPage and its components
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FAFAFA',
    marginHorizontal: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 20,
  color: '#2C2C2E',
  },
  cardWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  card: {
  backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
  borderColor: '#D1D5DB',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockSymbol: {
    fontSize: 18,
    fontWeight: '500',
  color: '#2C2C2E',
  },
  stockPrice: {
    fontSize: 16,
    fontWeight: '500',
  color: '#3B82F6',
  backgroundColor: '#FAFAFA',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#3B82F6',
  },
  errorText: {
  color: '#EF4444',
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
  },
  noDataText: {
  color: '#2C2C2E',
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  pageBtn: {
  backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  disabledBtn: {
    backgroundColor: '#D1D5DB',
  },
  pageBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  pageInfo: {
    marginHorizontal: 8,
    fontSize: 16,
    color: '#2C2C2E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 700,
    width: '100%',
  backgroundColor: '#FAFAFA',
  },
  loadingText: {
    fontSize: 18,
  color: '#2C2C2E',
    fontWeight: '600',
  },
});
