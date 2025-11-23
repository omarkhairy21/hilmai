/**
 * Google Analytics Event Tracking Utility
 *
 * Provides type-safe wrapper around gtag for tracking conversion events
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, eventData?: Record<string, string | number | boolean>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventData);
  }
}

// Conversion funnel events
export const conversionEvents = {
  // Pricing page events
  togglePricingPeriod: (period: 'monthly' | 'annual') => {
    trackEvent('toggle_pricing_period', { period });
  },

  // Subscription events
  clickSubscribe: (planType: string, period: 'monthly' | 'annual') => {
    trackEvent('click_subscribe', { plan_type: planType, period });
  },

  clickFreeTrial: (planType: string, period: 'monthly' | 'annual') => {
    trackEvent('click_free_trial', { plan_type: planType, period });
  },

  // Navigation events
  clickViewPricing: () => {
    trackEvent('click_view_pricing');
  }
};
