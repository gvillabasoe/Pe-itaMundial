"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { User } from "@/lib/data";
import { findUserByCredentials, findUserById } from "@/lib/users";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  favorites: string[];
  toggleFavorite: (teamId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => false,
  logout: () => {},
  favorites: [],
  toggleFavorite: () => {},
});

const STORAGE_KEY_USER = "penita_user";
const STORAGE_KEY_FAVS = "penita_favs";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, val: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, val);
  } catch {
    // noop
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const savedId = safeGet(STORAGE_KEY_USER);
    if (savedId) {
      const found = findUserById(savedId);
      if (found) {
        setUser(found);
        const favsRaw = safeGet(`${STORAGE_KEY_FAVS}_${found.id}`);
        if (favsRaw) {
          try {
            setFavorites(JSON.parse(favsRaw));
          } catch {
            setFavorites([]);
          }
        }
      }
    }
  }, []);

  const login = useCallback((username: string, password: string): boolean => {
    const found = findUserByCredentials(username, password);
    if (!found) return false;

    setUser(found);
    safeSet(STORAGE_KEY_USER, found.id);

    const favsRaw = safeGet(`${STORAGE_KEY_FAVS}_${found.id}`);
    if (favsRaw) {
      try {
        setFavorites(JSON.parse(favsRaw));
      } catch {
        setFavorites([]);
      }
    } else {
      setFavorites([]);
    }

    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setFavorites([]);
    safeRemove(STORAGE_KEY_USER);
  }, []);

  const toggleFavorite = useCallback(
    (teamId: string) => {
      setFavorites((prev) => {
        const next = prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId];
        if (user) safeSet(`${STORAGE_KEY_FAVS}_${user.id}`, JSON.stringify(next));
        return next;
      });
    },
    [user]
  );

  return <AuthContext.Provider value={{ user, login, logout, favorites, toggleFavorite }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
