"use client"

// useNavigation not required here
import { Link } from "expo-router"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native"
import { useDebouncedCallback } from "use-debounce"
import { getCachedTopGainersLosers, searchTicker } from "../api/alphaVantage"
import { useSearchContext } from "../api/SearchContext"

// Stock interface for type safety
interface Stock {
  name: string
  price: string
  symbol: string
  image: string
  change: string
}

// Helper to build multiple logo URL candidates per symbol
function candidateImageUris(symbol?: string) {
  if (!symbol) return []
  const s = String(symbol).toUpperCase()

  const variants = Array.from(
    new Set([s, s.replace(/\./g, "-"), s.replace(/-/g, "."), s.split(".")[0], s.split("-")[0]].filter(Boolean)),
  )

  return variants.map((v) => `https://financialmodelingprep.com/image-stock/${v}.png`)
}

// Component to render stock logo or fallback image
function StockLogo({ uri, uris, style }: { uri?: string; uris?: string[]; style?: any }) {
  const fallback = require("../../assets/images/stock-placeholder.png")
  const candidates = (uris && uris.length ? uris : uri ? [uri] : []) as string[]
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  const src = failed || candidates.length === 0 ? fallback : { uri: candidates[Math.min(idx, candidates.length - 1)] }

  return (
    <Image
      source={src}
      style={style || styles.logo}
      onError={() => {
        if (idx < candidates.length - 1) {
          setIdx(idx + 1)
        } else {
          setFailed(true)
        }
      }}
      resizeMode="contain"
    />
  )
}

// Main ExploreScreen component
export default function ExploreScreen() {
  // navigation not used in this screen
  const { searchValue, setSearchValue, showSearch, closeSearch } = useSearchContext()

  // responsive overlay height (40% of viewport height)
  const { height: windowHeight } = useWindowDimensions()
  const overlayMax = Math.max(160, Math.round(windowHeight * 0.4))

  // State variables for gainers, losers, loading, and errors
  const [gainers, setGainers] = useState<Stock[]>([])
  const [losers, setLosers] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState("")

  // Debounced search for ticker symbols
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSearchResults([])
      setSearchError("")
      return
    }
    setSearchLoading(true)
    setSearchError("")
    try {
      const results = await searchTicker(query)
      if (results && Array.isArray(results.bestMatches)) {
        setSearchResults(results.bestMatches)
      } else {
        setSearchResults([])
      }
    } catch {
      setSearchError("Search failed.")
      setSearchResults([])
    }
    setSearchLoading(false)
  }, 400)

  // When overlay opens, if there is already text, run search and prefetch icons
  useEffect(() => {
    if (showSearch && searchValue && searchValue.length > 0) {
      debouncedSearch(searchValue)
    }
  }, [showSearch, debouncedSearch, searchValue])

  // Prefetch images for results when they change
  useEffect(() => {
    async function prefetchImages() {
      try {
        await Promise.all(
          (searchResults || []).map(async (item) => {
            const symbol = item["1. symbol"] || item.symbol
            if (!symbol) return
            const candidates = candidateImageUris(symbol)
            for (let i = 0; i < Math.min(3, candidates.length); i++) {
              try {
                const ok = await Image.prefetch(candidates[i])
                if (ok) break
              } catch {}
              await new Promise((r) => setTimeout(r, 120))
            }
          }),
        )
      } catch {}
    }
    if (searchResults && searchResults.length > 0) prefetchImages()
  }, [searchResults])

  // Fetch top gainers and losers on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError("")
      try {
        const data = await getCachedTopGainersLosers()
        // Helper to map API data to Stock interface
        function mapStock(s: any): Stock {
          return {
            name: s.name || s.symbol || s.ticker || "",
            price: s.price || s.close || "",
            symbol: s.ticker || s.symbol || s.name || "",
            image: "placeholder",
            change: s.change || "",
          }
        }
        const gainersRaw = (data.top_gainers || []).slice(0, 4).map(mapStock)
        const losersRaw = (data.top_losers || []).slice(0, 4).map(mapStock)
        const gainersWithImages = await updateStockImages(gainersRaw)
        const losersWithImages = await updateStockImages(losersRaw)
        setGainers(gainersWithImages)
        setLosers(losersWithImages)
      } catch {
        setError("Failed to load data. Please try again.")
        setGainers([])
        setLosers([])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // Helper to update stock images using Financial Modeling Prep
  async function updateStockImages(stocks: Stock[]) {
    return await Promise.all(
      stocks.map(async (stock) => {
        const candidates = candidateImageUris(stock.symbol)
        for (const url of candidates) {
          try {
            const ok = await Image.prefetch(url)
            if (ok) return { ...stock, image: url }
          } catch {}
        }
        return stock
      }),
    )
  }

  // Debounced search effect
  useEffect(() => {
    debouncedSearch(searchValue)
  }, [searchValue, debouncedSearch])

  // Main render
  return (
    <View style={styles.fixedContainer}>
      {/* Attach search popup to header, show only icon and name, make scrollable, trigger after 1 char */}
      {showSearch && searchValue.length > 0 && (
        <View style={styles.searchOverlayContainer} pointerEvents="box-none">
          <Pressable
            style={styles.searchBackdropFull}
            android_ripple={{ color: "transparent" }}
            accessibilityRole="button"
            onPress={() => {
              closeSearch()
            }}
            pointerEvents="auto"
          />
          <View style={[styles.searchBarOverlay, { height: overlayMax }]} pointerEvents="auto">
            {searchLoading ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ margin: 12 }} />
            ) : searchError ? (
              <Text style={{ color: "#EF4444", padding: 12 }}>{searchError}</Text>
            ) : !Array.isArray(searchResults) || searchResults.length === 0 ? (
              <Text style={{ color: "#2C2C2E", padding: 12 }}>No results</Text>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => String(item["1. symbol"] || item.symbol)}
                style={[styles.searchBarList, { maxHeight: overlayMax }]}
                contentContainerStyle={styles.searchBarScrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const symbol = item["1. symbol"] || item.symbol
                  const uris = candidateImageUris(symbol)
                  return (
                    <Link key={symbol} href={{ pathname: "/details/[symbol]", params: { symbol } }} asChild>
                      <Pressable
                        style={styles.searchBarResult}
                        onPress={() => {
                          setSearchValue("")
                          setSearchResults([])
                          closeSearch()
                        }}
                        android_ripple={{ color: "#e6e6e6" }}
                      >
                        <StockLogo uris={uris} style={styles.searchBarIcon} />
                        <Text style={styles.searchBarName}>{item["2. name"] || item.name}</Text>
                      </Pressable>
                    </Link>
                  )
                }}
              />
            )}
          </View>
        </View>
      )}
      <View style={styles.container}>
        {loading ? (
          <View style={[styles.loadingContainer, { flex: 1 }]}>
            <ActivityIndicator size="large" color="#3B82F6" style={{ marginBottom: 15 }} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {/* Top Gainers Box */}
            <View style={styles.box}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text style={[styles.boxTitle, { textAlign: "left", marginBottom: 0, flex: 1 }]}>Top Gainers</Text>
                <Link href={{ pathname: "/view-all/[type]", params: { type: "gainers" } }} asChild>
                  <TouchableOpacity style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>View all</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              <View style={styles.matrixGrid}>
                {gainers.length === 0 && !loading ? (
                  <Text style={styles.noDataText}>No data available.</Text>
                ) : (
                  Array(4)
                    .fill(null)
                    .map((_, idx) => {
                      const stock = gainers[idx]
                      return (
                        <View key={stock ? stock.symbol : idx} style={styles.matrixCell}>
                          {stock ? (
                            <Link href={{ pathname: "/details/[symbol]", params: { symbol: stock.symbol } }} asChild>
                              <TouchableOpacity style={styles.stockBox}>
                                <StockLogo uri={stock.image} />
                                <Text style={styles.stockName}>{stock.name}</Text>
                                <Text style={styles.stockPrice}>{stock.price}</Text>
                              </TouchableOpacity>
                            </Link>
                          ) : null}
                        </View>
                      )
                    })
                )}
              </View>
            </View>
            {/* Top Losers Box */}
            <View style={styles.box}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text style={[styles.boxTitle, { textAlign: "left", marginBottom: 0, flex: 1 }]}>Top Losers</Text>
                <Link href={{ pathname: "/view-all/[type]", params: { type: "losers" } }} asChild>
                  <TouchableOpacity style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>View all</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              <View style={styles.matrixGrid}>
                {losers.length === 0 && !loading ? (
                  <Text style={styles.noDataText}>No data available.</Text>
                ) : (
                  Array(4)
                    .fill(null)
                    .map((_, idx) => {
                      const stock = losers[idx]
                      return (
                        <View key={stock ? stock.symbol : idx} style={styles.matrixCell}>
                          {stock ? (
                            <Link href={{ pathname: "/details/[symbol]", params: { symbol: stock.symbol } }} asChild>
                              <TouchableOpacity style={styles.stockBox}>
                                <StockLogo uri={stock.image} />
                                <Text style={styles.stockName}>{stock.name}</Text>
                                <Text style={styles.stockPrice}>{stock.price}</Text>
                              </TouchableOpacity>
                            </Link>
                          ) : null}
                        </View>
                      )
                    })
                )}
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

// Styles for the ExploreScreen and its components
const styles = StyleSheet.create({
  searchBarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 60,
    width: "100%",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: "#fff",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchBarList: {
    width: "100%",
    backgroundColor: "#FAFAFA",
    maxHeight: 200, // Added maxHeight to enable scrolling
  },
  searchBarScrollContent: {
    width: "100%",
    paddingBottom: 8,
  },
  searchBarResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FAFAFA",
    width: "100%",
    backgroundColor: "#FAFAFA",
  },
  searchBarIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    overflow: "hidden",
    marginRight: 12,
    backgroundColor: "#FAFAFA",
  },
  searchBarName: {
    fontWeight: "600",
    color: "#1C1C1E",
    fontSize: 16,
    flexShrink: 1,
  },
  searchOverlayHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 56,
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  searchDropdownHeader: {
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    marginTop: 0,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    padding: 8,
    minWidth: 280,
    maxWidth: 400,
    width: "90%",
    alignSelf: "center",
  },
  searchResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#FAFAFA",
  },
  searchResultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: "#FAFAFA",
  },
  searchResultNameHeader: {
    fontWeight: "600",
    color: "#1C1C1E",
    fontSize: 15,
  },
  searchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 70,
    backgroundColor: "rgba(255,255,255,0.01)",
    minHeight: "100%",
  },
  searchOverlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  searchBackdrop: {
    position: "absolute",
    top: 260,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  searchBackdropFull: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 40,
  },
  searchDropdown: {
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    padding: 8,
    minWidth: 280,
    maxWidth: 400,
    width: "90%",
    alignSelf: "center",
  },
  searchResult: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FAFAFA",
  },
  box: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#FAFAFA",
  },
  boxTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 12,
    textAlign: "center",
  },
  matrixGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  matrixCell: {
    width: "47%",
    minWidth: 120,
    maxWidth: 180,
    marginBottom: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  stockBox: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  stockName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
    marginTop: 2,
    marginBottom: 2,
    textAlign: "center",
  },
  fixedContainer: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingVertical: 5,
    minHeight: "100%",
  },
  gridContainerFixed: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    rowGap: 10,
    columnGap: 5,
  },
  cardWrapperFixed: {
    width: "23%",
    minWidth: 90,
    maxWidth: 120,
    marginBottom: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  cardFixed: {
    backgroundColor: "#FAFAFA",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    minHeight: 50,
    width: "100%",
    maxWidth: 110,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  gainersCardFixed: {
    borderLeftWidth: 3,
    borderLeftColor: "#22C55E",
  },
  losersCardFixed: {
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  logoContainerFixed: {
    width: 36,
    height: 30,
    borderRadius: 18,
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  stockSymbolFixed: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  stockPriceFixed: {
    fontSize: 5,
    fontWeight: "600",
    color: "#2C2C2E",
    marginBottom: 4,
    backgroundColor: "#FAFAFA",
    borderRadius: 6,
    paddingHorizontal: 2,
    paddingVertical: 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    textAlign: "center",
  },
  searchError: {
    color: "#EF4444",
    padding: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  noResults: {
    color: "#2C2C2E",
    padding: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  searchResultSymbol: {
    fontWeight: "700",
    color: "#1C1C1E",
    fontSize: 15,
  },
  searchResultName: {
    color: "#2C2C2E",
    fontSize: 12,
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    marginVertical: 10,
    fontWeight: "600",
    fontSize: 15,
  },
  noDataText: {
    color: "#2C2C2E",
    textAlign: "center",
    width: "100%",
    fontWeight: "600",
    fontSize: 14,
    marginVertical: 8,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 700,
    width: "100%",
    backgroundColor: "#FAFAFA",
  },
  loadingText: {
    fontSize: 18,
    color: "#2C2C2E",
    fontWeight: "600",
  },
  searchInput: {
    backgroundColor: "#FAFAFA",
    borderRadius: 11,
    paddingHorizontal: 19,
    paddingVertical: 8,
    height: 36,
    width: 160,
    fontSize: 16,
    color: "#1C1C1E",
    fontWeight: "400",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    letterSpacing: -0.5,
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewAllText: {
    color: "#3B82F6",
    fontWeight: "600",
    fontSize: 16,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardWrapper: {
    width: "48%",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  gainersCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#22C55E",
  },
  losersCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  stockSymbol: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  stockPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
    marginBottom: 8,
    backgroundColor: "#FAFAFA",
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  changeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#FAFAFA",
  },
  gainText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22C55E",
  },
  lossText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
  },
})
