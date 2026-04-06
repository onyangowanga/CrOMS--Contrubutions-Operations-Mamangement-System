import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import AppShell from "./layout/AppShell";
import { SkeletonPanel } from "./components/ui/Skeletons";
import { useAppContext } from "./context/AppContext";

const CampaignsPage = lazy(() => import("./pages/CampaignsPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ParsePage = lazy(() => import("./pages/ParsePage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));

function AdminOnlyRoute() {
  const { user, bootstrapped } = useAppContext();

  if (!bootstrapped) {
    return null;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function RouteLoader({ login = false }) {
  return (
    <div className={login ? "app-shell login-shell" : "route-loader"}>
      {login ? (
        <section className="grid grid-auth login-grid">
          <SkeletonPanel lines={5} />
          <SkeletonPanel lines={5} />
        </section>
      ) : (
        <section className="grid grid-reporting route-loader-grid">
          <SkeletonPanel lines={6} />
          <SkeletonPanel lines={6} />
        </section>
      )}
    </div>
  );
}

function withSuspense(element, login = false) {
  return <Suspense fallback={<RouteLoader login={login} />}>{element}</Suspense>;
}

function ProtectedRoutes() {
  const { isAuthenticated } = useAppContext();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={withSuspense(<LoginPage />, true)} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={withSuspense(<DashboardPage />)} />
        <Route path="/campaigns" element={withSuspense(<CampaignsPage />)} />
        <Route path="/payments" element={withSuspense(<ParsePage />)} />
        <Route path="/parse" element={<Navigate to="/payments" replace />} />
        <Route path="/summary" element={<Navigate to="/payments" replace />} />
        <Route path="/reports" element={withSuspense(<ReportsPage />)} />
        <Route element={<AdminOnlyRoute />}>
          <Route path="/admin" element={withSuspense(<GroupsPage />)} />
          <Route path="/groups" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
