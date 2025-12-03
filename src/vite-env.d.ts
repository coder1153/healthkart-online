/// <reference types="vite/client" />

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface Razorpay {
  new (options: RazorpayOptions): {
    open: () => void;
    close: () => void;
  };
}

interface Window {
  Razorpay?: Razorpay;
  HeadlessCheckout?: {
    addToCart: (event: Event, token: string, options: { fallbackUrl: string }) => void;
  };
}
