class ApiError extends Error {
  constructor(message, { status, data, path }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.path = path;
  }
}

export function createApiClient(token = "") {
  function createQueryString(params = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      searchParams.set(key, String(value));
    });

    const query = searchParams.toString();
    return query ? `?${query}` : "";
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const hasBody = options.body !== undefined;

    if (hasBody && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const data = raw
      ? contentType.includes("application/json")
        ? JSON.parse(raw)
        : raw
      : null;

    if (!response.ok) {
      const message =
        typeof data === "object" && data && "error" in data
          ? data.error
          : typeof data === "string" && data.trim().startsWith("<!DOCTYPE")
            ? `Unexpected HTML response for ${path}. Check service worker caching or route fallback handling.`
            : raw || `Request failed with status ${response.status}`;

      throw new ApiError(message, { status: response.status, data, path });
    }

    return data;
  }

  async function download(path) {
    const response = await fetch(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Download failed with status ${response.status}`);
    }

    return response.blob();
  }

  return {
    request,
    login: (credentials) => request("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
    registerUser: (payload) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
    forgotPassword: (payload) => request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(payload) }),
    resetPassword: (payload) => request("/api/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
    changePassword: (payload) => request("/api/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
    getCurrentUser: () => request("/api/auth/me"),
    getUsers: () => request("/api/auth/users"),
    getGroups: () => request("/api/groups"),
    createGroup: (payload) => request("/api/groups", { method: "POST", body: JSON.stringify(payload) }),
    assignGroupMember: (groupId, payload) => request(`/api/groups/${groupId}/members`, { method: "POST", body: JSON.stringify(payload) }),
    getCampaigns: () => request("/api/campaigns"),
    createCampaign: (payload) => request("/api/campaigns", { method: "POST", body: JSON.stringify(payload) }),
    updateCampaign: (campaignId, payload) => request(`/api/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(payload) }),
    updateCampaignFixedContribution: (campaignId, fixedContributionAmount) => request(`/api/campaigns/${campaignId}/fixed-amount`, { method: "PATCH", body: JSON.stringify({ fixedContributionAmount }) }),
    updateCampaignStatus: (campaignId, status) => request(`/api/campaigns/${campaignId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    getContributors: (campaignId) => request(`/api/contributors/${campaignId}`),
    getTransactions: (campaignId) => request(`/api/transactions/${campaignId}`),
    previewContributionAllocation: (payload) => request("/api/transactions/preview-allocation", { method: "POST", body: JSON.stringify(payload) }),
    deleteTransaction: (transactionId, payload) => request(`/api/transactions/${transactionId}`, { method: "DELETE", body: JSON.stringify(payload) }),
    getPaymentMethods: (campaignId) => request(`/api/payment-methods/campaign/${campaignId}`),
    createPaymentMethod: (payload) => request("/api/payment-methods", { method: "POST", body: JSON.stringify(payload) }),
    getConfirmations: (campaignId, status = "pending") => request(`/api/confirmations?campaignId=${campaignId}&status=${status}`),
    parseTransaction: (payload) => request("/api/parse", { method: "POST", body: JSON.stringify(payload) }),
    createManualTransaction: (payload) => request("/api/transactions/manual", { method: "POST", body: JSON.stringify(payload) }),
    approveConfirmation: (confirmationId, payload) => request(`/api/confirmations/${confirmationId}/approve`, { method: "POST", body: JSON.stringify(payload) }),
    rejectConfirmation: (confirmationId, payload) => request(`/api/confirmations/${confirmationId}/reject`, { method: "POST", body: JSON.stringify(payload) }),
    discardConfirmation: (confirmationId) => request(`/api/confirmations/${confirmationId}`, { method: "DELETE" }),
    getSummary: (campaignId, options = {}) => request(`/api/summary/${campaignId}/whatsapp${createQueryString(options)}`),
    downloadContributorsCsv: (campaignId) => download(`/api/reports/${campaignId}/contributors.csv`),
    downloadStatementExcel: (campaignId) => download(`/api/reports/${campaignId}/statement.xlsx`),
    downloadStatementPdf: (campaignId) => download(`/api/reports/${campaignId}/statement.pdf`),
  };
}