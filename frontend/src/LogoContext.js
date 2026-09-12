import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "./api";
import placeholderLogo from "./assets/placeholder-logo.svg";

const LogoContext = createContext({
  logoSrc: placeholderLogo,
  hasCustomLogo: false,
  refreshLogo: () => {},
});

export function LogoProvider({ children }) {
  const [logoSrc, setLogoSrc] = useState(placeholderLogo);
  const [hasCustomLogo, setHasCustomLogo] = useState(false);

  const refreshLogo = useCallback(async () => {
    try {
      const { data } = await api.get("/branding");
      if (data.has_custom_logo) {
        setLogoSrc(`/api/branding/logo?v=${data.version}`);
        setHasCustomLogo(true);
      } else {
        setLogoSrc(placeholderLogo);
        setHasCustomLogo(false);
      }
    } catch {
      setLogoSrc(placeholderLogo);
      setHasCustomLogo(false);
    }
  }, []);

  useEffect(() => { refreshLogo(); }, [refreshLogo]);

  return (
    <LogoContext.Provider value={{ logoSrc, hasCustomLogo, refreshLogo }}>
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo() {
  return useContext(LogoContext);
}
