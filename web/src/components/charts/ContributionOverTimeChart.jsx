import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axisTickStyle = {
  fontSize: 11,
  fill: "#61706c",
};

const tooltipLabelStyle = {
  color: "#1d2623",
  fontWeight: 700,
};

const tooltipContentStyle = {
  borderRadius: 14,
  border: "1px solid rgba(72, 58, 39, 0.13)",
  fontSize: 12,
};

function normalizeDateLabel(value) {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
  }
  return String(value).slice(0, 10);
}

export default function ContributionOverTimeChart({ transactions }) {
  const data = Object.values(
    transactions.reduce((accumulator, transaction) => {
      const label = normalizeDateLabel(transaction.event_time);
      if (!accumulator[label]) {
        accumulator[label] = { label, amount: 0 };
      }
      accumulator[label].amount += Number(transaction.amount || 0);
      return accumulator;
    }, {})
  );

  if (!data.length) {
    return <p className="empty-note">No transaction history yet.</p>;
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axisTickStyle} tickLine={false} axisLine={false} minTickGap={18} />
          <YAxis tick={axisTickStyle} tickLine={false} axisLine={false} width={44} />
          <Tooltip labelStyle={tooltipLabelStyle} contentStyle={tooltipContentStyle} formatter={(value) => [`KES ${Number(value || 0).toLocaleString()}`, "Amount"]} />
          <Area type="monotone" dataKey="amount" stroke="#b84c1b" fill="#f1c7af" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
