import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { TokenResponseDTO } from './auth.api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTokens(raw: any): TokenResponseDTO {
  const candidates = [
    raw, raw?.data, raw?.Data, raw?.value, raw?.Value,
    raw?.result, raw?.Result, raw?.payload, raw?.Payload,
  ].filter(Boolean);
  for (const obj of candidates) {
    const accessToken = obj?.accessToken || obj?.AccessToken;
    const refreshToken = obj?.refreshToken || obj?.RefreshToken;
    if (accessToken && refreshToken) {
      return {
        accessToken,
        accessTokenExpiresAt: obj.accessTokenExpiresAt || obj.AccessTokenExpiresAt || '',
        refreshToken,
        refreshTokenExpiresAt: obj.refreshTokenExpiresAt || obj.RefreshTokenExpiresAt || '',
        profilePictureUrl: obj.profilePictureUrl || obj.ProfilePictureUrl,
      };
    }
  }
  throw new Error('Unrecognized refresh token response: ' + JSON.stringify(raw));
}

// ─── Token helpers ─────────────────────────────────────────────
const TOKEN_KEY = 'barber_tokens';

export const saveTokens = (tokenData: TokenResponseDTO): void => {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
  } catch {
    // storage unavailable (private mode, etc.)
  }
};

export const loadTokens = (): TokenResponseDTO | null => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearTokens = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch { /* noop */ }
};

// ─── Axios Instance ─────────────────────────────────────────────
const axiosInstance = axios.create({
  // Base URL: Centralized point for all API requests
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Request interceptor: attach access token ──────────────────
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const tokens = loadTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

// ── Response interceptor: auto-refresh on 401 ─────────────────
let isRefreshing = false;
let pendingRequests: { resolve: (token: string | null) => void; reject: (error: unknown) => void }[] = [];

const processPendingRequests = (error: unknown, token: string | null = null) => {
  pendingRequests.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingRequests = [];
};

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const is401 = error.response?.status === 401;
    const alreadyRetried = originalRequest._retry;
    const isRefreshEndpoint = originalRequest.url?.includes('/refresh-token');

    if (is401 && !alreadyRetried && !isRefreshEndpoint) {
      if (isRefreshing) {
        // Queue the request until the refresh completes
        return new Promise<string | null>((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        }).then((newToken) => {
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const tokens = loadTokens();
      if (!tokens?.refreshToken) {
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return Promise.reject(error);
      }

      try {
        const { data: rawData } = await axiosInstance.post('/api/Auth/refresh-token', {
          refreshToken: tokens.refreshToken,
        });

        // Normalize PascalCase / camelCase / wrapper patterns
        const data = normalizeTokens(rawData);

        saveTokens(data);
        processPendingRequests(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processPendingRequests(refreshError);
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
