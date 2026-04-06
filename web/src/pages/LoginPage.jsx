import { useState } from "react";
import { Navigate } from "react-router-dom";
import TextField from "../components/forms/TextField";
import Panel from "../components/panels/Panel";
import { useAppContext } from "../context/AppContext";

export default function LoginPage() {
  const { isAuthenticated, login, forgotPassword, resetPassword, loading, showNotice, clearNotice, getErrorMessage } = useAppContext();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [forgotForm, setForgotForm] = useState({ email: "" });
  const [resetForm, setResetForm] = useState({ token: "", password: "" });
  const [recoveryMode, setRecoveryMode] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-shell login-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="grid login-intro-grid">
        <Panel>
          <div className="login-intro-copy">
            <div className="login-brand-block">
              <img src="/assets/android-chrome-192x192.png" alt="CrOMS logo" className="login-brand-logo" />
              <strong>CrOMS</strong>
              <span>Contributions Management System</span>
            </div>
            <p>
              Run all your fundraising and contribution workflows from one clean, powerful interface, built for welfare groups, church teams, funeral committees, school fundraisers, and community projects.
            </p>
            <div className="login-feature-list">
              <span>Quick M-Pesa payment capture</span>
              <span>Ready-to-share WhatsApp updates</span>
              <span>Download reports anytime</span>
            </div>
          </div>
        </Panel>
      </section>
      <section className="grid login-grid">
        <Panel title={recoveryMode ? "Password Recovery" : "Secure Sign In"} subtitle={recoveryMode ? "Generate a token and reset access from the same workspace." : "Access your contribution workspace and continue where the team left off."}>
          {!recoveryMode ? (
            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                clearNotice();
                if (!loginForm.email.trim() || !loginForm.password) {
                  showNotice({ tone: "error", title: "Sign in failed", message: "Email and password are required." });
                  return;
                }

                try {
                  await login(loginForm);
                } catch (error) {
                  showNotice({ tone: "error", title: "Sign in failed", message: getErrorMessage(error, "Unable to sign in.") });
                }
              }}
            >
              <TextField label="Email" value={loginForm.email} helperText="Use the email address assigned to your CrOMS account." onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))} />
              <TextField label="Password" type="password" helperText="Use the show button if you want to preview the password before signing in." value={loginForm.password} onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))} />
              <button className="primary-button" type="submit">{loading ? "Loading..." : "Login"}</button>
              <div className="field field-full login-link-row">
                <button className="text-link-button" type="button" onClick={() => {
                  clearNotice();
                  setRecoveryMode(true);
                }}>
                  Forget password
                </button>
              </div>
            </form>
          ) : (
            <div className="mini-grid">
              <form
                className="form-grid compact"
                onSubmit={async (event) => {
                  event.preventDefault();
                  clearNotice();
                  if (!forgotForm.email.trim()) {
                    showNotice({ tone: "error", title: "Password recovery failed", message: "Email is required." });
                    return;
                  }

                  try {
                    const response = await forgotPassword(forgotForm);
                    setResetForm((current) => ({ ...current, token: response.resetToken }));
                  } catch (error) {
                    showNotice({ tone: "error", title: "Password recovery failed", message: getErrorMessage(error, "Unable to generate a reset token.") });
                  }
                }}
              >
                <TextField label="Email" value={forgotForm.email} helperText="Enter the account email to generate a password reset token." onChange={(value) => setForgotForm({ email: value })} />
                <button className="ghost-button" type="submit">Generate Reset Token</button>
              </form>
              <form
                className="form-grid compact"
                onSubmit={async (event) => {
                  event.preventDefault();
                  clearNotice();
                  if (!resetForm.token.trim() || !resetForm.password) {
                    showNotice({ tone: "error", title: "Password reset failed", message: "Reset token and new password are required." });
                    return;
                  }

                  try {
                    await resetPassword(resetForm);
                    setResetForm({ token: "", password: "" });
                    setRecoveryMode(false);
                  } catch (error) {
                    showNotice({ tone: "error", title: "Password reset failed", message: getErrorMessage(error, "Unable to reset the password.") });
                  }
                }}
              >
                <TextField label="Token" value={resetForm.token} helperText="Paste the reset token that was generated for this account." onChange={(value) => setResetForm((current) => ({ ...current, token: value }))} />
                <TextField label="New Password" type="password" helperText="Choose a new password with at least 8 characters." value={resetForm.password} onChange={(value) => setResetForm((current) => ({ ...current, password: value }))} />
                <button className="ghost-button" type="submit">Reset Password</button>
              </form>
              <div className="login-link-row">
                <button className="text-link-button" type="button" onClick={() => {
                  clearNotice();
                  setRecoveryMode(false);
                }}>
                  Back to login
                </button>
              </div>
            </div>
          )}
        </Panel>
      </section>
      <footer className="login-signature">
        <small>&copy; 2026 OMS Systems Consult</small>
      </footer>
    </div>
  );
}
