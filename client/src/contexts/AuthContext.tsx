import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { getPostLoginPath } from "@/lib/roleRedirect";
import { getAuthToken, setAuthToken, clearAllLegacyTokens } from "@/lib/authToken";

interface User {
  id: string;
  email: string;
  role: "customer" | "driver" | "restaurant" | "admin" | "ticket_operator" | "shop_partner" | "pending_ticket_operator" | "pending_shop_partner" | "pending_driver" | "pending_restaurant";
  countryCode: "BD" | "US";
  profile?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: string, countryCode: string) => Promise<void>;
  logout: () => void; // Fires async audit request internally but returns immediately
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const validateSession = async () => {
      const storedToken = getAuthToken();
      const storedUser = localStorage.getItem("safego_user");

      if (storedToken && storedUser) {
        try {
          // Validate the token with the backend (works for ALL user types)
          const response = await fetch("/api/auth/validate", {
            headers: {
              "Authorization": `Bearer ${storedToken}`,
            },
            credentials: "include",
          });

          if (response.ok) {
            // Token is valid, use the stored data
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else {
            // Token is invalid/expired, clear the stored data
            setAuthToken(null);
            localStorage.removeItem("safego_user");
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          // Network error, use stored data but mark as potentially stale
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      }
      setIsLoading(false);
    };

    validateSession();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Invalid credentials");
    }

    const data = await response.json();
    
    // Store auth data FIRST before any state updates
    setAuthToken(data.token);
    localStorage.setItem("safego_user", JSON.stringify(data.user));
    
    // Update React state
    setToken(data.token);
    setUser(data.user);

    // Role-based redirect using full page navigation for reliability
    const targetPath = getPostLoginPath(data.user);
    window.location.href = targetPath;
  };

  const signup = async (email: string, password: string, role: string, countryCode: string) => {
    const signupResponse = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, role, countryCode }),
    });

    if (!signupResponse.ok) {
      const error = await signupResponse.json();
      throw new Error(error.error || "Signup failed");
    }

    // Signup successful, now login to get token
    await login(email, password);
  };

  const logout = () => {
    // Send logout audit request to backend (fire-and-forget, don't block logout)
    if (token && user) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
      }).catch(() => {
        // Silent failure - don't block logout even if audit fails
      });
    }
    
    setToken(null);
    setUser(null);
    
    // Clear all localStorage items related to SafeGo
    clearAllLegacyTokens();
    localStorage.removeItem("safego_user");
    localStorage.removeItem("safego_eats_cart");
    localStorage.removeItem("safego_ride_booking");
    
    // Clear all sessionStorage
    sessionStorage.clear();
    
    // Redirect to login page
    setLocation("/auth/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
