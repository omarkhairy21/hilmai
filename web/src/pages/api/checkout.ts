import type { APIRoute } from 'astro';

export const prerender = false;

interface CheckoutRequest {
  planTier: 'monthly' | 'annual';
  successUrl: string;
  cancelUrl: string;
  includeTrial: boolean;
}

interface CheckoutResponse {
  url?: string;
  error?: string;
}

function isValidPlanTier(planTier: string): planTier is 'monthly' | 'annual' {
  return planTier === 'monthly' || planTier === 'annual';
}

export const POST: APIRoute = async (context) => {
  try {
    // Get request body safely
    const contentType = context.request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const text = await context.request.text();
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Request body is empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { planTier, successUrl: _successUrl, cancelUrl, includeTrial } = body as CheckoutRequest;

    // Override successUrl to always redirect to success page
    // The session_id will be appended by Stripe as query param
    const baseUrl = new URL(context.request.url).origin;
    const successUrl = `${baseUrl}/success`;

    console.log('[api:checkout] Request received:', {
      planTier,
      successUrl,
      cancelUrl,
      includeTrial,
    });

    // Validation
    if (!planTier || !successUrl || !cancelUrl) {
      console.warn('[api:checkout] Missing required fields:', {
        planTier: !planTier,
        successUrl: !successUrl,
        cancelUrl: !cancelUrl,
      });
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidPlanTier(planTier)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid plan tier',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call agent backend
    const agentUrl = import.meta.env.AGENT_API_URL || 'http://localhost:4111';

    let response: Response;
    try {
      response = await fetch(`${agentUrl}/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planTier,
          successUrl,
          cancelUrl,
          includeTrial: includeTrial ?? false,
        }),
      });
     } catch (fetchError) {
      console.error('Failed to reach agent backend:', fetchError);
      return new Response(
        JSON.stringify({
          error: `Failed to reach checkout service at ${agentUrl}`,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let data: CheckoutResponse;
    try {
      data = (await response.json()) as CheckoutResponse;
      console.log('data from checkout', data);
    } catch (jsonError) {
      console.error('Invalid JSON response from agent:', jsonError);
      const responseText = await response.text();
      console.error('Response text:', responseText);
      return new Response(
        JSON.stringify({
          error: 'Invalid response from checkout service',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data.error || 'Failed to create checkout session',
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ url: data.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
