import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "../services/api";
import { displayPersonName } from "../utils/formatting";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => localStorage.getItem("croms_token") || "");
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [activityLog, setActivityLog] = useState("CrOMS React console ready.");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("croms_theme") || "light");
  const [notice, setNotice] = useState(null);
  const [confirmationDialog, setConfirmationDialog] = useState(null);
  const confirmationResolverRef = useRef(null);
  const [summaryOptions, setSummaryOptions] = useState({
    headerText: "",
    additionalInfo: "",
    includeTarget: true,
    includeDeficit: true,
  });

  const api = useMemo(() => createApiClient(token), [token]);

  function log(title, payload) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    setActivityLog(`${title}\n${text}`);
  }

  function getErrorMessage(error, fallback = "An unexpected error occurred.") {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    return fallback;
  }

  function showNotice(nextNotice) {
    setNotice(nextNotice);
  }

  function clearNotice() {
    setNotice(null);
  }

  function requestConfirmation(options) {
    setConfirmationDialog({
      title: options.title || "Confirm action",
      message: options.message || "Please confirm this action.",
      details: options.details || [],
      confirmLabel: options.confirmLabel || "Confirm",
      cancelLabel: options.cancelLabel || "Cancel",
      tone: options.tone || "default",
    });

    return new Promise((resolve) => {
      confirmationResolverRef.current = resolve;
    });
  }

  function resolveConfirmation(confirmed) {
    if (confirmationResolverRef.current) {
      confirmationResolverRef.current(confirmed);
      confirmationResolverRef.current = null;
    }

    setConfirmationDialog(null);
  }

  const coreEnabled = Boolean(token);
  const campaignEnabled = Boolean(token && selectedCampaignId);

  const userQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: () => api.getCurrentUser(),
    enabled: coreEnabled,
  });

  const isAdmin = userQuery.data?.role === "admin";

  const groupsQuery = useQuery({
    queryKey: ["groups", token],
    queryFn: () => api.getGroups(),
    enabled: coreEnabled,
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", token],
    queryFn: () => api.getCampaigns(),
    enabled: coreEnabled,
  });

  const usersQuery = useQuery({
    queryKey: ["users", token],
    queryFn: () => api.getUsers(),
    enabled: coreEnabled && isAdmin,
  });

  const contributorsQuery = useQuery({
    queryKey: ["contributors", selectedCampaignId, token],
    queryFn: () => api.getContributors(selectedCampaignId),
    enabled: campaignEnabled,
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", selectedCampaignId, token],
    queryFn: () => api.getTransactions(selectedCampaignId),
    enabled: campaignEnabled,
  });

  const paymentMethodsQuery = useQuery({
    queryKey: ["payment-methods", selectedCampaignId, token],
    queryFn: () => api.getPaymentMethods(selectedCampaignId),
    enabled: campaignEnabled,
  });

  const confirmationsQuery = useQuery({
    queryKey: ["confirmations", selectedCampaignId, token],
    queryFn: () => api.getConfirmations(selectedCampaignId),
    enabled: campaignEnabled,
  });

  const summaryQuery = useQuery({
    queryKey: ["summary", selectedCampaignId, summaryOptions, token],
    queryFn: () => api.getSummary(selectedCampaignId, summaryOptions),
    enabled: campaignEnabled,
  });

  const groups = groupsQuery.data || [];
  const campaigns = campaignsQuery.data || [];
  const users = usersQuery.data || [];
  const contributors = contributorsQuery.data || [];
  const transactions = transactionsQuery.data || [];
  const paymentMethods = paymentMethodsQuery.data || [];
  const confirmations = confirmationsQuery.data || [];
  const user = userQuery.data || null;
  const summaryText = summaryQuery.data?.summary || "Select a campaign to load the WhatsApp summary.";
  const bootstrapped = !token || (userQuery.isSuccess && groupsQuery.isSuccess && campaignsQuery.isSuccess && (isAdmin ? usersQuery.isSuccess : true));

  async function refreshCoreData(campaignId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["groups"] }),
      queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
    ]);

    if (campaignId) {
      setSelectedCampaignId(campaignId);
      await refreshCampaignDetails(campaignId);
    }
  }

  async function refreshCampaignDetails(campaignId = selectedCampaignId) {
    if (!campaignId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contributors", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["transactions", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["payment-methods", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["confirmations", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["summary", campaignId] }),
    ]);
  }

  async function loadSummary(campaignId = selectedCampaignId, options = summaryOptions) {
    if (!campaignId) {
      return null;
    }

    if (campaignId !== selectedCampaignId) {
      setSelectedCampaignId(campaignId);
    }

    const nextOptions = { ...summaryOptions, ...options };
    setSummaryOptions(nextOptions);

    return queryClient.fetchQuery({
      queryKey: ["summary", campaignId, nextOptions, token],
      queryFn: () => api.getSummary(campaignId, nextOptions),
    });
  }

  function ensureReviewDraft(item) {
    return reviewDrafts[item.id] || {
      contributorId: item.suggested_contributor_id || "",
      displayName: item.proposed_display_name || item.parsed_sender_name,
      identityType: item.proposed_identity_type || item.suggested_identity_type || "individual",
      rejectionReason: item.review_reason || "",
    };
  }

  function updateReviewDraft(id, field, value) {
    setReviewDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [field]: value,
      },
    }));
  }

  const loginMutation = useMutation({
    mutationFn: (credentials) => api.login(credentials),
  });

  async function login(credentials) {
    const response = await loginMutation.mutateAsync(credentials);
    localStorage.setItem("croms_token", response.token);
    setToken(response.token);
    log("Login success", response.user);
    return response;
  }

  function logout(preserveNotice = false) {
    localStorage.removeItem("croms_token");
    setToken("");
    setReviewDrafts({});
    setSelectedCampaignId("");
    if (!preserveNotice) {
      clearNotice();
    }
    queryClient.clear();
    log("Logged out", "Session cleared.");
  }

  const createUserMutation = useMutation({ mutationFn: (payload) => api.registerUser(payload) });
  const forgotPasswordMutation = useMutation({ mutationFn: (payload) => api.forgotPassword(payload) });
  const resetPasswordMutation = useMutation({ mutationFn: (payload) => api.resetPassword(payload) });
  const changePasswordMutation = useMutation({ mutationFn: (payload) => api.changePassword(payload) });
  const createGroupMutation = useMutation({ mutationFn: (payload) => api.createGroup(payload) });
  const createCampaignMutation = useMutation({ mutationFn: (payload) => api.createCampaign(payload) });
  const assignMemberMutation = useMutation({ mutationFn: ({ groupId, payload }) => api.assignGroupMember(groupId, payload) });
  const addPaymentMethodMutation = useMutation({ mutationFn: (payload) => api.createPaymentMethod(payload) });
  const parseTransactionMutation = useMutation({ mutationFn: (payload) => api.parseTransaction(payload) });
  const createManualTransactionMutation = useMutation({ mutationFn: (payload) => api.createManualTransaction(payload) });
  const approveConfirmationMutation = useMutation({ mutationFn: ({ confirmationId, payload }) => api.approveConfirmation(confirmationId, payload) });
  const rejectConfirmationMutation = useMutation({ mutationFn: ({ confirmationId, payload }) => api.rejectConfirmation(confirmationId, payload) });
  const updateCampaignStatusMutation = useMutation({ mutationFn: ({ campaignId, status }) => api.updateCampaignStatus(campaignId, status) });
  const deleteTransactionMutation = useMutation({ mutationFn: ({ transactionId, payload }) => api.deleteTransaction(transactionId, payload) });

  const loading = [
    userQuery.isLoading,
    groupsQuery.isLoading,
    campaignsQuery.isLoading,
    usersQuery.isLoading,
    contributorsQuery.isLoading,
    transactionsQuery.isLoading,
    paymentMethodsQuery.isLoading,
    confirmationsQuery.isLoading,
    summaryQuery.isLoading,
    loginMutation.isPending,
    createUserMutation.isPending,
    forgotPasswordMutation.isPending,
    resetPasswordMutation.isPending,
    changePasswordMutation.isPending,
    createGroupMutation.isPending,
    createCampaignMutation.isPending,
    assignMemberMutation.isPending,
    addPaymentMethodMutation.isPending,
    parseTransactionMutation.isPending,
    createManualTransactionMutation.isPending,
    approveConfirmationMutation.isPending,
    rejectConfirmationMutation.isPending,
    updateCampaignStatusMutation.isPending,
    deleteTransactionMutation.isPending,
  ].some(Boolean);

  async function createUser(payload) {
    const response = await createUserMutation.mutateAsync(payload);
    log("User created", response);
    await refreshCoreData();
    return response;
  }

  async function forgotPassword(payload) {
    const response = await forgotPasswordMutation.mutateAsync(payload);
    log("Reset token generated", response);
    return response;
  }

  async function resetPassword(payload) {
    const response = await resetPasswordMutation.mutateAsync(payload);
    log("Password reset", response);
    return response;
  }

  async function changePassword(payload) {
    const response = await changePasswordMutation.mutateAsync(payload);
    log("Password changed", response);
    return response;
  }

  async function createGroup(payload) {
    const response = await createGroupMutation.mutateAsync(payload);
    log("Group created", response);
    await refreshCoreData();
    return response;
  }

  async function createCampaign(payload) {
    const response = await createCampaignMutation.mutateAsync(payload);
    log("Campaign created", response);
    await refreshCoreData(response.id);
    return response;
  }

  async function assignMember(groupId, payload) {
    const response = await assignMemberMutation.mutateAsync({ groupId, payload });
    log("Group member assigned", response);
    await refreshCoreData();
    return response;
  }

  async function addPaymentMethod(payload) {
    const response = await addPaymentMethodMutation.mutateAsync(payload);
    log("Payment method saved", response);
    await refreshCampaignDetails(payload.campaignId);
    await loadSummary(payload.campaignId, summaryOptions);
    return response;
  }

  async function parseTransaction(payload) {
    try {
      const response = await parseTransactionMutation.mutateAsync(payload);
      log(response.status === "queued" ? "Transaction queued for review" : "Transaction parsed and stored", response);
      await refreshCoreData(payload.campaignId);
      if (response.status === "saved") {
        await loadSummary(payload.campaignId, summaryOptions);
      }
      return response;
    } catch (error) {
      if (error && typeof error === "object" && error.status === 409) {
        const response = {
          status: "duplicate",
          error: error.message,
          duplicate: error.data?.duplicate || null,
        };
        log("Duplicate transaction ignored", response);
        showNotice({
          tone: "error",
          title: "Duplicate transaction",
          message: error.message,
        });
        await refreshCampaignDetails(payload.campaignId);
        return response;
      }

      const message = getErrorMessage(error, "Unknown parse error");
      log("Parse failed", message);
      showNotice({ tone: "error", title: "Parse failed", message });
      return { status: "error", error: message };
    }
  }

  async function createManualTransaction(payload) {
    const response = await createManualTransactionMutation.mutateAsync(payload);
    log("Manual contribution stored", response);
    await refreshCoreData(payload.campaignId);
    await loadSummary(payload.campaignId, summaryOptions);
    return response;
  }

  async function approveConfirmation(item, draft) {
    const response = await approveConfirmationMutation.mutateAsync({
      confirmationId: item.id,
      payload: {
        contributorId: draft.contributorId || undefined,
        displayName: draft.displayName || undefined,
        identityType: draft.identityType || undefined,
      },
    });
    log("Confirmation approved", response);
    await refreshCoreData(item.campaign_id);
    await loadSummary(item.campaign_id, summaryOptions);
    return response;
  }

  async function rejectConfirmation(item, draft) {
    const response = await rejectConfirmationMutation.mutateAsync({
      confirmationId: item.id,
      payload: { reason: draft.rejectionReason || undefined },
    });
    log("Confirmation rejected", response);
    await refreshCoreData(item.campaign_id);
    return response;
  }

  async function updateCampaignStatus(campaignId, status) {
    const response = await updateCampaignStatusMutation.mutateAsync({ campaignId, status });
    log("Campaign status updated", response);
    await refreshCoreData(campaignId);
    return response;
  }

  async function deleteTransaction(transactionId, currentPassword) {
    const response = await deleteTransactionMutation.mutateAsync({ transactionId, payload: { currentPassword } });
    log("Transaction deleted", response);
    await refreshCampaignDetails(response.campaignId || selectedCampaignId);
    await loadSummary(response.campaignId || selectedCampaignId, summaryOptions);
    showNotice({ tone: "success", title: "Transaction deleted", message: "The transaction was removed from the report and database." });
    return response;
  }

  async function downloadContributorsCsv(campaignId = selectedCampaignId) {
    if (!campaignId) {
      throw new Error("Select a campaign before exporting reports.");
    }

    const blob = await api.downloadContributorsCsv(campaignId);
    triggerBrowserDownload(blob, `campaign-${campaignId}-contributors.csv`);
    log("CSV export ready", { campaignId, file: `campaign-${campaignId}-contributors.csv` });
  }

  async function downloadStatementExcel(campaignId = selectedCampaignId) {
    if (!campaignId) {
      throw new Error("Select a campaign before exporting reports.");
    }

    const blob = await api.downloadStatementExcel(campaignId);
    triggerBrowserDownload(blob, `campaign-${campaignId}-statement.xlsx`);
    log("Excel statement ready", { campaignId, file: `campaign-${campaignId}-statement.xlsx` });
  }

  async function downloadStatementPdf(campaignId = selectedCampaignId) {
    if (!campaignId) {
      throw new Error("Select a campaign before exporting reports.");
    }

    const blob = await api.downloadStatementPdf(campaignId);
    triggerBrowserDownload(blob, `campaign-${campaignId}-statement.pdf`);
    log("PDF statement ready", { campaignId, file: `campaign-${campaignId}-statement.pdf` });
  }

  function triggerBrowserDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("croms_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!campaigns.length) {
      return;
    }

    if (!selectedCampaignId || !campaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const hasCoreError = userQuery.error || groupsQuery.error || campaignsQuery.error || (isAdmin ? usersQuery.error : null);
    if (hasCoreError) {
      const message = getErrorMessage(hasCoreError, "Failed to load application data.");
      log("Bootstrap failed", message);
      showNotice({ tone: "error", title: "Bootstrap failed", message });
      logout(true);
    }
  }, [token, userQuery.error, groupsQuery.error, campaignsQuery.error, usersQuery.error, isAdmin]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  const dashboardStats = useMemo(() => {
    const totalRaised = campaigns.reduce((sum, campaign) => sum + Number(campaign.total_raised || 0), 0);
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
    return {
      groups: groups.length,
      campaigns: campaigns.length,
      activeCampaigns,
      contributors: contributors.length,
      totalRaised,
      pendingConfirmations: confirmations.length,
    };
  }, [groups, campaigns, contributors, confirmations]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        groups,
        campaigns,
        users,
        contributors,
        transactions,
        paymentMethods,
        confirmations,
        summaryText,
        activityLog,
        selectedCampaignId,
        selectedCampaign,
        dashboardStats,
        theme,
        notice,
        confirmationDialog,
        summaryOptions,
        loading,
        bootstrapped,
        isAuthenticated: Boolean(token),
        isAdmin,
        setSelectedCampaignId,
        toggleTheme,
        setSummaryOptions,
        showNotice,
        clearNotice,
        requestConfirmation,
        resolveConfirmation,
        getErrorMessage,
        ensureReviewDraft,
        updateReviewDraft,
        login,
        logout,
        createUser,
        forgotPassword,
        resetPassword,
        changePassword,
        createGroup,
        createCampaign,
        assignMember,
        addPaymentMethod,
        parseTransaction,
        createManualTransaction,
        approveConfirmation,
        rejectConfirmation,
        updateCampaignStatus,
        deleteTransaction,
        downloadContributorsCsv,
        downloadStatementExcel,
        downloadStatementPdf,
        loadSummary,
        refreshCoreData,
        refreshCampaignDetails,
        log,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return value;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function formatPersonName(primary, fallback, finalFallback) {
  return displayPersonName(primary, fallback, finalFallback);
}

export function groupTransactionsByDay(transactions) {
  return Object.values(
    transactions.reduce((accumulator, transaction) => {
      const rawLabel = transaction.event_time ? String(transaction.event_time).slice(0, 10) : "unknown";
      if (!accumulator[rawLabel]) {
        accumulator[rawLabel] = { label: rawLabel, amount: 0, count: 0 };
      }
      accumulator[rawLabel].amount += Number(transaction.amount || 0);
      accumulator[rawLabel].count += 1;
      return accumulator;
    }, {})
  );
}

export default AppProvider;
