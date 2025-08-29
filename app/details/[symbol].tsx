import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { getCachedTimeSeriesDaily, getCachedTimeSeriesIntraday, getCachedTimeSeriesMonthly, getCachedTimeSeriesWeekly, getCompanyOverview } from '../api/alphaVantage';

// Key for storing watchlist groups in AsyncStorage
const STORAGE_KEY = 'WATCHLIST_GROUPS';

// Type for company overview data
interface CompanyOverview {
  Symbol: string;
  Name?: string;
  Description?: string;
  Sector?: string;
  Industry?: string;
  MarketCapitalization?: string;
  PERatio?: string;
  DividendYield?: string;
  Beta?: string;
  '52WeekHigh'?: string;
  '52WeekLow'?: string;
  ProfitMargin?: string;
  Exchange?: string;
  [key: string]: any;
}

// Timeframe options for the chart
const TIMEFRAMES = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '1Y', value: '1y' },
];

// Main details page for a stock/ETF
export default function DetailsPage() {
  // Get symbol from route params
  const params = useLocalSearchParams();
  let symbol = params.symbol;
  if (Array.isArray(symbol)) {
    symbol = symbol[0];
  }
  if (!symbol || typeof symbol !== 'string') {
    symbol = 'IBM'; // fallback
  }

  // State for modal, watchlist, company data, chart data, etc.
  const [modalVisible, setModalVisible] = useState(false);
  const [watchlistGroups, setWatchlistGroups] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState('');
  const [groupStocks, setGroupStocks] = useState<{ [group: string]: string[] }>({});
  const [company, setCompany] = useState<CompanyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(!symbol ? 'No symbol provided.' : '');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');
  const [dailyData, setDailyData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [intradayData, setIntradayData] = useState<any>(null);

  // Load watchlist groups and selected groups for this symbol
  useEffect(() => {
    if (!symbol) return;
    const loadData = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          setGroupStocks(parsed);
          setWatchlistGroups(Object.keys(parsed));
          const selected = Object.keys(parsed).filter(group => parsed[group].includes(symbol));
          setSelectedGroups(selected);
        } else {
          setGroupStocks({});
          setWatchlistGroups([]);
          setSelectedGroups([]);
        }
      } catch {
        Alert.alert('Error', 'Failed to load watchlists');
      }
    };
    loadData();
  }, [symbol]);

  // Fetch company overview data
  useEffect(() => {
    if (!symbol) return;
    async function fetchCompany() {
      setLoading(true);
      setError('');
      setCompany(null);
      try {
        const data = await getCompanyOverview(symbol);
        setCompany(data);
      } catch {
        setError('Failed to load company details.');
      }
      setLoading(false);
    }
    fetchCompany();
  }, [symbol]);

  // Fetch time series data for chart
  useEffect(() => {
    if (!symbol) return;
    async function fetchTimeSeries() {
      try {
        const [daily, weekly, monthly, intraday] = await Promise.all([
          getCachedTimeSeriesDaily(symbol),
          getCachedTimeSeriesWeekly(symbol),
          getCachedTimeSeriesMonthly(symbol),
          getCachedTimeSeriesIntraday(symbol, '5min'),
        ]);
        setDailyData(daily);
        setWeeklyData(weekly);
        setMonthlyData(monthly);
        setIntradayData(intraday);
      } catch {
        // Optionally handle error
      }
    }
    fetchTimeSeries();
  }, [symbol]);

  // Save updated watchlist groups to AsyncStorage
  const saveData = async (updated: { [group: string]: string[] }) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setGroupStocks(updated);
      setWatchlistGroups(Object.keys(updated));
    } catch {
      Alert.alert('Error', 'Failed to save watchlists');
    }
  };

  // Add a new group to the watchlist
  const addGroup = () => {
    if (newGroup && !watchlistGroups.includes(newGroup)) {
      const updated = { ...groupStocks, [newGroup]: [] };
      saveData(updated);
      setNewGroup('');
    }
  };

  // Toggle stock in a group (add/remove)
  const toggleGroup = (group: string) => {
    if (!symbol) return;
    const updated = { ...groupStocks };
    const stocks = updated[group] || [];
    if (stocks.includes(symbol)) {
      updated[group] = stocks.filter(s => s !== symbol);
    } else {
      updated[group] = [...stocks, symbol];
    }
    saveData(updated);
    setSelectedGroups(prev =>
      prev.includes(group)
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  // Reload watchlist data when modal closes
  useEffect(() => {
    if (!modalVisible && symbol) {
      const reload = async () => {
        try {
          const data = await AsyncStorage.getItem(STORAGE_KEY);
          if (data) {
            const parsed = JSON.parse(data);
            setGroupStocks(parsed);
            setWatchlistGroups(Object.keys(parsed));
            const selected = Object.keys(parsed).filter(group => parsed[group].includes(symbol));
            setSelectedGroups(selected);
          } else {
            setGroupStocks({});
            setWatchlistGroups([]);
            setSelectedGroups([]);
          }
        } catch {}
      };
      reload();
    }
  }, [modalVisible, symbol]);

  // Parse time series data for chart rendering
  function parseTimeSeriesData(data: any, count?: number): number[] {
    if (!data) {
      return [];
    }
    const tsKey = Object.keys(data).find(k =>
      k.includes('Time Series')
    );
    if (!tsKey) {
      return [];
    }
    const series = data[tsKey];
    if (!series) {
      return [];
    }
    const dates = Object.keys(series).sort((a, b) => b.localeCompare(a));
    let arr = dates.map(date => parseFloat(series[date]['4. close']));
    if (count) arr = arr.slice(0, count);
    return arr.reverse();
  }

  // Chart component for price history
  const Chart = React.memo(function Chart({
    selectedTimeframe,
    intradayData,
    dailyData,
    weeklyData,
    monthlyData,
    TIMEFRAMES
  }: {
    selectedTimeframe: string,
    intradayData: any,
    dailyData: any,
    weeklyData: any,
    monthlyData: any,
    TIMEFRAMES: { label: string, value: string }[]
  }) {
    let data: number[] = [];
    if (selectedTimeframe === '1d') {
      data = parseTimeSeriesData(intradayData, 78);
    } else if (selectedTimeframe === '1w') {
      data = parseTimeSeriesData(dailyData, 5);
    } else if (selectedTimeframe === '1m') {
      data = parseTimeSeriesData(weeklyData, 4);
    } else if (selectedTimeframe === '3m') {
      data = parseTimeSeriesData(weeklyData, 12);
    } else if (selectedTimeframe === '1y') {
      data = parseTimeSeriesData(monthlyData, 12);
    } else {
      data = parseTimeSeriesData(dailyData, 5);
    }

    if (!data || data.length < 2) {
      return <Text style={{ color: '#888', textAlign: 'center', marginVertical: 12 }}>Insufficient data to display chart.</Text>;
    }

    const latest = data[data.length - 1];
    const oldest = data[0];
    const change = latest - oldest;
    const changePct = oldest !== 0 ? (change / oldest) * 100 : 0;
    const priceUpChart = change >= 0;
    const priceText = `$${latest?.toFixed(2) ?? '--'}`;
    const priceChangePctText = `${change >= 0 ? '+' : ''}${changePct?.toFixed(2) ?? '--'}%`;

    const totalWidth = Dimensions.get('window').width - 70;
    const yAxisWidth = 48;
    const width = totalWidth - yAxisWidth;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = 180 - ((v - min) / (max - min || 1)) * 180;
      return `${x},${y}`;
    }).join(' ');
    const yLabels = [max, max - (max - min) * 0.33, max - (max - min) * 0.66, min];

    return (
      <View style={styles.chartContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.priceText}>{priceText}</Text>
          <View style={[styles.priceChangeBox, { backgroundColor: priceUpChart ? '#22C55E' : '#EF4444' }]}>
            <Ionicons name={priceUpChart ? 'arrow-up' : 'arrow-down'} size={14} color="#fff" style={{ marginRight: 2 }} />
            <Text style={styles.priceChangeText}>{priceChangePctText}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: '#eaf6f0', borderRadius: 12, padding: 8 }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: yAxisWidth, height: 180, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
              {yLabels.map((y, i) => (
                <Text key={i} style={{ color: '#888', fontSize: 12 }}>{y?.toFixed(2) ?? '--'}</Text>
              ))}
            </View>
            <View style={{ width }}>
              <View style={{ height: 180, width, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={width} height={180}>
                  <Polyline
                    fill="none"
                    stroke={'#22C55E'}
                    strokeWidth="3"
                    points={points}
                  />
                </Svg>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  });

  // Main render
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      {!symbol || loading ? (
        <View style={styles.loadingContainer}>
          {!symbol ? (
            <Text style={styles.loadingText}>No symbol provided.</Text>
          ) : (
            <>
              <ActivityIndicator size="large" color="#3B82F6" style={{ marginBottom: 16 }} />
              <Text style={styles.loadingText}>Loading...</Text>
            </>
          )}
        </View>
      ) : (
  <ScrollView style={{ backgroundColor: '#FAFAFA' }} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={[styles.container, { backgroundColor: '#FAFAFA' }]}> 
            {/* Bookmark button at top right */}
            <TouchableOpacity style={styles.bookmarkBtn} onPress={() => setModalVisible(true)}>
              <Ionicons name={selectedGroups.length ? 'bookmark' : 'bookmark-outline'} size={28} color="#3B82F6" />
            </TouchableOpacity>
            {error ? (
              <Text style={{ color: '#EF4444', textAlign: 'center', marginVertical: 16 }}>{error}</Text>
            ) : null}
            {company && !error && (
              <View style={{ width: '100%' }}>
                <Text style={styles.companyName}>{company.Name || symbol}</Text>
                <Text style={styles.tickerText}>{company.Symbol} • {company.Exchange || 'NSQ'}</Text>
                <Chart
                  selectedTimeframe={selectedTimeframe}
                  intradayData={intradayData}
                  dailyData={dailyData}
                  weeklyData={weeklyData}
                  monthlyData={monthlyData}
                  TIMEFRAMES={TIMEFRAMES}
                />
                <View style={styles.timeframeTabs}>
                  {TIMEFRAMES.map(tf => (
                    <TouchableOpacity
                      key={tf.value}
                      style={[styles.timeframeTab, selectedTimeframe === tf.value && styles.timeframeTabActive]}
                      onPress={() => setSelectedTimeframe(tf.value)}
                    >
                      <Text style={[styles.timeframeTabText, selectedTimeframe === tf.value && styles.timeframeTabTextActive]}>{tf.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.sectionTitle}>About {company.Name || symbol}</Text>
                {company.Description ? (
                  <Text style={styles.description}>{company.Description}</Text>
                ) : (
                  <Text style={styles.description}>No data</Text>
                )}
                <View style={styles.tagsRow}>
                  <View style={styles.tag}><Text style={styles.tagText}>{company.Industry || 'No data'}</Text></View>
                  <View style={styles.tag}><Text style={styles.tagText}>{company.Sector || 'No data'}</Text></View>
                </View>
                <Text style={styles.sectionTitle}>Stock Metrics</Text>
                <View style={styles.metricsTable}>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>52-Week Low</Text><Text style={styles.metricValue}>{company['52WeekLow'] ? `$${company['52WeekLow']}` : 'No data'}</Text></View>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>52-Week High</Text><Text style={styles.metricValue}>{company['52WeekHigh'] ? `$${company['52WeekHigh']}` : 'No data'}</Text></View>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>Market Cap</Text><Text style={styles.metricValue}>{company.MarketCapitalization ? `$${Number(company.MarketCapitalization).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'No data'}</Text></View>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>P/E Ratio</Text><Text style={styles.metricValue}>{company.PERatio || 'No data'}</Text></View>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>Beta</Text><Text style={styles.metricValue}>{company.Beta || 'No data'}</Text></View>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>Dividend Yield</Text><Text style={styles.metricValue}>{company.DividendYield || 'No data'}</Text></View>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>Profit Margin</Text><Text style={styles.metricValue}>{company.ProfitMargin ? `${(parseFloat(company.ProfitMargin) * 100).toFixed(1)}%` : 'No data'}</Text></View>
                </View>
              </View>
            )}
            {/* Modal for adding/removing from watchlist groups */}
            <Modal
              visible={modalVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalHeading}>Add to Watchlist</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      placeholder="New group name"
                      value={newGroup}
                      onChangeText={setNewGroup}
                      style={styles.input}
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={addGroup}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={watchlistGroups}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <View style={styles.groupRow}>
                        <Text style={styles.groupName}>{item}</Text>
                        <TouchableOpacity onPress={() => toggleGroup(item)}>
                          <Ionicons
                            name={groupStocks[item]?.includes(symbol) ? 'checkbox' : 'square-outline'}
                            size={24}
                            color="#3B82F6"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#888' }}>No watchlist groups yet.</Text>}
                  />
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                    <Text style={{ color: '#3B82F6', fontWeight: 'bold' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Styles for the details page and its components
const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
    minHeight: 700,
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 40,
    right: 24,
    zIndex: 10,
  backgroundColor: '#FAFAFA',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  companyName: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 80,
    marginBottom: 2,
  color: '#1C1C1E',
    textAlign: 'left',
  },
  tickerText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
    textAlign: 'left',
  },
  priceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginRight: 12,
  },
  priceChangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 2,
  },
  priceChangeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  chartContainer: {
    marginBottom: 12,
    marginTop: 8,
    width: '100%',
  },
  timeframeTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 8,
    width: '100%',
  },
  timeframeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eaf6f0',
  },
  timeframeTabActive: {
  backgroundColor: '#22C55E',
  },
  timeframeTabText: {
    color: '#1C1C1E',
    fontWeight: '600',
    fontSize: 15,
  },
  timeframeTabTextActive: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 6,
    color: '#1C1C1E',
  },
  description: {
    color: '#444',
    fontSize: 15,
    marginBottom: 10,
  },
  tagsRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 12,
  },
  tag: {
    backgroundColor: '#eaf6f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  marginRight: 8,
  marginBottom: 8,
  },
  tagText: {
  color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14,
  },
  metricsTable: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    marginTop: 4,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  metricLabel: {
    color: '#888',
    fontWeight: '600',
    fontSize: 15,
  },
  metricValue: {
    color: '#1C1C1E',
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
  backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    minHeight: 350,
  },
  modalHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    marginRight: 8,
  },
  addBtn: {
  backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  groupName: {
    fontSize: 16,
  },
  closeBtn: {
    marginTop: 16,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    minHeight: 700,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 18,
    color: '#888',
    fontWeight: '600',
  },
});
