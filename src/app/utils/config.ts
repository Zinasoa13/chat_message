export const getEnv = () => (window as any).__env || {
  apiUrl: 'http://localhost:3000'
};

export const API_URL = getEnv().apiUrl;
