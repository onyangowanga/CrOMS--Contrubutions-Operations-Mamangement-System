import { useState } from "react";
import SelectField from "../components/forms/SelectField";
import TextField from "../components/forms/TextField";
import Panel from "../components/panels/Panel";
import { formatPersonName } from "../context/AppContext";
import { formatCurrency, groupTransactionsByDay, useAppContext } from "../context/AppContext";

export default function ReportsPage() {
  const { campaigns, selectedCampaign, selectedCampaignId, setSelectedCampaignId, contributors, transactions, user, downloadContributorsCsv, downloadStatementExcel, downloadStatementPdf, deleteTransaction, showNotice, clearNotice, getErrorMessage } = useAppContext();
  const [deleteModal, setDeleteModal] = useState({ transaction: null, password: "" });
  const dailyTotals = groupTransactionsByDay(transactions);
  const transactionCount = transactions.length;
  const totalAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const canDeleteTransactions = user?.role === "admin" || user?.role === "treasurer";

  return (
    <>
      <section className="grid grid-reporting">
        <Panel title="Contributor Export" subtitle="Download the contributor ledger or a clean transaction statement in CSV, Excel, or PDF." actions={<div className="summary-actions reports-actions"><button className="ghost-button reports-action-button" type="button" onClick={async () => {
          clearNotice();
          try {
            await downloadContributorsCsv();
          } catch (error) {
            showNotice({ tone: "error", title: "CSV export failed", message: getErrorMessage(error, "Unable to export the contributor report.") });
          }
        }}><span className="button-icon" aria-hidden="true">↓</span><span>CSV</span></button><button className="ghost-button reports-action-button" type="button" onClick={async () => {
          clearNotice();
          try {
            await downloadStatementExcel();
          } catch (error) {
            showNotice({ tone: "error", title: "Excel export failed", message: getErrorMessage(error, "Unable to export the Excel statement.") });
          }
        }}><span className="button-icon" aria-hidden="true">↓</span><span>Excel</span></button><button className="primary-button reports-action-button" type="button" onClick={async () => {
          clearNotice();
          try {
            await downloadStatementPdf();
          } catch (error) {
            showNotice({ tone: "error", title: "PDF export failed", message: getErrorMessage(error, "Unable to export the PDF statement.") });
          }
        }}><span className="button-icon" aria-hidden="true">↓</span><span>PDF</span></button></div>}>
          <div className="compact-row">
            <SelectField label="Campaign Report" value={selectedCampaignId} helperText="Choose which campaign report you want to review or download." options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={setSelectedCampaignId} />
          </div>
          <p className="stats-note">
            {selectedCampaign ? `${selectedCampaign.name} has ${contributors.length} contributor records and ${transactionCount} transactions totaling KES ${formatCurrency(totalAmount)}.` : "Select a campaign from the campaigns page to focus reporting."}
          </p>
          <div className="list-table contributor-table">
            <div className="list-row table-head contributor-row">
              <strong>Contributor</strong>
              <span>Identity</span>
              <span>Total</span>
            </div>
            {contributors.map((contributor) => (
              <div className="list-row contributor-row" key={contributor.id}>
                <strong>{formatPersonName(contributor.display_name, contributor.formal_name, "Contributor")}</strong>
                <span>{contributor.identity_type || "individual"}</span>
                <span>KES {formatCurrency(contributor.total_contributed)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Daily Performance" subtitle="Review daily posting patterns across the selected campaign.">
          <div className="list-table">
            <div className="list-row table-head">
              <strong>Date</strong>
              <span>Transactions</span>
              <span>Amount</span>
            </div>
            {dailyTotals.map((row) => (
              <div className="list-row" key={row.label}>
                <strong>{row.label}</strong>
                <span>{row.count}</span>
                <span>KES {formatCurrency(row.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Transaction Statement" subtitle="Review posted campaign transactions and remove incorrect entries after confirming your password.">
          <div className="list-table">
            <div className="list-row table-head report-transaction-row">
              <strong>Reference</strong>
              <span>Contributor</span>
              <span>Amount</span>
              <span>Action</span>
            </div>
            {transactions.map((transaction) => (
              <div className="list-row report-transaction-row" key={transaction.id}>
                <strong>{transaction.transaction_code}</strong>
                <span>{transaction.sender_name || "Contributor"}</span>
                <span>KES {formatCurrency(transaction.amount)}</span>
                <span>
                  {canDeleteTransactions ? (
                    <button className="ghost-button transaction-delete-button" type="button" onClick={() => setDeleteModal({ transaction, password: "" })}>Delete</button>
                  ) : "Read only"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {deleteModal.transaction ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-transaction-title">
            <p className="modal-eyebrow">Report Action</p>
            <div className="list-card-top">
              <div>
                <h2 id="delete-transaction-title">Delete transaction</h2>
                <p className="modal-message">Enter your current password to permanently remove this transaction from the report and the database.</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setDeleteModal({ transaction: null, password: "" })}>Close</button>
            </div>
            <div className="confirmation-details">
              <div className="confirmation-detail"><span>Reference</span><strong>{deleteModal.transaction.transaction_code}</strong></div>
              <div className="confirmation-detail"><span>Amount</span><strong>KES {formatCurrency(deleteModal.transaction.amount)}</strong></div>
            </div>
            <div className="field-full">
              <TextField label="Current Password" type="password" helperText="This confirms that an authorized treasurer or admin is deleting the transaction." value={deleteModal.password} onChange={(value) => setDeleteModal((current) => ({ ...current, password: value }))} />
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setDeleteModal({ transaction: null, password: "" })}>Cancel</button>
              <button className="primary-button" type="button" onClick={async () => {
                clearNotice();
                try {
                  await deleteTransaction(deleteModal.transaction.id, deleteModal.password);
                  setDeleteModal({ transaction: null, password: "" });
                } catch (error) {
                  showNotice({ tone: "error", title: "Delete transaction failed", message: getErrorMessage(error, "Unable to delete the transaction.") });
                }
              }}>Delete Transaction</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
