import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";
type AdminPreset = "default" | "slate" | "ocean" | "forest" | "sunset";
type AccessibilityMode = "normal" | "high-contrast" | "large-text" | "high-contrast-large" | "reduced-motion";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  adminPreset: AdminPreset;
  setAdminPreset: (preset: AdminPreset) => void;
  accessibilityMode: AccessibilityMode;
  setAccessibilityMode: (mode: AccessibilityMode) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "safego-theme";
const ADMIN_PRESET_KEY = "safego-admin-preset";
const ACCESSIBILITY_KEY = "safego-accessibility";
const REDUCED_MOTION_KEY = "safego-reduced-motion";

const PRESET_COLORS: Record<AdminPreset, { primary: string; accent: string }> = {
  default: { primary: "210 92% 45%", accent: "210 15% 90%" },
  slate: { primary: "215 25% 35%", accent: "215 15% 88%" },
  ocean: { primary: "200 80% 45%", accent: "200 30% 88%" },
  forest: { primary: "145 60% 35%", accent: "145 20% 88%" },
  sunset: { primary: "25 85% 50%", accent: "25 30% 90%" },
};

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [adminPreset, setAdminPresetState] = useState<AdminPreset>("default");
  const [accessibilityMode, setAccessibilityModeState] = useState<AccessibilityMode>("normal");
  const [reducedMotion, setReducedMotionState] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      setThemeState(storedTheme);
    }
    const storedPreset = localStorage.getItem(ADMIN_PRESET_KEY);
    if (storedPreset && Object.keys(PRESET_COLORS).includes(storedPreset)) {
      setAdminPresetState(storedPreset as AdminPreset);
    }
    const storedA11y = localStorage.getItem(ACCESSIBILITY_KEY);
    if (storedA11y && ["normal", "high-contrast", "large-text", "high-contrast-large", "reduced-motion"].includes(storedA11y)) {
      setAccessibilityModeState(storedA11y as AccessibilityMode);
    }
    const storedMotion = localStorage.getItem(REDUCED_MOTION_KEY);
    if (storedMotion === "true") {
      setReducedMotionState(true);
    }
    setIsHydrated(true);
  }, []);

  const applyTheme = useCallback((currentTheme: Theme) => {
    if (typeof document === "undefined") return;
    
    const resolved = currentTheme === "system" ? getSystemTheme() : currentTheme;
    setResolvedTheme(resolved);
    
    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }
    applyTheme(newTheme);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  const applyPreset = useCallback((preset: AdminPreset) => {
    if (typeof document === "undefined") return;
    const colors = PRESET_COLORS[preset];
    document.documentElement.style.setProperty("--primary", colors.primary);
    document.documentElement.style.setProperty("--accent", colors.accent);
    document.documentElement.style.setProperty("--ring", colors.primary);
    document.documentElement.style.setProperty("--sidebar-primary", colors.primary);
    document.documentElement.style.setProperty("--sidebar-ring", colors.primary);
  }, []);

  const applyAccessibility = useCallback((mode: AccessibilityMode) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("a11y-high-contrast", "a11y-large-text", "a11y-reduced-motion");
    if (mode === "high-contrast" || mode === "high-contrast-large") {
      root.classList.add("a11y-high-contrast");
    }
    if (mode === "large-text" || mode === "high-contrast-large") {
      root.classList.add("a11y-large-text");
    }
    if (mode === "reduced-motion") {
      root.classList.add("a11y-reduced-motion");
    }
  }, []);

  const applyReducedMotion = useCallback((enabled: boolean) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (enabled) {
      root.classList.add("a11y-reduced-motion");
    } else {
      root.classList.remove("a11y-reduced-motion");
    }
  }, []);

  const setAdminPreset = useCallback((preset: AdminPreset) => {
    setAdminPresetState(preset);
    if (typeof window !== "undefined") {
      localStorage.setItem(ADMIN_PRESET_KEY, preset);
    }
    applyPreset(preset);
  }, [applyPreset]);

  const setAccessibilityMode = useCallback((mode: AccessibilityMode) => {
    setAccessibilityModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACCESSIBILITY_KEY, mode);
    }
    applyAccessibility(mode);
  }, [applyAccessibility]);

  const setReducedMotion = useCallback((enabled: boolean) => {
    setReducedMotionState(enabled);
    if (typeof window !== "undefined") {
      localStorage.setItem(REDUCED_MOTION_KEY, String(enabled));
    }
    applyReducedMotion(enabled);
  }, [applyReducedMotion]);

  useEffect(() => {
    if (!isHydrated) return;
    applyTheme(theme);
    applyPreset(adminPreset);
    applyAccessibility(accessibilityMode);
    applyReducedMotion(reducedMotion);
  }, [theme, adminPreset, accessibilityMode, reducedMotion, isHydrated, applyTheme, applyPreset, applyAccessibility, applyReducedMotion]);

  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme("system");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      resolvedTheme, 
      setTheme, 
      toggleTheme,
      adminPreset,
      setAdminPreset,
      accessibilityMode,
      setAccessibilityMode,
      reducedMotion,
      setReducedMotion
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
