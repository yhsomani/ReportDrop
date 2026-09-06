// Razorpay Checkout SDK loader.
//
// The checkout library is intentionally NOT referenced from index.html: keeping
// it out of the static document keeps the CSP tight and avoids loading a
// third-party script on pages that never open the upgrade modal. It is injected
// on demand, exactly once, right before checkout opens.

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const LOAD_TIMEOUT_MS = 30_000;

let scriptPromise: Promise<void> | null = null;

function inject(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      // If the tag is already present but events fired before we attached
      // listeners, finish synchronously when the global is available.
      if (window.Razorpay) {
        resolve();
        return;
      }
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Razorpay checkout failed to load in time.'));
    }, LOAD_TIMEOUT_MS);

    const onLoad = () => {
      cleanup();
      if (window.Razorpay) {
        resolve();
      } else {
        reject(new Error('Razorpay checkout loaded without exposing the SDK.'));
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error('Razorpay checkout script could not be loaded.'));
    };
    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      clearTimeout(timeout);
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);
  });
}

/**
 * Ensures the Razorpay checkout SDK is available, resolving once `window.Razorpay`
 * exists and rejecting on load timeout / network error. Failed loads are not
 * cached: a later call retries the injection (e.g. after the user refreshes).
 */
export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = inject().finally(() => {
      scriptPromise = null;
    });
  }
  return scriptPromise;
}