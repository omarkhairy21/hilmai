/**
 * Get the agent API URL based on environment
 * In development: http://localhost:4111/
 * In production: https://agent.hilm.ai
 */
export function getAgentUrl(): string {
  const isDev = import.meta.env.DEV;
  return isDev ? 'http://localhost:4111' : 'https://agent.hilm.ai';
}
