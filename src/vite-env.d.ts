/// <reference types="vite/client" />

interface Window {
  HeadlessCheckout?: {
    addToCart: (event: Event, token: string, options: { fallbackUrl: string }) => void;
  };
}
