import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPersonName } from "../../context/AppContext";

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

function truncateName(value) {
  const text = String(value || "");
  return text.length > 16 ? `${text.slice(0, 16)}...` : text;
}

export default function TopContributorsChart({ contributors }) {
  const data = contributors
    .slice()
    .sort((left, right) => Number(right.total_contributed || 0) - Number(left.total_contributed || 0))
    .slice(0, 5)
    .map((contributor) => ({
      name: formatPersonName(contributor.display_name, contributor.formal_name),
      amount: Number(contributor.total_contributed || 0),
    }));

  if (!data.length) {
    return <p className="empty-note">No contributor totals yet.</p>;
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 28, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={axisTickStyle} tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" width={108} tick={axisTickStyle} tickLine={false} axisLine={false} tickFormatter={truncateName} interval={0} />
          <Tooltip labelStyle={tooltipLabelStyle} contentStyle={tooltipContentStyle} formatter={(value) => [`KES ${Number(value || 0).toLocaleString()}`, "Amount"]} />
          <Bar dataKey="amount" fill="#5d6d3f" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
