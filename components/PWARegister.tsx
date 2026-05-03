"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registrado:", registration.scope);
        })
        .catch((error) => {
          console.error("Error registrando Service Worker:", error);
        });
    });
  }, []);

  return null;
}
