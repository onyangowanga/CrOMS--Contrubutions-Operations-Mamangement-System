import StatCard from "../components/cards/StatCard";
import ContributionOverTimeChart from "../components/charts/ContributionOverTimeChart";
import TopContributorsChart from "../components/charts/TopContributorsChart";
import Panel from "../components/panels/Panel";
import { SkeletonPanel, SkeletonStatCard } from "../components/ui/Skeletons";
import { useAppContext } from "../context/AppContext";

export default function DashboardPage() {
  const {
    dashboardStats,
    loading,
    bootstrapped,
    contributors,
    transactions,
  } = useAppContext();

  return (
    <>
      <section className="stats-grid dashboard-stats-grid">
        {!bootstrapped || loading ? (
          Array.from({ length: 4 }).map((_, index) => <SkeletonStatCard key={index} />)
        ) : (
          <>
            <StatCard label="Groups" value={dashboardStats.groups} detail="Community structures" />
            <StatCard label="Campaigns" value={dashboardStats.campaigns} detail={`${dashboardStats.activeCampaigns} active`} />
            <StatCard label="Contributors" value={dashboardStats.contributors} detail="Identities tracked" />
            <StatCard label="Raised" value={`KES ${dashboardStats.totalRaised.toLocaleString()}`} detail="Across visible campaigns" />
          </>
        )}
      </section>

      <section className="grid grid-reporting">
        {!bootstrapped || loading ? (
          <>
            <SkeletonPanel lines={6} />
            <SkeletonPanel lines={6} />
          </>
        ) : (
          <>
            <Panel title="Contribution Over Time" subtitle="Campaign transaction flow visualized over time.">
              <ContributionOverTimeChart transactions={transactions} />
            </Panel>
            <Panel title="Top Contributors" subtitle="Largest confirmed contributors for the selected campaign.">
              <TopContributorsChart contributors={contributors} />
            </Panel>
          </>
        )}
      </section>
    </>
  );
}
