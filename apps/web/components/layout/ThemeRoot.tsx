"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  THEME_MODE_STORAGE_KEY,
  isBrandLockedScreen,
  readStoredThemeMode,
  resolveTheme,
  screenForPathname,
  type Theme,
  type ThemeMode,
} from "../../lib/theme";

type ThemeContextValue = {
  mode: ThemeMode;
  theme: Theme;
  isBrandLocked: boolean;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode debe usarse dentro de <ThemeRoot>");
  return ctx;
}

// Se ejecuta de forma síncrona durante el parseo del HTML, antes de que
// React hidrate — evita el flash del tema por defecto mientras se lee la
// preferencia real de localStorage. Duplica a propósito la lógica mínima
// de lib/theme.ts (no se puede importar un módulo acá, es un string).
const NO_FLASH_SCRIPT = `(function(){try{
  var KEY='${THEME_MODE_STORAGE_KEY}';
  var stored=window.localStorage.getItem(KEY);
  var mode=stored==='light'?'light':'dark';
  var path=window.location.pathname;
  var modules=['/onboarding','/training','/nutrition','/cortisol','/rest','/blindspot','/community','/evolution','/configuracion'];
  var isModule=path==='/'||modules.some(function(base){return path===base||path.indexOf(base+'/')===0;});
  var screen=path==='/login'?'login':(isModule?'module':'dashboard');
  var locked=(screen==='login'||screen==='splash'||screen==='dashboard');
  var theme=locked?'dark-brand':(mode==='light'?'light-premium':'dark-carbon');
  document.getElementById('eph-root').setAttribute('data-theme', theme);
}catch(e){}})();`;

export default function ThemeRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<ThemeMode>("dark");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(readStoredThemeMode());
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
      } catch {
        // localStorage no disponible (modo privado/bloqueado) — el modo
        // sigue funcionando en memoria durante la sesión actual.
      }
      return next;
    });
  }, []);

  const screen = screenForPathname(pathname ?? "/");
  const theme = resolveTheme(screen, mode);
  const isBrandLocked = isBrandLockedScreen(screen);

  // El atributo data-theme se controla de forma imperativa (no como prop de
  // React) para no pelear con el script anti-flash: si React lo manejara
  // como prop reconciliada en la hidratación, podría pisar por un instante
  // el valor real que el script ya dejó escrito antes del primer paint.
  useEffect(() => {
    rootRef.current?.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ mode, theme, isBrandLocked, toggleMode }}>
      <div
        id="eph-root"
        ref={rootRef}
        className="eph-root"
        data-theme="dark-carbon"
        suppressHydrationWarning
      >
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
