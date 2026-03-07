// ============================================================
// 🦀 Krab — Plugin SDK: Fetch Auth Helper
// Helper for authenticated fetch calls
// ============================================================
export interface FetchAuthOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export function createFetchAuth(options: FetchAuthOptions = {}) {
  const { baseUrl = "", headers = {}, timeout = 30000 } = options;
  
  async function fetchWithAuth(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const url = endpoint.startsWith("http") ? endpoint : baseUrl + endpoint;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...headers,
          ...init.headers,
        },
      });
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  return {
    async get(endpoint: string, params?: Record<string, string>): Promise<Response> {
      const url = params
        ? `${endpoint}?${new URLSearchParams(params).toString()}`
        : endpoint;
      
      return fetchWithAuth(url, { method: "GET" });
    },
    
    async post(endpoint: string, body?: any): Promise<Response> {
      return fetchWithAuth(endpoint, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    
    async put(endpoint: string, body?: any): Promise<Response> {
      return fetchWithAuth(endpoint, {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    
    async delete(endpoint: string): Promise<Response> {
      return fetchWithAuth(endpoint, { method: "DELETE" });
    },
    
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    
    removeHeader(key: string) {
      delete headers[key];
    },
  };
}
