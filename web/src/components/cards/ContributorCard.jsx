import { formatCurrency, formatPersonName } from "../../context/AppContext";

export default function ContributorCard({ contributor }) {
  return (
    <article className="list-card contributor-card">
      <strong>{formatPersonName(contributor.display_name, contributor.formal_name)}</strong>
      <p>{contributor.identity_type}</p>
      <small>KES {formatCurrency(contributor.total_contributed)}</small>
    </article>
  );
}
