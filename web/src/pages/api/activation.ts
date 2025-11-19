import type { APIRoute } from 'astro';
import { getAgentUrl } from '../../lib/agent-config';

export const prerender = false;

interface ActivationRequest {
  sessionId: string;
}

interface ActivationResponse {
  linkCode?: string;
  deepLink?: string;
  error?: string;
}

export const POST: APIRoute = async (context) => {
  try {
    // Validate content type
    const contentType = context.request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use .json() directly to avoid body consumption issues
    let body: ActivationRequest;
    try {
      body = await context.request.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body) {
      return new Response(
        JSON.stringify({ error: 'Request body is empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId } = body;

    // Validate required fields
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[api:activation] Request received:', { sessionId });

    // Call agent backend to generate activation code
    const agentUrl = getAgentUrl();

    let response: Response;
    try {
      response = await fetch(`${agentUrl}/billing/activation-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
    } catch (fetchError) {
      console.error('Failed to reach agent backend:', fetchError);
      return new Response(
        JSON.stringify({
          error: `Failed to reach activation service at ${agentUrl}`,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let data: ActivationResponse;
    try {
      data = (await response.json()) as ActivationResponse;
      console.log('[api:activation] Response from backend:', {
        linkCode: data.linkCode,
        hasDeepLink: !!data.deepLink,
      });
    } catch (jsonError) {
      console.error('Invalid JSON response from agent:', jsonError);
      const responseText = await response.text();
      console.error('Response text:', responseText);
      return new Response(
        JSON.stringify({
          error: 'Invalid response from activation service',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data.error || 'Failed to create activation code',
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!data.linkCode || !data.deepLink) {
      return new Response(
        JSON.stringify({
          error: 'Invalid response: missing activation code or deep link',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        linkCode: data.linkCode,
        deepLink: data.deepLink,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Activation error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
