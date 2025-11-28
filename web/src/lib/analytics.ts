/**
 * Google Analytics & Facebook Pixel Event Tracking Utility
 *
 * Provides type-safe wrapper around gtag and fbq for tracking conversion events
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, eventData?: Record<string, string | number | boolean>) {
  // Track Google Analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventData);
  }

  // Track Facebook Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    // Standard Event Mapping for Facebook Optimization
    switch (eventName) {
      case 'click_try_now':
        // 'Lead' is a standard event Facebook optimizes for (Visitor showed interest)
        window.fbq('track', 'Lead'); 
        break;
      
      case 'click_subscribe':
        // 'InitiateCheckout' tells FB this user is starting to pay
        window.fbq('track', 'InitiateCheckout', { 
          content_name: eventData?.plan_type as string,
          currency: 'USD'
        });
        break;

      case 'click_free_trial':
         // 'CompleteRegistration' or 'Lead' is good for signups/trials
        window.fbq('track', 'CompleteRegistration', {
          content_name: eventData?.plan_type as string
        });
        break;
        
      case 'click_view_pricing':
        window.fbq('track', 'ViewContent');
        break;

      default:
        // Fallback to custom event for anything else
        window.fbq('trackCustom', eventName, eventData);
    }
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

  // Main CTA
  clickTryNow: () => {
    trackEvent('click_try_now');
  },

  // Navigation events
  clickViewPricing: () => {
    trackEvent('click_view_pricing');
  }
};
