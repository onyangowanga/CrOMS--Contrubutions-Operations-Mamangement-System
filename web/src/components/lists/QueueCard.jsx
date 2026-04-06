import SelectField from "../forms/SelectField";
import TextField from "../forms/TextField";
import { formatCurrency, formatPersonName } from "../../context/AppContext";

export default function QueueCard({
  item,
  draft,
  contributors,
  identityTypes,
  onDraftChange,
  onApprove,
  onReject,
}) {
  return (
    <article className="list-card queue-card">
      <div className="list-card-top">
        <div>
          <strong>{formatPersonName(item.parsed_sender_name)}</strong>
          <p>{item.review_reason}</p>
        </div>
        <span className="badge neutral">Score {item.match_score ? Number(item.match_score).toFixed(2) : "n/a"}</span>
      </div>
      <div className="metric-row queue-meta">
        <span>Amount: KES {formatCurrency(item.parsed_amount)}</span>
        <span>Tx: {item.parsed_transaction_code}</span>
      </div>
      <div className="form-grid compact queue-form">
        <SelectField
          label="Use Existing Contributor"
          value={draft.contributorId}
          options={contributors.map((contributor) => ({
            value: contributor.id,
            label: `${formatPersonName(contributor.display_name, contributor.formal_name)} (${contributor.identity_type})`,
          }))}
          onChange={(value) => onDraftChange("contributorId", value)}
        />
        <TextField label="Display Name" value={draft.displayName} onChange={(value) => onDraftChange("displayName", value)} />
        <SelectField label="Identity Type" value={draft.identityType} options={identityTypes} onChange={(value) => onDraftChange("identityType", value)} />
        <TextField label="Reject Reason" value={draft.rejectionReason} onChange={(value) => onDraftChange("rejectionReason", value)} />
      </div>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={onApprove}>Approve and Save</button>
        <button className="ghost-button" type="button" onClick={onReject}>Reject</button>
      </div>
    </article>
  );
}
