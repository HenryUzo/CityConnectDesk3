// Centralized Admin API module with auth token management
let currentAdminToken: string | null = null;
let currentEstateId: string | null = null;

export const setAdminToken = (token: string | null) => {
  currentAdminToken = token;
};

export const setCurrentEstate = (estateId: string | null) => {
  currentEstateId = estateId;
};

export const adminApiRequest = async (method: string, endpoint: string, data?: any) => {
  const headers: any = { 'Content-Type': 'application/json' };
  
  if (currentAdminToken) {
    headers['Authorization'] = `Bearer ${currentAdminToken}`;
  }
  
  if (currentEstateId) {
    headers['x-estate-id'] = currentEstateId;
  }

  const config: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };

  if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, config);
  
  // Handle 401 with automatic token refresh
  if (response.status === 401) {
    const refreshTokenValue = sessionStorage.getItem('admin_refresh_token');
    if (refreshTokenValue && currentAdminToken) {
      try {
        const refreshResponse = await fetch('/api/admin/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refreshTokenValue }),
          credentials: 'include',
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setAdminToken(refreshData.accessToken);
          sessionStorage.setItem('admin_refresh_token', refreshData.refreshToken);
          
          // Retry original request with new token
          headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
          const retryResponse = await fetch(endpoint, { ...config, headers });
          if (retryResponse.ok) {
            return retryResponse.json();
          } else {
            // Retry failed, trigger logout
            sessionStorage.removeItem('admin_refresh_token');
            setAdminToken(null);
            window.dispatchEvent(new CustomEvent('admin-auth-failed'));
            throw new Error('Session expired');
          }
        } else {
          // Refresh failed, trigger logout
          sessionStorage.removeItem('admin_refresh_token');
          setAdminToken(null);
          window.dispatchEvent(new CustomEvent('admin-auth-failed'));
          throw new Error('Session expired');
        }
      } catch (refreshError) {
        // Refresh failed, clear storage and trigger logout
        sessionStorage.removeItem('admin_refresh_token');
        setAdminToken(null);
        window.dispatchEvent(new CustomEvent('admin-auth-failed'));
        throw new Error('Session expired');
      }
    } else {
      // No refresh token available, trigger logout
      sessionStorage.removeItem('admin_refresh_token');
      setAdminToken(null);
      window.dispatchEvent(new CustomEvent('admin-auth-failed'));
      throw new Error('Session expired');
    }
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};