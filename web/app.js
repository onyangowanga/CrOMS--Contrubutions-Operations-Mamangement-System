const state = {
  token: localStorage.getItem("croms_token") || "",
  user: null,
  groups: [],
  campaigns: [],
};

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const groupForm = document.getElementById("group-form");
const campaignForm = document.getElementById("campaign-form");
const paymentForm = document.getElementById("payment-form");
const parseForm = document.getElementById("parse-form");

const userBox = document.getElementById("current-user");
const logoutBtn = document.getElementById("logout-btn");
const groupsList = document.getElementById("groups-list");
const campaignsList = document.getElementById("campaigns-list");
const summaryOutput = document.getElementById("summary-output");
const activityOutput = document.getElementById("activity-output");

const groupSelect = document.getElementById("campaign-group-select");
const paymentCampaignSelect = document.getElementById("payment-campaign-select");
const parseCampaignSelect = document.getElementById("parse-campaign-select");
const summaryCampaignSelect = document.getElementById("summary-campaign-select");

const loadSummaryBtn = document.getElementById("load-summary-btn");
const exportBtn = document.getElementById("export-report-btn");

function logOutput(title, payload) {
  activityOutput.textContent = `${title}\n${JSON.stringify(payload, null, 2)}`;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }

  return data;
}

function setUser(user) {
  state.user = user;
  if (!user) {
    userBox.textContent = "Not signed in";
    return;
  }
  userBox.textContent = `${user.fullName || user.full_name} (${user.role})`;
}

function fillSelect(select, options, placeholder) {
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = placeholder;
  select.appendChild(defaultOption);

  for (const item of options) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    select.appendChild(opt);
  }
}

function renderLists() {
  groupsList.innerHTML = state.groups
    .map((g) => `<div class="list-item"><strong>${g.name}</strong><span>${g.id}</span></div>`)
    .join("");

  campaignsList.innerHTML = state.campaigns
    .map(
      (c) =>
        `<div class="list-item"><strong>${c.name}</strong><span>${c.id}</span><em>KES ${Number(c.total_raised).toLocaleString()}</em></div>`
    )
    .join("");

  fillSelect(groupSelect, state.groups, "Select group");
  fillSelect(paymentCampaignSelect, state.campaigns, "Select campaign");
  fillSelect(parseCampaignSelect, state.campaigns, "Select campaign");
  fillSelect(summaryCampaignSelect, state.campaigns, "Select campaign");
}

async function refreshData() {
  if (!state.token) {
    return;
  }

  const [groups, campaigns] = await Promise.all([api("/api/groups"), api("/api/campaigns")]);
  state.groups = groups;
  state.campaigns = campaigns;
  renderLists();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(loginForm);
    const body = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    state.token = body.token;
    localStorage.setItem("croms_token", state.token);
    setUser(body.user);
    await refreshData();
    logOutput("Login success", body.user);
  } catch (error) {
    logOutput("Login failed", { error: error.message });
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(registerForm);
    const body = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        password: formData.get("password"),
        role: formData.get("role"),
      }),
    });

    logOutput("User created", body);
    registerForm.reset();
  } catch (error) {
    logOutput("Create user failed", { error: error.message });
  }
});

groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(groupForm);
    const body = await api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description"),
      }),
    });
    logOutput("Group created", body);
    groupForm.reset();
    await refreshData();
  } catch (error) {
    logOutput("Create group failed", { error: error.message });
  }
});

campaignForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(campaignForm);
    const body = await api("/api/campaigns", {
      method: "POST",
      body: JSON.stringify({
        groupId: formData.get("groupId"),
        name: formData.get("name"),
        targetAmount: formData.get("targetAmount") || undefined,
      }),
    });
    logOutput("Campaign created", body);
    campaignForm.reset();
    await refreshData();
  } catch (error) {
    logOutput("Create campaign failed", { error: error.message });
  }
});

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(paymentForm);
    const body = await api(`/api/campaigns/${formData.get("campaignId")}/payment-methods`, {
      method: "POST",
      body: JSON.stringify({
        methodType: formData.get("methodType"),
        value: formData.get("value"),
        label: formData.get("label"),
      }),
    });
    logOutput("Payment method added", body);
    paymentForm.reset();
    await refreshData();
  } catch (error) {
    logOutput("Add payment method failed", { error: error.message });
  }
});

parseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(parseForm);
    const body = await api("/api/transactions/parse", {
      method: "POST",
      body: JSON.stringify({
        campaignId: formData.get("campaignId"),
        displayName: formData.get("displayName") || undefined,
        identityType: formData.get("identityType"),
        rawText: formData.get("rawText"),
      }),
    });
    logOutput("Transaction parsed and saved", body);
    parseForm.reset();
    await refreshData();
  } catch (error) {
    logOutput("Parse failed", { error: error.message });
  }
});

loadSummaryBtn.addEventListener("click", async () => {
  const campaignId = summaryCampaignSelect.value;
  if (!campaignId) {
    summaryOutput.textContent = "Pick a campaign first.";
    return;
  }

  try {
    const body = await api(`/api/summary/${campaignId}/whatsapp`);
    summaryOutput.textContent = body.summary;
  } catch (error) {
    summaryOutput.textContent = error.message;
  }
});

exportBtn.addEventListener("click", () => {
  const campaignId = summaryCampaignSelect.value;
  if (!campaignId) {
    summaryOutput.textContent = "Pick a campaign first.";
    return;
  }

  window.open(`/api/reports/${campaignId}/contributors.csv`, "_blank");
});

logoutBtn.addEventListener("click", () => {
  state.token = "";
  localStorage.removeItem("croms_token");
  setUser(null);
  state.groups = [];
  state.campaigns = [];
  renderLists();
  logOutput("Logged out", {});
});

async function bootstrap() {
  if (!state.token) {
    return;
  }

  try {
    const me = await api("/api/auth/me");
    setUser(me);
    await refreshData();
  } catch {
    state.token = "";
    localStorage.removeItem("croms_token");
    setUser(null);
  }
}

bootstrap();
