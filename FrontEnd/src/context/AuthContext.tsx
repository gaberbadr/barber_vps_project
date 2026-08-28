import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { clearTokens, loadTokens, saveTokens } from '../api/axiosInstance';
import { logout as apiLogout, revokeRefresh, TokenResponseDTO } from '../api/auth.api';

// ─── Interfaces ───────────────────────────────────────────────
export interface PendingBooking {
  barberId: string | number;
  bookingDate: string;
  startTime: string;
  serviceIds: (string | number)[];
  couponCode?: string;
}

export interface AuthContextValue {
  tokens: TokenResponseDTO | null;
  isAuthenticated: boolean;
  userRole: string | null;
  isLoggingOut: boolean;
  handleLoginSuccess: (tokenData: TokenResponseDTO) => void;
  handleLogout: () => Promise<void>;
  updateProfilePictureUrl: (newUrl: string) => void;
}

// ─── Context ──────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<TokenResponseDTO | null>(() => loadTokens());
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isAuthenticated = Boolean(tokens?.accessToken);

  /** Extract role from JWT token */
  const userRole = useMemo(() => {
    if (!tokens?.accessToken) return null;
    try {
      const payloadBase64 = tokens.accessToken.split('.')[1];
      const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const decoded = JSON.parse(decodedJson);
      // ASP.NET Core uses this specific claim for roles by default
      return decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || decoded.role || null;
    } catch (e) {
      console.error('Failed to parse JWT payload', e);
      return null;
    }
  }, [tokens?.accessToken]);

  /**
   * Called after successful OTP verification or Google OAuth callback.
   * Decodes the role directly from the JWT (no React state needed) and
   * navigates straight to the role-specific dashboard — avoids the race
   * condition where DashboardRouter reads a still-null userRole.
   */
  const handleLoginSuccess = useCallback((tokenData: TokenResponseDTO) => {
    saveTokens(tokenData);
    setTokens(tokenData);

    console.log('[AUTH DEBUG] handleLoginSuccess called');
    console.log('[AUTH DEBUG] accessToken exists:', !!tokenData.accessToken);
    console.log('[AUTH DEBUG] refreshToken exists:', !!tokenData.refreshToken);
    console.log('[AUTH DEBUG] tokenData keys:', Object.keys(tokenData));

    // ── Decode role synchronously from the JWT payload ──
    let role: string | null = null;
    try {
      const payloadBase64 = tokenData.accessToken.split('.')[1];
      const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
      console.log('[AUTH DEBUG] JWT decoded payload:', decoded);
      role = (
        decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        decoded.role ||
        null
      );
      if (typeof role === 'string') role = role.toLowerCase();
    } catch (e) {
      console.log('[AUTH DEBUG] JWT decode error:', e);
      // malformed JWT — fall through to default
    }

    console.log('[AUTH DEBUG] decoded role:', role);

    // ── Check for pending booking (customer fast-path) ──
    const pendingBookingRaw = sessionStorage.getItem('pendingBooking');
    if (pendingBookingRaw) {
      try {
        const pendingBooking: PendingBooking = JSON.parse(pendingBookingRaw);
        if (pendingBooking.barberId) {
          navigate(`/barbers/${pendingBooking.barberId}/book`, { replace: true });
          return;
        }
      } catch {
        // ignore parse errors
      }
    }

    // ── Navigate to the correct dashboard based on role ──
    if (role === 'admin')  { console.log('[AUTH DEBUG] navigating to /admin');    navigate('/admin',    { replace: true }); return; }
    if (role === 'spector') { console.log('[AUTH DEBUG] navigating to /spector'); navigate('/spector', { replace: true }); return; }
    if (role === 'barber') { console.log('[AUTH DEBUG] navigating to /barber');   navigate('/barber',   { replace: true }); return; }

    // Default → customer bookings
    console.log('[AUTH DEBUG] navigating to /bookings (default)');
    navigate('/bookings', { replace: true });
  }, [navigate]);

  /**
   * Full logout:
   *  1. Revoke the refresh token on the server
   *  2. Call /api/Auth/logout
   *  3. Clear local storage & state → redirect to /auth
   */
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      const currentTokens = loadTokens();
      if (currentTokens?.refreshToken) {
        await revokeRefresh(currentTokens.refreshToken).catch(() => {});
      }
      await apiLogout().catch(() => {});
    } finally {
      clearTokens();
      setTokens(null);
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  /**
   * Listen for the global `auth:expired` event fired by the
   * Axios interceptor when token refresh fails.
   */
  useEffect(() => {
    const onExpired = () => {
      clearTokens();
      setTokens(null);
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [navigate]);

  /**
   * Update the user's profile picture URL in context and local storage
   */
  const updateProfilePictureUrl = useCallback((newUrl: string) => {
    setTokens((prev) => {
      if (!prev) return prev;
      const updated: TokenResponseDTO = { ...prev, profilePictureUrl: newUrl };
      saveTokens(updated);
      return updated;
    });
  }, []);

  // ── Context value ────────────────────────────────────────────
  const value = useMemo(
    () => ({
      tokens,
      isAuthenticated,
      userRole,
      isLoggingOut,
      handleLoginSuccess,
      handleLogout,
      updateProfilePictureUrl,
    }),
    [tokens, isAuthenticated, userRole, isLoggingOut, handleLoginSuccess, handleLogout, updateProfilePictureUrl]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
