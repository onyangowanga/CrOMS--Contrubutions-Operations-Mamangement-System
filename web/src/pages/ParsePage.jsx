import { useEffect, useState } from "react";
import SelectField from "../components/forms/SelectField";
import TextAreaField from "../components/forms/TextAreaField";
import TextField from "../components/forms/TextField";
import QueueCard from "../components/lists/QueueCard";
import Panel from "../components/panels/Panel";
import { formatPersonName, useAppContext } from "../context/AppContext";

const identityTypes = ["individual", "titled_individual", "family", "group", "organization", "anonymous"];

function extractPreview(rawText, displayName) {
  const normalized = rawText.replace(/\s+/g, " ").trim();
  const amountMatch = normalized.match(/(?:ksh|kes)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const nameMatch = normalized.match(/from\s+([A-Za-z][A-Za-z .,'-]{2,}?)(?:\s+\d{3,4}\*{2,4}\d{2,4})?(?=\s+on\b|\s+at\b|\.|$)/i);

  return {
    contributorName: formatPersonName(displayName || nameMatch?.[1] || "Contributor"),
    amount: amountMatch ? `KES ${amountMatch[1]}` : "Not detected",
  };
}

function AllocationEditor({ campaigns, allocationPreview, onPriorityChange, onAllocationChange }) {
  if (!allocationPreview) {
    return null;
  }

  return (
    <div className="allocation-panel field-full">
      <div className="allocation-panel-head">
        <div>
          <strong>Allocation Preview</strong>
          <p>Review the suggested split and adjust amounts only where needed.</p>
        </div>
        <div className="allocation-balance">Unallocated: KES {Number(allocationPreview.unallocatedAmount || 0).toLocaleString()}</div>
      </div>
      <div className="form-grid compact allocation-grid">
      <SelectField
        label="Priority Campaign"
        value={allocationPreview.priorityCampaignId}
        helperText="Suggestions fill fixed campaign amounts first, then place any balance on this campaign."
        options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))}
        onChange={onPriorityChange}
      />
      <div className="field field-full">
        <div className="stack-list compact-list allocation-list">
          {allocationPreview.allocations.map((allocation) => (
            <article className="list-card allocation-card" key={allocation.campaignId}>
              <div className="list-card-top">
                <strong>{allocation.campaignName}</strong>
                <span className="badge neutral">
                  {allocation.fixedContributionAmount === null ? "Open amount" : `Fixed KES ${allocation.fixedContributionAmount.toLocaleString()}`}
                </span>
              </div>
              <div className="metric-row">
                <span>Already contributed: KES {Number(allocation.alreadyContributed || 0).toLocaleString()}</span>
                <span>Outstanding: {allocation.outstandingAmount === null ? "Not set" : `KES ${Number(allocation.outstandingAmount || 0).toLocaleString()}`}</span>
              </div>
              <TextField
                label="Allocated Amount"
                type="number"
                value={String(allocation.suggestedAmount || "")}
                helperText="Set to zero to exclude this campaign from the current payment."
                onChange={(value) => onAllocationChange(allocation.campaignId, value)}
              />
            </article>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

export default function ParsePage() {
  const {
    campaigns,
    contributors,
    paymentMethods,
    selectedCampaign,
    selectedCampaignId,
    setSelectedCampaignId,
    previewContributionAllocation,
    parseTransaction,
    createManualTransaction,
    confirmations,
    summaryText,
    loadSummary,
    summaryOptions,
    setSummaryOptions,
    loading,
    log,
    showNotice,
    clearNotice,
    requestConfirmation,
    ensureReviewDraft,
    updateReviewDraft,
    approveConfirmation,
    rejectConfirmation,
    discardConfirmation,
    getErrorMessage,
  } = useAppContext();
  const [activeTab, setActiveTab] = useState("mpesa");
  const [parseResult, setParseResult] = useState(null);
  const [manualResult, setManualResult] = useState(null);
  const [activeReviewId, setActiveReviewId] = useState("");
  const [copyState, setCopyState] = useState("");
  const [summaryForm, setSummaryForm] = useState(summaryOptions);
  const [parseForm, setParseForm] = useState({
    campaignId: selectedCampaignId,
    priorityCampaignId: selectedCampaignId,
    displayName: "",
    identityType: "individual",
    rawText: "",
    allocations: [],
  });
  const [manualForm, setManualForm] = useState({
    campaignId: selectedCampaignId,
    priorityCampaignId: selectedCampaignId,
    contributorId: "",
    displayName: "",
    identityType: "individual",
    amount: "",
    referenceCode: "",
    eventTime: "",
    note: "",
    allocations: [],
  });
  const [parseAllocationPreview, setParseAllocationPreview] = useState(null);
  const [manualAllocationPreview, setManualAllocationPreview] = useState(null);
  const [activeReviewSource, setActiveReviewSource] = useState("");

  useEffect(() => {
    if (!selectedCampaignId && campaigns[0]?.id) {
      setSelectedCampaignId(campaigns[0].id);
    }

    setParseForm((current) => ({
      ...current,
      campaignId: current.campaignId || selectedCampaignId || campaigns[0]?.id || "",
      priorityCampaignId: current.priorityCampaignId || current.campaignId || selectedCampaignId || campaigns[0]?.id || "",
    }));

    setManualForm((current) => ({
      ...current,
      campaignId: current.campaignId || selectedCampaignId || campaigns[0]?.id || "",
      priorityCampaignId: current.priorityCampaignId || current.campaignId || selectedCampaignId || campaigns[0]?.id || "",
    }));
  }, [campaigns, selectedCampaignId, setSelectedCampaignId]);

  useEffect(() => {
    setSummaryForm(summaryOptions);
  }, [summaryOptions]);

  useEffect(() => {
    setSummaryForm((current) => ({
      ...current,
      headerText: current.headerText || selectedCampaign?.whatsapp_header_text || "",
      additionalInfo: current.additionalInfo || selectedCampaign?.whatsapp_additional_info || "",
    }));
  }, [selectedCampaign]);

  const activeReviewItem = confirmations.find((item) => item.id === activeReviewId) || null;
  const activeDraft = activeReviewItem ? ensureReviewDraft(activeReviewItem) : null;

  function normalizeAllocations(allocationPreview) {
    if (!allocationPreview) {
      return [];
    }

    return allocationPreview.allocations
      .map((allocation) => ({
        campaignId: allocation.campaignId,
        amount: Number(allocation.suggestedAmount || 0),
      }))
      .filter((allocation) => allocation.amount > 0);
  }

  function updateAllocationPreview(setter, campaignId, value) {
    setter((current) => {
      if (!current) {
        return current;
      }

      const numericValue = value === "" ? 0 : Number(value);
      const allocations = current.allocations.map((allocation) => (
        allocation.campaignId === campaignId
          ? { ...allocation, suggestedAmount: Number.isFinite(numericValue) ? numericValue : allocation.suggestedAmount }
          : allocation
      ));
      const allocatedTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.suggestedAmount || 0), 0);

      return {
        ...current,
        allocations,
        unallocatedAmount: Number(current.totalAmount || 0) - allocatedTotal,
      };
    });
  }

  async function loadAllocationPreview(mode, nextPriorityCampaignId) {
    const isManual = mode === "manual";
    const form = isManual ? manualForm : parseForm;
    const amount = isManual ? Number(form.amount || 0) : Number(extractPreview(form.rawText, form.displayName).amount.replace(/[^\d.]/g, "")) || 0;

    if (!form.campaignId || !amount) {
      const message = "Select a campaign and provide a valid payment amount before previewing allocations.";
      showNotice({ tone: "error", title: "Allocation preview failed", message });
      return;
    }

    try {
      const preview = await previewContributionAllocation({
        campaignId: form.campaignId,
        priorityCampaignId: nextPriorityCampaignId || form.priorityCampaignId || form.campaignId,
        contributorId: isManual ? form.contributorId || undefined : undefined,
        displayName: form.displayName || undefined,
        identityType: form.identityType || undefined,
        amount,
      });

      if (isManual) {
        setManualAllocationPreview(preview);
        setManualForm((current) => ({ ...current, allocations: normalizeAllocations(preview) }));
      } else {
        setParseAllocationPreview(preview);
        setParseForm((current) => ({ ...current, allocations: normalizeAllocations(preview) }));
      }
    } catch (error) {
      showNotice({ tone: "error", title: "Allocation preview failed", message: getErrorMessage(error, "Unable to calculate a suggested split.") });
    }
  }

  function messageNeedsDisplayName(rawText, displayName) {
    if (typeof displayName === "string" && displayName.trim()) {
      return false;
    }

    const normalized = rawText.replace(/\s+/g, " ").trim();
    if (/\bfor\s+account\b/i.test(normalized)) {
      return true;
    }

    return !/received\s+from\s+|from\s+[A-Za-z][A-Za-z .,'-]{2,}?/i.test(normalized);
  }

  function openReviewPopup(item, source = "existing") {
    setActiveReviewId(item.id);
    setActiveReviewSource(source);
  }

  async function closeReviewPopup(skipDiscard = false) {
    if (!skipDiscard && activeReviewItem && activeReviewSource === "fresh") {
      try {
        await discardConfirmation(activeReviewItem);
        showNotice({ tone: "success", title: "Queued transaction discarded", message: "The queued transaction was removed because the review popup was closed without approval." });
      } catch (error) {
        showNotice({ tone: "error", title: "Discard queued transaction failed", message: getErrorMessage(error, "Unable to discard the queued transaction.") });
      }
    }

    setActiveReviewId("");
    setActiveReviewSource("");
  }

  async function copySummary() {
    clearNotice();
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyState("Summary copied for WhatsApp sharing.");
      window.setTimeout(() => setCopyState(""), 2200);
    } catch (error) {
      showNotice({ tone: "error", title: "Copy failed", message: getErrorMessage(error, "Clipboard access was denied.") });
    }
  }

  function openWhatsappSummary() {
    clearNotice();

    if (!summaryText || !summaryText.trim()) {
      showNotice({ tone: "error", title: "WhatsApp open failed", message: "Refresh the summary before opening WhatsApp." });
      return;
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="grid grid-ops">
      <Panel
        title="Log Payment"
        subtitle="Capture M-Pesa or cash contributions from one focused workflow."
        actions={confirmations.length > 0 ? <button className="ghost-button" type="button" onClick={() => openReviewPopup(confirmations[0])}>Pending Reviews ({confirmations.length})</button> : null}
      >
        <div className="tab-row">
          <button className={`tab-button ${activeTab === "mpesa" ? "active" : ""}`} type="button" onClick={() => setActiveTab("mpesa")}>M-Pesa Payment</button>
          <button className={`tab-button ${activeTab === "cash" ? "active" : ""}`} type="button" onClick={() => setActiveTab("cash")}>Cash Payment</button>
        </div>

        {activeTab === "mpesa" ? (
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              clearNotice();
              if (!parseForm.campaignId || !parseForm.rawText.trim()) {
                log("Parse blocked", "Campaign and raw message are required.");
                showNotice({ tone: "error", title: "Log payment failed", message: "Campaign and raw message are required." });
                setParseResult({ status: "error", error: "Campaign and raw message are required." });
                return;
              }

              let nextDisplayName = parseForm.displayName;
              if (messageNeedsDisplayName(parseForm.rawText, parseForm.displayName)) {
                nextDisplayName = window.prompt("This transaction message does not contain the contributor name. Enter a display name before posting.", parseForm.displayName || "") || "";
                if (!nextDisplayName.trim()) {
                  showNotice({ tone: "error", title: "Display name required", message: "Enter a display name before posting this transaction." });
                  return;
                }

                setParseForm((current) => ({ ...current, displayName: nextDisplayName }));
              }

              const preview = extractPreview(parseForm.rawText, nextDisplayName);
              const confirmed = await requestConfirmation({
                title: "Post M-Pesa contribution",
                message: "Please review this transaction before it is posted to the campaign ledger.",
                confirmLabel: "Post transaction",
                details: [
                  { label: "Contributor", value: preview.contributorName },
                  { label: "Amount", value: preview.amount },
                ],
              });

              if (!confirmed) {
                showNotice({ tone: "success", title: "Posting cancelled", message: "The transaction was not posted." });
                return;
              }

              try {
                const response = await parseTransaction({
                  ...parseForm,
                  displayName: nextDisplayName,
                  priorityCampaignId: parseForm.priorityCampaignId || parseForm.campaignId,
                  allocations: normalizeAllocations(parseAllocationPreview),
                });
                setParseResult(response);
                if (response.status === "queued" && response.confirmation?.id) {
                  openReviewPopup(response.confirmation, "fresh");
                }
              } catch (error) {
                log("Parse failed", error instanceof Error ? error.message : "Unknown parse error");
                setParseResult({ status: "error", error: error instanceof Error ? error.message : "Unknown parse error" });
              }
            }}
          >
            <SelectField label="Campaign" value={parseForm.campaignId} helperText="Choose the campaign that should receive this payment." options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={(value) => {
              setParseAllocationPreview(null);
              setParseForm((current) => ({ ...current, campaignId: value, priorityCampaignId: value, allocations: [] }));
            }} />
            <TextField label="Display Name Override" value={parseForm.displayName} helperText="Optional corrected contributor name if the sender text needs help." onChange={(value) => setParseForm((current) => ({ ...current, displayName: value }))} />
            <SelectField label="Identity Type" value={parseForm.identityType} helperText="Set the contributor type when the sender should be stored differently." options={identityTypes} onChange={(value) => setParseForm((current) => ({ ...current, identityType: value }))} />
            <div className="form-actions-inline">
              <button className="primary-button button-inline" type="button" onClick={() => loadAllocationPreview("parse")}>Preview Allocation</button>
            </div>
            <TextAreaField label="Raw Message" rows={8} helperText="Paste the full M-Pesa confirmation message exactly as received." value={parseForm.rawText} onChange={(value) => setParseForm((current) => ({ ...current, rawText: value }))} />
            <AllocationEditor
              campaigns={campaigns}
              allocationPreview={parseAllocationPreview}
              onPriorityChange={async (value) => {
                setParseForm((current) => ({ ...current, priorityCampaignId: value }));
                if (parseAllocationPreview) {
                  await loadAllocationPreview("parse", value);
                }
              }}
              onAllocationChange={(campaignId, value) => {
                updateAllocationPreview(setParseAllocationPreview, campaignId, value);
              }}
            />
            <div className="form-actions-inline field-full">
              <button className="primary-button button-inline" type="submit">{loading ? "Processing..." : "Post M-Pesa Payment"}</button>
            </div>
          </form>
        ) : (
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              clearNotice();

              if (!manualForm.campaignId || !manualForm.amount || (!manualForm.contributorId && !manualForm.displayName.trim())) {
                const message = "Campaign, amount, and either an existing contributor or display name are required.";
                showNotice({ tone: "error", title: "Manual contribution failed", message });
                setManualResult({ status: "error", error: message });
                return;
              }

              const contributorName = manualForm.displayName || contributors.find((entry) => entry.id === manualForm.contributorId)?.display_name || "Contributor";
              const confirmed = await requestConfirmation({
                title: "Post cash contribution",
                message: "This cash contribution will be written directly to the campaign statement.",
                confirmLabel: "Post cash entry",
                details: [
                  { label: "Contributor", value: formatPersonName(contributorName) },
                  { label: "Amount", value: `KES ${manualForm.amount}` },
                ],
              });

              if (!confirmed) {
                showNotice({ tone: "success", title: "Posting cancelled", message: "The cash contribution was not posted." });
                return;
              }

              try {
                const response = await createManualTransaction({
                  ...manualForm,
                  priorityCampaignId: manualForm.priorityCampaignId || manualForm.campaignId,
                  allocations: normalizeAllocations(manualAllocationPreview),
                });
                setManualResult(response);
                setManualForm((current) => ({
                  ...current,
                  contributorId: "",
                  displayName: "",
                  amount: "",
                  referenceCode: "",
                  eventTime: "",
                  note: "",
                  allocations: [],
                }));
                setManualAllocationPreview(null);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown manual contribution error";
                showNotice({ tone: "error", title: "Manual contribution failed", message });
                setManualResult({ status: "error", error: message });
              }
            }}
          >
            <SelectField label="Campaign" value={manualForm.campaignId} helperText="Choose the campaign that should receive this cash contribution." options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={(value) => {
              setManualAllocationPreview(null);
              setManualForm((current) => ({ ...current, campaignId: value, priorityCampaignId: value, allocations: [] }));
            }} />
            <SelectField label="Existing Contributor" value={manualForm.contributorId} helperText="Select an existing contributor or leave blank and type a name below." options={contributors.map((contributor) => ({ value: contributor.id, label: formatPersonName(contributor.display_name, contributor.formal_name) }))} onChange={(value) => setManualForm((current) => ({ ...current, contributorId: value }))} />
            <TextField label="Display Name" value={manualForm.displayName} helperText="Use this when the cash giver is not already in the list above." onChange={(value) => setManualForm((current) => ({ ...current, displayName: value }))} />
            <SelectField label="Identity Type" value={manualForm.identityType} helperText="Store the contribution under the right contributor type." options={identityTypes} onChange={(value) => setManualForm((current) => ({ ...current, identityType: value }))} />
            <TextField label="Amount" type="number" helperText="Enter the contribution amount in Kenya shillings." value={manualForm.amount} onChange={(value) => setManualForm((current) => ({ ...current, amount: value }))} />
            <div className="form-actions-inline">
              <button className="primary-button button-inline" type="button" onClick={() => loadAllocationPreview("manual")}>Preview Allocation</button>
            </div>
            <TextField label="Reference Code" value={manualForm.referenceCode} helperText="Optional cash receipt or manual reference code." onChange={(value) => setManualForm((current) => ({ ...current, referenceCode: value }))} />
            <TextField label="Received At" type="datetime-local" helperText="Optional received date and time for the cash payment." value={manualForm.eventTime} onChange={(value) => setManualForm((current) => ({ ...current, eventTime: value }))} />
            <TextField label="Note" value={manualForm.note} helperText="Optional context such as event name, basket, or collector note." onChange={(value) => setManualForm((current) => ({ ...current, note: value }))} />
            <AllocationEditor
              campaigns={campaigns}
              allocationPreview={manualAllocationPreview}
              onPriorityChange={async (value) => {
                setManualForm((current) => ({ ...current, priorityCampaignId: value }));
                if (manualAllocationPreview) {
                  await loadAllocationPreview("manual", value);
                }
              }}
              onAllocationChange={(campaignId, value) => {
                updateAllocationPreview(setManualAllocationPreview, campaignId, value);
              }}
            />
            <div className="form-actions-inline field-full">
              <button className="primary-button button-inline" type="submit">{loading ? "Processing..." : "Post Cash Payment"}</button>
            </div>
          </form>
        )}

        {parseResult && activeTab === "mpesa" ? (
          <article className={`parse-feedback ${parseResult.status || "error"}`}>
            <strong>
              {parseResult.status === "saved"
                ? "Contribution stored."
                : parseResult.status === "queued"
                  ? "Contribution queued for review."
                  : parseResult.status === "duplicate"
                    ? "Duplicate transaction ignored."
                    : "Parse failed."}
            </strong>
            <p>
              {parseResult.status === "duplicate"
                ? `Transaction code ${parseResult.duplicate?.reference_code || "already exists"} was already recorded in ${parseResult.duplicate?.source_table || "the system"}.`
                : parseResult.message || parseResult.error || "The transaction was processed."}
            </p>
          </article>
        ) : null}

        {manualResult && activeTab === "cash" ? (
          <article className={`parse-feedback ${manualResult.status || "error"}`}>
            <strong>{manualResult.status === "saved" ? "Cash contribution stored." : "Manual contribution failed."}</strong>
            <p>{manualResult.error || manualResult.message || "The cash contribution was processed."}</p>
          </article>
        ) : null}
      </Panel>

      <Panel
        title="WhatsApp Summary"
        subtitle="Review the outgoing contribution update directly under the payment workflow."
        actions={
          <div className="summary-actions">
            <button className="ghost-button" type="button" onClick={async () => {
              clearNotice();
              try {
                setSummaryOptions(summaryForm);
                await loadSummary(selectedCampaignId, summaryForm);
              } catch (error) {
                showNotice({ tone: "error", title: "Summary refresh failed", message: getErrorMessage(error, "Unable to refresh the summary.") });
              }
            }}>Refresh</button>
            <button className="primary-button whatsapp-button" type="button" onClick={openWhatsappSummary}>Open WhatsApp</button>
            <button className="primary-button" type="button" onClick={copySummary}>Copy Summary</button>
          </div>
        }
      >
        <div className="form-grid compact summary-settings compact-row">
          <SelectField label="Campaign" value={selectedCampaignId} helperText="Change the campaign if you want to preview another WhatsApp update." options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={setSelectedCampaignId} />
          <TextAreaField label="Top Message" rows={4} value={summaryForm.headerText} helperText="This defaults from the campaign setup and can contain multiple lines for a full narrative header." onChange={(value) => setSummaryForm((current) => ({ ...current, headerText: value }))} />
          <TextAreaField label="Additional Line" rows={5} value={summaryForm.additionalInfo} helperText="Optional extra block shown below the top message, including payment guidance or reminders." onChange={(value) => setSummaryForm((current) => ({ ...current, additionalInfo: value }))} />
          <label className="field checkbox-field">
            <span>Summary Options</span>
            <div className="checkbox-stack">
              <label className="checkbox-option">
                <input type="checkbox" checked={summaryForm.includeTarget} onChange={(event) => setSummaryForm((current) => ({ ...current, includeTarget: event.target.checked }))} />
                <span>Include target</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" checked={summaryForm.includeDeficit} onChange={(event) => setSummaryForm((current) => ({ ...current, includeDeficit: event.target.checked }))} />
                <span>Include deficit</span>
              </label>
            </div>
          </label>
        </div>
        {copyState ? <p className="copy-state">{copyState}</p> : null}
        <pre className="console-box summary-box">{summaryText}</pre>
        <div className="stack-list compact-list">
          {paymentMethods.length === 0 ? <p className="empty-note">No payment methods configured for this campaign.</p> : null}
          {paymentMethods.map((method) => (
            <article className="list-card" key={method.id}>
              <div className="list-card-top">
                <strong>{method.label}</strong>
                <span className="badge neutral">{method.method_type}</span>
              </div>
              <p>{method.value}</p>
              {method.account_reference ? <small>Account: {method.account_reference}</small> : null}
            </article>
          ))}
        </div>
      </Panel>

      {activeReviewItem && activeDraft ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-labelledby="pending-review-title">
            <p className="modal-eyebrow">Pending Review</p>
            <div className="list-card-top">
              <div>
                <h2 id="pending-review-title">Review ambiguous contribution</h2>
                <p className="modal-message">This contribution needs confirmation before it can be posted to the ledger.</p>
              </div>
              <button className="ghost-button" type="button" onClick={closeReviewPopup}>Close</button>
            </div>
            <QueueCard
              item={activeReviewItem}
              draft={activeDraft}
              contributors={contributors}
              identityTypes={identityTypes}
              onDraftChange={(field, value) => updateReviewDraft(activeReviewItem.id, field, value)}
              onApprove={async () => {
                clearNotice();
                const confirmed = await requestConfirmation({
                  title: "Approve queued contribution",
                  message: "This contribution will be posted to the ledger and removed from the review queue.",
                  confirmLabel: "Approve and post",
                  details: [
                    { label: "Contributor", value: formatPersonName(activeDraft.displayName, activeReviewItem.parsed_sender_name) },
                    { label: "Amount", value: `KES ${Number(activeReviewItem.parsed_amount).toLocaleString()}` },
                  ],
                });

                if (!confirmed) {
                  showNotice({ tone: "success", title: "Posting cancelled", message: "The queued contribution was not posted." });
                  return;
                }

                try {
                  await approveConfirmation(activeReviewItem, activeDraft);
                  await closeReviewPopup(true);
                } catch (error) {
                  showNotice({ tone: "error", title: "Approve confirmation failed", message: getErrorMessage(error, "Unable to approve the queued contribution.") });
                }
              }}
              onReject={async () => {
                clearNotice();
                try {
                  await rejectConfirmation(activeReviewItem, activeDraft);
                  await closeReviewPopup(true);
                } catch (error) {
                  showNotice({ tone: "error", title: "Reject confirmation failed", message: getErrorMessage(error, "Unable to reject the queued contribution.") });
                }
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
