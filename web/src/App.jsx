import { useEffect, useMemo, useState } from "react";

const seedCredentials = {
  email: "admin@croms.local",
  password: "Admin@12345",
};

const identityTypes = [
  "individual",
  "titled_individual",
  "family",
  "group",
  "organization",
  "anonymous",
];

const paymentTypes = ["paybill", "till", "phone", "bank"];

function numberFormat(value) {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("croms_token") || "");
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [summaryText, setSummaryText] = useState("Select a campaign to load the WhatsApp summary.");
  const [activityLog, setActivityLog] = useState("CrOMS React console ready.");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState(seedCredentials);
  const [registerForm, setRegisterForm] = useState({ fullName: "", email: "", password: "", role: "viewer" });
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    brandName: "",
    brandColor: "#bb3e03",
    brandLogoPath: "/assets/android-chrome-192x192.png",
  });
  const [campaignForm, setCampaignForm] = useState({ groupId: "", name: "", targetAmount: "" });
  const [paymentForm, setPaymentForm] = useState({ campaignId: "", methodType: "paybill", value: "", label: "" });
  const [memberForm, setMemberForm] = useState({ groupId: "", userId: "", role: "viewer" });
  const [parseForm, setParseForm] = useState({
    campaignId: "",
    displayName: "",
    identityType: "individual",
    rawText: "QJH7K29XYZ Confirmed. Ksh 1500 received from John Otieno on 05/04/2026 09:24 AM.",
  });
  const [forgotForm, setForgotForm] = useState({ email: seedCredentials.email });
  const [resetForm, setResetForm] = useState({ token: "", password: "" });

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  const dashboardStats = useMemo(() => {
    const totalRaised = campaigns.reduce((sum, campaign) => sum + Number(campaign.total_raised || 0), 0);
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
    return {
      groups: groups.length,
      campaigns: campaigns.length,
      activeCampaigns,
      contributors: contributors.length,
      totalRaised,
    };
  }, [groups, campaigns, contributors]);

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const hasBody = options.body !== undefined;

    if (hasBody && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, { ...options, headers });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      throw new Error(data?.error || `Request failed with status ${response.status}`);
    }

    return data;
  }

  function setLog(title, payload) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    setActivityLog(`${title}\n${text}`);
  }

  async function refreshCoreData(campaignId) {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const [me, groupsData, campaignsData, usersData] = await Promise.all([
        api("/api/auth/me"),
        api("/api/groups"),
        api("/api/campaigns"),
        api("/api/auth/users"),
      ]);

      setUser(me);
      setGroups(groupsData);
      setCampaigns(campaignsData);
      setUsers(usersData);

      const nextCampaignId = campaignId || selectedCampaignId || campaignsData[0]?.id || "";
      setSelectedCampaignId(nextCampaignId);
      setCampaignForm((current) => ({ ...current, groupId: current.groupId || groupsData[0]?.id || "" }));
      setPaymentForm((current) => ({ ...current, campaignId: current.campaignId || nextCampaignId }));
      setMemberForm((current) => ({
        ...current,
        groupId: current.groupId || groupsData[0]?.id || "",
        userId: current.userId || usersData.find((entry) => entry.id !== me.id)?.id || usersData[0]?.id || "",
      }));
      setParseForm((current) => ({ ...current, campaignId: current.campaignId || nextCampaignId }));

      if (nextCampaignId) {
        await refreshCampaignDetails(nextCampaignId);
      } else {
        setContributors([]);
        setTransactions([]);
        setPaymentMethods([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshCampaignDetails(campaignId) {
    if (!campaignId) {
      return;
    }

    const [contributorsData, transactionsData, methodsData] = await Promise.all([
      api(`/api/contributors/${campaignId}`),
      api(`/api/transactions/${campaignId}`),
      api(`/api/payment-methods/campaign/${campaignId}`),
    ]);

    setContributors(contributorsData);
    setTransactions(transactionsData);
    setPaymentMethods(methodsData);
  }

  async function loadSummary(campaignId = selectedCampaignId) {
    if (!campaignId) {
      setSummaryText("Select a campaign to load the WhatsApp summary.");
      return;
    }

    const response = await api(`/api/summary/${campaignId}/whatsapp`);
    setSummaryText(response.summary);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      localStorage.setItem("croms_token", response.token);
      setToken(response.token);
      setUser(response.user);
      setLog("Login success", response.user);
    } catch (error) {
      setLog("Login failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    try {
      const response = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(registerForm),
      });
      setRegisterForm({ fullName: "", email: "", password: "", role: "viewer" });
      setLog("User created", response);
      await refreshCoreData();
    } catch (error) {
      setLog("Create user failed", error.message);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    try {
      const response = await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(forgotForm),
      });
      setResetForm((current) => ({ ...current, token: response.resetToken }));
      setLog("Reset token generated", response);
    } catch (error) {
      setLog("Forgot password failed", error.message);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    try {
      const response = await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(resetForm),
      });
      setResetForm({ token: "", password: "" });
      setLog("Password reset", response);
    } catch (error) {
      setLog("Reset password failed", error.message);
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    try {
      const response = await api("/api/groups", {
        method: "POST",
        body: JSON.stringify(groupForm),
      });
      setGroupForm({
        name: "",
        description: "",
        brandName: "",
        brandColor: "#bb3e03",
        brandLogoPath: "/assets/android-chrome-192x192.png",
      });
      setLog("Group created", response);
      await refreshCoreData();
    } catch (error) {
      setLog("Create group failed", error.message);
    }
  }

  async function handleCreateCampaign(event) {
    event.preventDefault();
    try {
      const response = await api("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          groupId: campaignForm.groupId,
          name: campaignForm.name,
          targetAmount: campaignForm.targetAmount || undefined,
        }),
      });
      setCampaignForm((current) => ({ ...current, name: "", targetAmount: "" }));
      setLog("Campaign created", response);
      await refreshCoreData(response.id);
    } catch (error) {
      setLog("Create campaign failed", error.message);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    try {
      const response = await api(`/api/groups/${memberForm.groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: memberForm.userId, role: memberForm.role }),
      });
      setLog("Group member assigned", response);
    } catch (error) {
      setLog("Assign member failed", error.message);
    }
  }

  async function handleAddPaymentMethod(event) {
    event.preventDefault();
    try {
      const response = await api("/api/payment-methods", {
        method: "POST",
        body: JSON.stringify(paymentForm),
      });
      setPaymentForm((current) => ({ ...current, value: "", label: "" }));
      setLog("Payment method saved", response);
      await refreshCampaignDetails(paymentForm.campaignId);
      await loadSummary(paymentForm.campaignId);
    } catch (error) {
      setLog("Save payment method failed", error.message);
    }
  }

  async function handleParseTransaction(event) {
    event.preventDefault();
    try {
      const response = await api("/api/parse", {
        method: "POST",
        body: JSON.stringify(parseForm),
      });
      setLog("Transaction parsed and stored", response);
      await refreshCoreData(parseForm.campaignId);
      await loadSummary(parseForm.campaignId);
    } catch (error) {
      setLog("Parse failed", error.message);
    }
  }

  async function handleCampaignStatus(campaignId, status) {
    try {
      const response = await api(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setLog("Campaign status updated", response);
      await refreshCoreData(campaignId);
    } catch (error) {
      setLog("Status update failed", error.message);
    }
  }

  function handleLogout() {
    localStorage.removeItem("croms_token");
    setToken("");
    setUser(null);
    setGroups([]);
    setCampaigns([]);
    setUsers([]);
    setContributors([]);
    setTransactions([]);
    setPaymentMethods([]);
    setSelectedCampaignId("");
    setSummaryText("Select a campaign to load the WhatsApp summary.");
    setLog("Logged out", "Session cleared.");
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    refreshCoreData().catch((error) => {
      setLog("Bootstrap failed", error.message);
      handleLogout();
    });
  }, [token]);

  useEffect(() => {
    if (!selectedCampaignId || !token) {
      return;
    }

    refreshCampaignDetails(selectedCampaignId).catch((error) => setLog("Campaign refresh failed", error.message));
  }, [selectedCampaignId, token]);

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="hero">
        <div className="brand-block">
          <img src="/assets/android-chrome-192x192.png" alt="CrOMS logo" className="brand-logo" />
          <div>
            <p className="eyebrow">CrOMS Full System Blueprint</p>
            <h1>Web Operations Console</h1>
            <p className="subcopy">
              React web frontend aligned to the blueprint modules: auth, groups, campaigns, parsing,
              contributors, payment methods, summaries, and reporting.
            </p>
          </div>
        </div>
        <div className="hero-side">
          <div className="identity-chip">
            <strong>{user ? user.fullName || user.full_name : "Guest"}</strong>
            <span>{user ? user.role : "Not signed in"}</span>
          </div>
          <button className="ghost-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard label="Groups" value={dashboardStats.groups} detail="Community structures" />
        <StatCard label="Campaigns" value={dashboardStats.campaigns} detail={`${dashboardStats.activeCampaigns} active`} />
        <StatCard label="Contributors" value={dashboardStats.contributors} detail="Identities tracked" />
        <StatCard label="Raised" value={`KES ${numberFormat(dashboardStats.totalRaised)}`} detail="Across visible campaigns" />
      </section>

      <section className="grid grid-auth">
        <Panel title="Sign In" subtitle="JWT authentication for Admin, Treasurer, and Viewer roles.">
          <form className="form-grid" onSubmit={handleLogin}>
            <TextField label="Email" value={loginForm.email} onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))} />
            <TextField label="Password" type="password" value={loginForm.password} onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))} />
            <button className="primary-button" disabled={loading} type="submit">{loading ? "Working..." : "Login"}</button>
          </form>
        </Panel>

        <Panel title="User Management" subtitle="Create users and exercise forgot-password flow from the blueprint.">
          <form className="form-grid compact" onSubmit={handleRegister}>
            <TextField label="Full Name" value={registerForm.fullName} onChange={(value) => setRegisterForm((current) => ({ ...current, fullName: value }))} />
            <TextField label="Email" type="email" value={registerForm.email} onChange={(value) => setRegisterForm((current) => ({ ...current, email: value }))} />
            <TextField label="Password" type="password" value={registerForm.password} onChange={(value) => setRegisterForm((current) => ({ ...current, password: value }))} />
            <SelectField label="Role" value={registerForm.role} options={["viewer", "treasurer", "admin"]} onChange={(value) => setRegisterForm((current) => ({ ...current, role: value }))} />
            <button className="primary-button" type="submit">Create User</button>
          </form>
          <div className="mini-grid">
            <form className="form-grid compact" onSubmit={handleForgotPassword}>
              <TextField label="Forgot Password Email" type="email" value={forgotForm.email} onChange={(value) => setForgotForm({ email: value })} />
              <button className="ghost-button" type="submit">Generate Reset Token</button>
            </form>
            <form className="form-grid compact" onSubmit={handleResetPassword}>
              <TextField label="Reset Token" value={resetForm.token} onChange={(value) => setResetForm((current) => ({ ...current, token: value }))} />
              <TextField label="New Password" type="password" value={resetForm.password} onChange={(value) => setResetForm((current) => ({ ...current, password: value }))} />
              <button className="ghost-button" type="submit">Reset Password</button>
            </form>
          </div>
        </Panel>
      </section>

      <section className="grid grid-main">
        <Panel title="Group Management" subtitle="Branding, descriptions, and multi-group membership.">
          <form className="form-grid compact" onSubmit={handleCreateGroup}>
            <TextField label="Group Name" value={groupForm.name} onChange={(value) => setGroupForm((current) => ({ ...current, name: value }))} />
            <TextField label="Description" value={groupForm.description} onChange={(value) => setGroupForm((current) => ({ ...current, description: value }))} />
            <TextField label="Brand Name" value={groupForm.brandName} onChange={(value) => setGroupForm((current) => ({ ...current, brandName: value }))} />
            <TextField label="Brand Color" value={groupForm.brandColor} onChange={(value) => setGroupForm((current) => ({ ...current, brandColor: value }))} />
            <TextField label="Brand Logo Path" value={groupForm.brandLogoPath} onChange={(value) => setGroupForm((current) => ({ ...current, brandLogoPath: value }))} />
            <button className="primary-button" type="submit">Create Group</button>
          </form>
          <form className="form-grid compact overlay-form" onSubmit={handleAddMember}>
            <SelectField label="Assign to Group" value={memberForm.groupId} options={groups.map((group) => ({ value: group.id, label: group.name }))} onChange={(value) => setMemberForm((current) => ({ ...current, groupId: value }))} />
            <SelectField label="User" value={memberForm.userId} options={users.map((entry) => ({ value: entry.id, label: `${entry.full_name} (${entry.role})` }))} onChange={(value) => setMemberForm((current) => ({ ...current, userId: value }))} />
            <SelectField label="Membership Role" value={memberForm.role} options={["viewer", "treasurer", "admin"]} onChange={(value) => setMemberForm((current) => ({ ...current, role: value }))} />
            <button className="ghost-button" type="submit">Assign Member</button>
          </form>
          <div className="stack-list">
            {groups.map((group) => (
              <article className="list-card" key={group.id}>
                <div className="list-card-top">
                  <div>
                    <strong>{group.name}</strong>
                    <p>{group.description || "No description"}</p>
                  </div>
                  <span className="badge" style={{ backgroundColor: group.brand_color || "#dfe7dc" }}>{group.brand_name || "Brand"}</span>
                </div>
                <small>{group.id}</small>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Campaign Management" subtitle="Targets, status, totals, and progress tracking.">
          <form className="form-grid compact" onSubmit={handleCreateCampaign}>
            <SelectField label="Group" value={campaignForm.groupId} options={groups.map((group) => ({ value: group.id, label: group.name }))} onChange={(value) => setCampaignForm((current) => ({ ...current, groupId: value }))} />
            <TextField label="Campaign Name" value={campaignForm.name} onChange={(value) => setCampaignForm((current) => ({ ...current, name: value }))} />
            <TextField label="Target Amount" type="number" value={campaignForm.targetAmount} onChange={(value) => setCampaignForm((current) => ({ ...current, targetAmount: value }))} />
            <button className="primary-button" type="submit">Create Campaign</button>
          </form>
          <div className="stack-list campaign-list">
            {campaigns.map((campaign) => {
              const target = Number(campaign.target_amount || 0);
              const totalRaised = Number(campaign.total_raised || 0);
              const progress = target > 0 ? Math.min((totalRaised / target) * 100, 100) : 0;
              const isSelected = campaign.id === selectedCampaignId;
              return (
                <article className={`list-card ${isSelected ? "selected" : ""}`} key={campaign.id}>
                  <div className="list-card-top">
                    <div>
                      <strong>{campaign.name}</strong>
                      <p>{campaign.group_name || "Group"}</p>
                    </div>
                    <span className={`status-pill ${campaign.status}`}>{campaign.status}</span>
                  </div>
                  <div className="meter">
                    <div className="meter-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="metric-row">
                    <span>Raised: KES {numberFormat(totalRaised)}</span>
                    <span>Target: {target ? `KES ${numberFormat(target)}` : "Not set"}</span>
                  </div>
                  <div className="button-row">
                    <button className="ghost-button" onClick={() => setSelectedCampaignId(campaign.id)} type="button">Focus</button>
                    <button className="ghost-button" onClick={() => handleCampaignStatus(campaign.id, campaign.status === "active" ? "closed" : "active")} type="button">
                      Mark {campaign.status === "active" ? "Closed" : "Active"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>
      </section>

      <section className="grid grid-ops">
        <Panel title="Payment Methods" subtitle="Paybill, Till, Phone, and Bank instructions for campaign summaries.">
          <form className="form-grid compact" onSubmit={handleAddPaymentMethod}>
            <SelectField label="Campaign" value={paymentForm.campaignId} options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={(value) => setPaymentForm((current) => ({ ...current, campaignId: value }))} />
            <SelectField label="Method Type" value={paymentForm.methodType} options={paymentTypes} onChange={(value) => setPaymentForm((current) => ({ ...current, methodType: value }))} />
            <TextField label="Value" value={paymentForm.value} onChange={(value) => setPaymentForm((current) => ({ ...current, value }))} />
            <TextField label="Label" value={paymentForm.label} onChange={(value) => setPaymentForm((current) => ({ ...current, label: value }))} />
            <button className="primary-button" type="submit">Save Payment Method</button>
          </form>
          <div className="stack-list">
            {paymentMethods.map((method) => (
              <article className="list-card" key={method.id}>
                <div className="list-card-top">
                  <strong>{method.method_type.toUpperCase()}</strong>
                  <span className="badge neutral">{method.label}</span>
                </div>
                <p>{method.value}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Transaction Parsing Engine" subtitle="Regex-first parsing flow with contributor matching and duplicate protection.">
          <form className="form-grid compact" onSubmit={handleParseTransaction}>
            <SelectField label="Campaign" value={parseForm.campaignId} options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={(value) => setParseForm((current) => ({ ...current, campaignId: value }))} />
            <TextField label="Display Name" value={parseForm.displayName} onChange={(value) => setParseForm((current) => ({ ...current, displayName: value }))} />
            <SelectField label="Identity Type" value={parseForm.identityType} options={identityTypes} onChange={(value) => setParseForm((current) => ({ ...current, identityType: value }))} />
            <TextAreaField label="Raw MPesa / Bank Message" value={parseForm.rawText} onChange={(value) => setParseForm((current) => ({ ...current, rawText: value }))} rows={6} />
            <button className="primary-button" type="submit">Parse and Save</button>
          </form>
        </Panel>
      </section>

      <section className="grid grid-reporting">
        <Panel title="WhatsApp Summary Generator" subtitle="Campaign messaging with totals, target, deficit, and payment instructions.">
          <div className="button-row compact-row">
            <SelectField label="Focused Campaign" value={selectedCampaignId} options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={(value) => setSelectedCampaignId(value)} />
            <button className="primary-button" onClick={() => loadSummary()} type="button">Load Summary</button>
            <button className="ghost-button" onClick={() => window.open(`/api/reports/${selectedCampaignId}/contributors.csv`, "_blank")} type="button" disabled={!selectedCampaignId}>Export CSV</button>
          </div>
          <pre className="console-box">{summaryText}</pre>
        </Panel>

        <Panel title="Contributors and Transactions" subtitle="Identity records, senders, and contribution history for the selected campaign.">
          <div className="split-columns">
            <div>
              <h3>Contributors</h3>
              <div className="stack-list small-cards">
                {contributors.map((contributor) => (
                  <article className="list-card" key={contributor.id}>
                    <strong>{contributor.display_name}</strong>
                    <p>{contributor.identity_type}</p>
                    <small>KES {numberFormat(contributor.total_contributed)}</small>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3>Transactions</h3>
              <div className="stack-list small-cards">
                {transactions.map((transaction) => (
                  <article className="list-card" key={transaction.id}>
                    <strong>{transaction.sender_name}</strong>
                    <p>{transaction.transaction_code}</p>
                    <small>KES {numberFormat(transaction.amount)}</small>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid grid-footer">
        <Panel title="Operational Log" subtitle="Recent responses and API workflow visibility.">
          <pre className="console-box tall">{activityLog}</pre>
        </Panel>
        <Panel title="Blueprint Coverage" subtitle="What this web app now aligns with in the blueprint.">
          <ul className="coverage-list">
            <li>React web frontend replacing the previous static page.</li>
            <li>Authentication, user roles, and password recovery interfaces.</li>
            <li>Group creation, branding inputs, and member assignment workflow.</li>
            <li>Campaign progress visualization with active and closed states.</li>
            <li>Dedicated payment method and parse flows aligned to the API design.</li>
            <li>Contributor identities, transactions, WhatsApp summaries, and CSV export access.</li>
          </ul>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <article className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </article>
  );
}

function StatCard({ label, value, detail }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TextField({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }) {
  return (
    <label className="field field-full">
      <span>{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );

  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default App;
