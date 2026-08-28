import axiosInstance from './axiosInstance';

export interface TokenResponseDTO {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  profilePictureUrl?: string;
}

export interface SendCodeRequest {
  email: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Step 1 – Request OTP
 * POST /api/Auth/send-verification-code
 */
export const sendVerificationCode = async (email: string): Promise<void> => {
  await axiosInstance.post('/api/Auth/send-verification-code', { email });
};

/**
 * Extracts token fields from any common ASP.NET response shape:
 * - Direct camelCase:  { accessToken, refreshToken, ... }
 * - Direct PascalCase: { AccessToken, RefreshToken, ... }
 * - Wrapped in data:   { data: { accessToken | AccessToken, ... } }
 * - Wrapped in value:  { value: { ... } }
 * - Wrapped in result: { result: { ... } }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTokens(raw: any): TokenResponseDTO {
  // Try to find the actual token object (handle wrappers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates: any[] = [
    raw,
    raw?.data,
    raw?.Data,
    raw?.value,
    raw?.Value,
    raw?.result,
    raw?.Result,
    raw?.payload,
    raw?.Payload,
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

  // Nothing matched — log everything for diagnosis
  console.error('[AUTH] Could not extract tokens from response. Full response:', JSON.stringify(raw));
  throw new Error('Unrecognized token response structure from server.');
}

/**
 * Step 2 – Verify OTP → receive tokens
 * POST /api/Auth/verify-code
 */
export const verifyCode = async (email: string, code: string): Promise<TokenResponseDTO> => {
  const { data } = await axiosInstance.post('/api/Auth/verify-code', { email, code });
  console.log('[AUTH DEBUG] verifyCode raw response:', JSON.stringify(data));
  return extractTokens(data);
};

/**
 * Google OAuth redirect URL
 * GET /api/Auth/google-login?returnUrl={encodedCallbackUrl}
 */
export const getGoogleLoginUrl = (returnUrl: string): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  // If baseUrl is relative '/api', window.location.origin is assumed for full URL if needed
  return `${baseUrl}/Auth/google-login?returnUrl=${encodeURIComponent(returnUrl)}`;
};

/**
 * Refresh access token
 * POST /api/Auth/refresh-token
 */
export const refreshToken = async (refreshTokenValue: string): Promise<TokenResponseDTO> => {
  const { data } = await axiosInstance.post('/api/Auth/refresh-token', { refreshToken: refreshTokenValue });
  // Normalize: handle both camelCase and PascalCase from ASP.NET backend
  return {
    accessToken: data.accessToken || data.AccessToken || '',
    accessTokenExpiresAt: data.accessTokenExpiresAt || data.AccessTokenExpiresAt || '',
    refreshToken: data.refreshToken || data.RefreshToken || '',
    refreshTokenExpiresAt: data.refreshTokenExpiresAt || data.RefreshTokenExpiresAt || '',
    profilePictureUrl: data.profilePictureUrl || data.ProfilePictureUrl,
  };
};

/**
 * Revoke refresh token
 * POST /api/Auth/revoke-refresh
 */
export const revokeRefresh = async (refreshTokenValue: string): Promise<void> => {
  await axiosInstance.post('/api/Auth/revoke-refresh', { refreshToken: refreshTokenValue });
};

/**
 * Logout (invalidates server-side session)
 * POST /api/Auth/logout
 * Authorization header is auto-attached by axiosInstance interceptor
 */
export const logout = async (): Promise<void> => {
  await axiosInstance.post('/api/Auth/logout');
};

/**
 * Upload/Update Profile Picture
 * PUT /api/Auth/me/profile-picture
 */
export const uploadProfilePicture = async (file: File): Promise<void> => {
  const formData = new FormData();
  formData.append('File', file);
  await axiosInstance.put('/api/Auth/me/profile-picture', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * Delete Profile Picture
 * DELETE /api/Auth/me/profile-picture
 */
export const deleteProfilePicture = async (): Promise<void> => {
  await axiosInstance.delete('/api/Auth/me/profile-picture');
};
