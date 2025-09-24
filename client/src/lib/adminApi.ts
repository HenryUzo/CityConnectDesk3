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

// Admin API interface with all endpoints
export const AdminAPI = {
  auth: {
    setup: async (data: any) => {
      return adminApiRequest('POST', '/api/admin/setup', data);
    },
    login: async (data: any) => {
      return adminApiRequest('POST', '/api/admin/auth/login', data);
    },
    refresh: async (data: any) => {
      return adminApiRequest('POST', '/api/admin/auth/refresh', data);
    },
    logout: async () => {
      return adminApiRequest('POST', '/api/admin/auth/logout');
    },
  },

  dashboard: {
    getStats: async () => {
      return adminApiRequest('GET', '/api/admin/dashboard/stats');
    },
  },

  users: {
    getAll: async (params?: any) => {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return adminApiRequest('GET', `/api/admin/users${queryString}`);
    },
    create: async (data: any) => {
      return adminApiRequest('POST', '/api/admin/users', data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest('PATCH', `/api/admin/users/${id}`, data);
    },
  },

  providers: {
    getAll: async (params?: any) => {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return adminApiRequest('GET', `/api/admin/providers${queryString}`);
    },
    create: async (data: any) => {
      return adminApiRequest('POST', '/api/admin/providers', data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest('PATCH', `/api/admin/providers/${id}`, data);
    },
  },

  estates: {
    getAll: async () => {
      return adminApiRequest('GET', '/api/admin/estates');
    },
    create: async (data: any) => {
      return adminApiRequest('POST', '/api/admin/estates', data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest('PATCH', `/api/admin/estates/${id}`, data);
    },
  },

  categories: {
    getAll: async () => {
      return adminApiRequest('GET', '/api/admin/categories');
    },
    create: async (data: any) => {
      return adminApiRequest('POST', '/api/admin/categories', data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest('PATCH', `/api/admin/categories/${id}`, data);
    },
  },

  marketplace: {
    getAll: async (params?: any) => {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return adminApiRequest('GET', `/api/admin/marketplace${queryString}`);
    },
    create: async (data: any) => {
      return adminApiRequest('POST', '/api/admin/marketplace', data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest('PATCH', `/api/admin/marketplace/${id}`, data);
    },
  },

  orders: {
    getAll: async (params?: any) => {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return adminApiRequest('GET', `/api/admin/orders${queryString}`);
    },
    getAnalytics: async () => {
      return adminApiRequest('GET', '/api/admin/orders/analytics/stats');
    },
  },

  auditLogs: {
    getAll: async (params?: any) => {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return adminApiRequest('GET', `/api/admin/audit-logs${queryString}`);
    },
  },

  // ============================================================================
  // BRIDGE API ENDPOINTS - Connect Admin System with PostgreSQL Resident/Provider Data
  // ============================================================================
  bridge: {
    // Get service requests from PostgreSQL system
    getServiceRequests: async (params?: {
      status?: string;
      category?: string;
      residentId?: string;
      providerId?: string;
    }) => {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return adminApiRequest('GET', `/api/admin/bridge/service-requests${queryString}`);
    },

    // Get users from PostgreSQL system  
    getUsers: async (params?: {
      role?: string;
      search?: string;
      status?: string;
    }) => {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return adminApiRequest('GET', `/api/admin/bridge/users${queryString}`);
    },

    // Get statistics from PostgreSQL system
    getStats: async () => {
      return adminApiRequest('GET', '/api/admin/bridge/stats');
    },

    // Approve/reject providers in PostgreSQL system
    updateProviderApproval: async (id: string, data: { approved: boolean; reason?: string }) => {
      return adminApiRequest('PATCH', `/api/admin/bridge/providers/${id}/approval`, data);
    },

    // Get user wallet and transactions from PostgreSQL system
    getUserWallet: async (id: string) => {
      return adminApiRequest('GET', `/api/admin/bridge/users/${id}/wallet`);
    },
  },

  health: async () => {
    return adminApiRequest('GET', '/api/admin/health');
  },
};