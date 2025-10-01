// Centralized Admin API module with auth token management
let currentAdminToken: string | null = null;
let currentEstateId: string | null = null;

export const setAdminToken = (token: string | null) => {
  currentAdminToken = token;
};

export const setCurrentEstate = (estateId: string | null) => {
  currentEstateId = estateId;
};

export const adminApiRequest = async (
  method: string,
  endpoint: string,
  data?: any,
) => {
  const headers: Record<string, any> = {
    Authorization: `Bearer ${sessionStorage.getItem("admin_access_token")}`,
  };

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  if (currentEstateId) {
    headers["x-estate-id"] = currentEstateId;
  }

  const config: RequestInit = {
    method,
    headers,
    credentials: "include", // <-- critical: ensures cookies go with requests
  };

  if (data && ["POST", "PATCH", "PUT"].includes(method)) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, config);

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// Admin API interface with all endpoints
export const AdminAPI = {
  auth: {
    setup: async (data: any) => {
      return adminApiRequest("POST", "/api/admin/setup", data);
    },
    login: async (data: any) => {
      return adminApiRequest("POST", "/api/admin/auth/login", data);
    },
    refresh: async (data: any) => {
      return adminApiRequest("POST", "/api/admin/auth/refresh", data);
    },
    logout: async () => {
      return adminApiRequest("POST", "/api/admin/auth/logout");
    },
  },

  dashboard: {
    getStats: async () => {
      return adminApiRequest("GET", "/api/admin/stats");
    },
  },

  users: {
    getAll: async (params?: any) => {
      const queryString = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return adminApiRequest("GET", `/api/admin/users${queryString}`);
    },
    create: async (data: any) => {
      return adminApiRequest("POST", "/api/admin/users", data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest("PATCH", `/api/admin/users/${id}`, data);
    },
  },

  providers: {
    getAll: async (params?: any) => {
      const queryString = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return adminApiRequest("GET", `/api/admin/providers${queryString}`);
    },
    create: async (data: any) => {
      return adminApiRequest("POST", "/api/admin/providers", data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest("PATCH", `/api/admin/providers/${id}`, data);
    },
  },

  estates: {
    getAll: async () => {
      return adminApiRequest("GET", "/api/admin/estates");
    },
    create: async (data: any) => {
      return adminApiRequest("POST", "/api/admin/estates", data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest("PATCH", `/api/admin/estates/${id}`, data);
    },
  },

  categories: {
    getAll: async () => {
      return adminApiRequest("GET", "/api/admin/categories");
    },
    create: async (data: any) => {
      return adminApiRequest("POST", "/api/admin/categories", data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest("PATCH", `/api/admin/categories/${id}`, data);
    },
  },

  marketplace: {
    getAll: async (params?: any) => {
      const queryString = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return adminApiRequest("GET", `/api/admin/marketplace${queryString}`);
    },
    create: async (data: any) => {
      return adminApiRequest("POST", "/api/admin/marketplace", data);
    },
    update: async (id: string, data: any) => {
      return adminApiRequest("PATCH", `/api/admin/marketplace/${id}`, data);
    },
  },

  orders: {
    getAll: async (params?: any) => {
      const queryString = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return adminApiRequest("GET", `/api/admin/orders${queryString}`);
    },
    getAnalytics: async () => {
      return adminApiRequest("GET", "/api/admin/orders/analytics/stats");
    },
  },

  auditLogs: {
    getAll: async (params?: any) => {
      const queryString = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return adminApiRequest("GET", `/api/admin/audit-logs${queryString}`);
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
      const queryString = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return adminApiRequest(
        "GET",
        `/api/admin/bridge/service-requests${queryString}`,
      );
    },

    // Get users from PostgreSQL system
    getUsers: async (params?: {
      role?: string;
      search?: string;
      status?: string;
    }) => {
      const queryString = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return adminApiRequest("GET", `/api/admin/bridge/users${queryString}`);
    },

    // Get statistics from PostgreSQL system
    getStats: async () => {
      return adminApiRequest("GET", "/api/admin/bridge/stats");
    },

    // Approve/reject providers in PostgreSQL system
    updateProviderApproval: async (
      id: string,
      data: { approved: boolean; reason?: string },
    ) => {
      return adminApiRequest(
        "PATCH",
        `/api/admin/bridge/providers/${id}/approval`,
        data,
      );
    },

    // Get user wallet and transactions from PostgreSQL system
    getUserWallet: async (id: string) => {
      return adminApiRequest("GET", `/api/admin/bridge/users/${id}/wallet`);
    },
  },

  health: async () => {
    return adminApiRequest("GET", "/api/admin/health");
  },
};
