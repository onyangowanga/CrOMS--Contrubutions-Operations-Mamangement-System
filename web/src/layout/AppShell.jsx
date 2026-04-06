import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import ConfirmationDialog from "../components/modals/ConfirmationDialog";
import TextField from "../components/forms/TextField";
import ThemeToggle from "../components/ui/ThemeToggle";
import { formatPersonName, useAppContext } from "../context/AppContext";

const helpSections = [
  {
    title: "Log Payments",
    items: [
      "Use the M-Pesa tab for pasted messages and the Cash tab for manually received money.",
      "If a message does not include the contributor name, enter a display name before posting.",
      "Use Preview Allocation only when one payment should be split across multiple campaigns.",
    ],
  },
  {
    title: "Campaign Setup",
    items: [
      "Create campaigns from the Create Campaign tab.",
      "Use the Edit Campaign tab to update the campaign name, target, suggested contribution, and saved WhatsApp text.",
      "Set paybill methods with the correct account number or account name for each campaign.",
    ],
  },
  {
    title: "Reviews And Reports",
    items: [
      "Pending Reviews lets you approve or reject unclear parsed transactions.",
      "If you close a freshly opened review popup without approving, that queued item is discarded.",
      "Use the Reports page campaign selector before exporting CSV, Excel, or PDF statements.",
    ],
  },
  {
    title: "WhatsApp Summary",
    items: [
      "Refresh to load the latest campaign summary.",
      "Copy Summary sends the text to your clipboard.",
      "Open WhatsApp launches WhatsApp Web or the WhatsApp app with the summary text prefilled.",
    ],
  },
];

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isAdmin,
    selectedCampaign,
    theme,
    toggleTheme,
    logout,
    notice,
    clearNotice,
    confirmationDialog,
    resolveConfirmation,
    changePassword,
    showNotice,
    getErrorMessage,
  } = useAppContext();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const activeGroupName = selectedCampaign?.group_name || selectedCampaign?.name || "Contribution Group";

  const links = [
    ["/dashboard", "Dashboard"],
    ["/payments", "Log Payment"],
    ["/campaigns", "Campaigns"],
    ["/reports", "Reports"],
  ];
  const mobileLinks = isAdmin ? [...links, ["/admin", "Admin"]] : links;

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  async function handleChangePassword(event) {
    event.preventDefault();
    clearNotice();

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      showNotice({ tone: "error", title: "Change password failed", message: "Current and new password are required." });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      showNotice({ tone: "error", title: "Change password failed", message: "New password must be at least 8 characters long." });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showNotice({ tone: "error", title: "Change password failed", message: "New password confirmation does not match." });
      return;
    }

    try {
      await changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordModalOpen(false);
      showNotice({ tone: "success", title: "Password updated", message: "Your password was changed successfully." });
    } catch (error) {
      showNotice({ tone: "error", title: "Change password failed", message: getErrorMessage(error, "Unable to change your password.") });
    }
  }

  const accountMenu = accountMenuOpen ? (
    <div className="account-menu" role="menu">
      <button className="account-menu-item mobile-theme-item" type="button" onClick={() => {
        toggleTheme();
        setAccountMenuOpen(false);
      }}>
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </button>
      <button className="account-menu-item" type="button" onClick={() => {
        setPasswordModalOpen(true);
        setAccountMenuOpen(false);
      }}>
        Change Password
      </button>
      {isAdmin ? (
        <button className="account-menu-item" type="button" onClick={() => {
          navigate("/admin");
          setAccountMenuOpen(false);
        }}>
          Administration
        </button>
      ) : null}
      <button className="account-menu-item danger" type="button" onClick={logout}>Logout</button>
    </div>
  ) : null;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="hero">
        <div className="brand-block">
          <img src="/assets/android-chrome-192x192.png" alt="CrOMS logo" className="brand-logo" />
          <div className="brand-copy">
            <p className="eyebrow">Managing Contributions Made Simple</p>
            <h1>Contributions Management System</h1>
            <p className="subcopy">
              Run all your fundraising and contribution workflows from one clean, powerful interface, built for welfare groups, church teams, funeral committees, school fundraisers, and community projects.
            </p>
            <div className="hero-mobile-meta" aria-label="Current workspace details">
              <strong>{activeGroupName}</strong>
              <span>{user ? formatPersonName(user.fullName || user.full_name, "Current User") : "Current User"}</span>
            </div>
          </div>
        </div>
        <div className="hero-side">
          <div className="identity-chip">
            <strong>{user ? formatPersonName(user.fullName || user.full_name, "Guest", "Guest") : "Guest"}</strong>
            <span>{user ? user.role : "Not signed in"}</span>
          </div>
          <div className="hero-actions hero-actions-account desktop-actions">
            <button className="ghost-button help-trigger" type="button" aria-label="Open help" title="Help" onClick={() => setHelpModalOpen(true)}>
              ?
            </button>
            <ThemeToggle />
            <div className="account-menu-wrap desktop-account-wrap">
              <button className="ghost-button account-menu-trigger" type="button" onClick={() => setAccountMenuOpen((current) => !current)}>
                Account
              </button>
              {accountMenu}
            </div>
          </div>
          <div className="mobile-menu-wrap account-menu-wrap">
            <button className="ghost-button help-trigger mobile-help-trigger" type="button" aria-label="Open help" title="Help" onClick={() => setHelpModalOpen(true)}>
              ?
            </button>
            <button className="ghost-button mobile-menu-trigger" type="button" onClick={() => setAccountMenuOpen((current) => !current)} aria-label="Open menu" aria-expanded={accountMenuOpen}>
              <span />
              <span />
              <span />
            </button>
            {accountMenu}
          </div>
        </div>
      </header>

      <nav className="route-nav">
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `route-link ${isActive ? "active" : ""}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <nav className={`route-nav-mobile ${mobileLinks.length > 4 ? "route-nav-mobile-admin" : ""}`.trim()} aria-label="Primary mobile navigation">
        {mobileLinks.map(([to, label]) => (
          <NavLink
            key={`mobile-${to}`}
            to={to}
            className={({ isActive }) => `route-link-mobile ${isActive ? "active" : ""}`}
          >
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {notice ? (
        <section className={`app-notice ${notice.tone || "error"}`} role="alert" aria-live="polite">
          <div>
            <strong>{notice.title || "Notice"}</strong>
            <p>{notice.message}</p>
          </div>
          <button className="ghost-button notice-dismiss" type="button" onClick={clearNotice}>Dismiss</button>
        </section>
      ) : null}

      <ConfirmationDialog
        dialog={confirmationDialog}
        onConfirm={() => resolveConfirmation(true)}
        onCancel={() => resolveConfirmation(false)}
      />

      {helpModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card modal-card-wide help-modal" role="dialog" aria-modal="true" aria-labelledby="help-manual-title">
            <p className="modal-eyebrow">Help</p>
            <div className="list-card-top">
              <div>
                <h2 id="help-manual-title">Treasurer Quick Guide</h2>
                <p className="modal-message">This help stays in a popup so the current task remains open underneath. Close it any time and continue where you left off.</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setHelpModalOpen(false)}>Close</button>
            </div>
            <div className="help-modal-body">
              {helpSections.map((section) => (
                <section className="help-section" key={section.title}>
                  <h3>{section.title}</h3>
                  <div className="help-list">
                    {section.items.map((item) => <p key={item}>{item}</p>)}
                  </div>
                </section>
              ))}
            </div>
            <div className="modal-actions help-modal-actions">
              <a className="ghost-button manual-download-link" href="/manuals/CrOMS_Treasurer_User_Manual_Formatted.pdf" target="_blank" rel="noreferrer" download>
                Download Manual PDF
              </a>
              <button className="primary-button" type="button" onClick={() => setHelpModalOpen(false)}>Return To Work</button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
            <p className="modal-eyebrow">Account</p>
            <div className="list-card-top">
              <div>
                <h2 id="change-password-title">Change password</h2>
                <p className="modal-message">Update your account password without leaving the current session.</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setPasswordModalOpen(false)}>Close</button>
            </div>
            <form className="form-grid compact-row" onSubmit={handleChangePassword}>
              <div className="field-full">
                <TextField label="Current Password" type="password" helperText="Use show if you want to verify the current password before saving." value={passwordForm.currentPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))} />
              </div>
              <TextField label="New Password" type="password" helperText="Create a new password with at least 8 characters." value={passwordForm.newPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))} />
              <TextField label="Confirm New Password" type="password" helperText="Repeat the new password exactly to confirm the change." value={passwordForm.confirmPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))} />
              <div className="modal-actions field-full">
                <button className="ghost-button" type="button" onClick={() => setPasswordModalOpen(false)}>Cancel</button>
                <button className="primary-button" type="submit">Save Password</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Outlet />
    </div>
  );
}
