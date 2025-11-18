/**
 * Frontend environment configuration
 * All variables must be prefixed with VITE_ to be exposed to the client
 */

interface WebEnv {
  apiBase: string;
  wsBase: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

function validateEnv(): WebEnv {
  const apiBase = import.meta.env.VITE_API_BASE;
  const wsBase = import.meta.env.VITE_WS_BASE;

  if (!apiBase) {
    throw new Error('VITE_API_BASE environment variable is required');
  }

  if (!wsBase) {
    throw new Error('VITE_WS_BASE environment variable is required');
  }

  return {
    apiBase,
    wsBase,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}

export const env = validateEnv();
