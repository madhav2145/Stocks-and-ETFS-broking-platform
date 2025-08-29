import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY = '2LECAK3DRC0SNRPE'; 
const BASE_URL = 'https://www.alphavantage.co/query';

const CACHE_DURATION = 24 * 60 * 60 * 1000; 
const ASYNC_CACHE_KEY = 'gainersLosersCache';

export async function getTopGainersLosers() {
  const url = `${BASE_URL}?function=TOP_GAINERS_LOSERS&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Alpha Vantage TOP_GAINERS_LOSERS result:', data);
  return data;
}

export async function getCachedTopGainersLosers() {
  const now = Date.now();
  try {
    const cached = await AsyncStorage.getItem(ASYNC_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.data && now - parsed.timestamp < CACHE_DURATION) {
        return parsed.data;
      }
    }
  } catch {}
  const data = await getTopGainersLosers();
  try {
    await AsyncStorage.setItem(ASYNC_CACHE_KEY, JSON.stringify({ data, timestamp: now }));
  } catch {}
  return data;
}

export async function getCompanyOverview(symbol) {
  const url = `${BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Alpha Vantage OVERVIEW result:', data);
  return data;
}

export async function searchTicker(keywords) {
  const url = `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${keywords}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Alpha Vantage SYMBOL_SEARCH result:', data);
  return data;
}

async function getCachedTimeSeries(symbol, type, fn) {
  const key = `av_timeseries_${type}_${symbol}`;
  const now = Date.now();
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.data && now - parsed.timestamp < CACHE_DURATION) {
        return parsed.data;
      }
    }
  } catch {}
  const data = await fn(symbol);
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: now }));
  } catch {}
  return data;
}

export async function getTimeSeriesDaily(symbol) {
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
 
  return data;
}

export async function getTimeSeriesWeekly(symbol) {
  const url = `${BASE_URL}?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  return data;
}

export async function getTimeSeriesMonthly(symbol) {
  const url = `${BASE_URL}?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  return data;
}

export async function getCachedTimeSeriesDaily(symbol) {
  const data = await getCachedTimeSeries(symbol, 'daily', getTimeSeriesDaily);
  return data;
}

export async function getCachedTimeSeriesWeekly(symbol) {
  const data = await getCachedTimeSeries(symbol, 'weekly', getTimeSeriesWeekly);
  
  return data;
}

export async function getCachedTimeSeriesMonthly(symbol) {
  const data = await getCachedTimeSeries(symbol, 'monthly', getTimeSeriesMonthly);
  
  return data;
}

export async function getTimeSeriesIntraday(symbol, interval = '5min') {
  const url = `${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  
  return data;
}

export async function getCachedTimeSeriesIntraday(symbol, interval = '5min') {
  const key = `av_timeseries_intraday_${interval}_${symbol}`;
  const now = Date.now();
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.data && now - parsed.timestamp < CACHE_DURATION) {
        
        return parsed.data;
      }
    }
  } catch {}
  const data = await getTimeSeriesIntraday(symbol, interval);
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: now }));
  } catch {}
  
  return data;
}