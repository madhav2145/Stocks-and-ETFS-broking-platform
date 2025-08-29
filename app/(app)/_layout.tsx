import { Ionicons } from "@expo/vector-icons"
import { Tabs } from "expo-router"
import { StatusBar } from "expo-status-bar"
import React from "react"
import { Text, TextInput, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { SearchProvider, useSearchContext } from "../api/SearchContext"

const blue = "#111827" // deep purple (violet-600)
const green = "#F97316" // amber (amber-500)

// Custom header with title/search input and search/cancel icon
const CustomHeader = ({
  title,
  showSearchIcon,
}: {
  title: string
  showSearchIcon?: boolean
}) => {
  const { showSearch, setShowSearch, searchValue, setSearchValue, closeSearch } = useSearchContext()
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: 16,
        height: 50,
        backgroundColor: blue,
      }}
    >
      {showSearch ? (
        <TextInput
          autoFocus
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder="Search stocks..."
          placeholderTextColor="#D1D5DB"
          style={{
            flex: 1,
            backgroundColor: "#fff",
            borderRadius: 8,
            paddingHorizontal: 12,
            fontSize: 16,
            height: 38,
          }}
        />
      ) : (
        <Text
          style={{
            color: "#FAFAFA",
            fontSize: 18,
            fontWeight: "700",
            flex: 1,
            textAlign: "left",
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      )}
      {showSearchIcon && (
        <TouchableOpacity
          onPress={() => {
            if (showSearch) {
              closeSearch()
              setSearchValue("")
            } else {
              setShowSearch(true)
            }
          }}
          style={{ marginLeft: 16 }}
        >
          <Ionicons name={showSearch ? "close" : "search"} size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function RootLayout() {
  const CustomTabBar = ({ state, descriptors, navigation }: any) => (
    <View
      style={{ flexDirection: "row", backgroundColor: green, height: 48, borderTopWidth: 1, borderTopColor: "#D1D5DB" }}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key]
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name
        const isFocused = state.index === index
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }
        return (
          <React.Fragment key={route.key}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", height: "100%" }}
            >
              {options.tabBarIcon && options.tabBarIcon({ color: isFocused ? "#fff" : "#e0ffe0", size: 24 })}
              <Text style={{ color: isFocused ? "#fff" : "#FAFAFA", fontSize: 13, fontWeight: "600", marginLeft: 6 }}>
                {label}
              </Text>
            </TouchableOpacity>
            {index === 0 && <View style={{ width: 1, height: 28, backgroundColor: "#D1D5DB", alignSelf: "center" }} />}
          </React.Fragment>
        )
      })}
    </View>
  )

  return (
    <SearchProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <StatusBar style="dark" />
        <Tabs
          tabBar={CustomTabBar}
          screenOptions={({ route }) => ({
            header: () => {
              const isWatchlist = route.name === "watchlist"
              const isIndex = route.name === "index"
              const title = isWatchlist ? "Watchlist" : isIndex ? "Home" : "Stocks"
              return <CustomHeader title={title} showSearchIcon={!isWatchlist} />
            },
          })}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarLabel: "Home",
              tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="watchlist"
            options={{
              title: "Watchlist",
              tabBarLabel: "Watchlist",
              tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" color={color} size={size} />,
            }}
          />
        </Tabs>
      </SafeAreaView>
    </SearchProvider>
  )
}
