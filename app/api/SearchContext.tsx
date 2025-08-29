"use client"
import type React from "react";
import { createContext, useContext, useState } from "react";

type SearchContextType = {
  searchValue: string;
  setSearchValue: (v: string) => void;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  closeSearch: () => void;
};

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: React.ReactNode }) => {
  const [searchValue, setSearchValue] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const closeSearch = () => setShowSearch(false);

  return (
    <SearchContext.Provider value={{ searchValue, setSearchValue, showSearch, setShowSearch, closeSearch }}>
      {children}
    </SearchContext.Provider>
  );
};

export function useSearchContext() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchContext must be used within SearchProvider');
  return ctx;
}