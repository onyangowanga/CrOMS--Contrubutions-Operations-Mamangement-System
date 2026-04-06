import { useEffect, useState } from "react";
import PaymentMethodCard from "../components/cards/PaymentMethodCard";
import TextField from "../components/forms/TextField";
import TextAreaField from "../components/forms/TextAreaField";
import SelectField from "../components/forms/SelectField";
import Panel from "../components/panels/Panel";
import { SkeletonPanel } from "../components/ui/Skeletons";
import { formatCurrency, useAppContext } from "../context/AppContext";

const paymentTypes = ["paybill", "till", "phone", "bank"];

export default function CampaignsPage() {
  const {
    groups,
    campaigns,
    paymentMethods,
    selectedCampaign,
    selectedCampaignId,
    setSelectedCampaignId,
    createCampaign,
    updateCampaign,
    updateCampaignFixedContribution,
    addPaymentMethod,
    updateCampaignStatus,
    log,
    loading,
    showNotice,
    clearNotice,
    getErrorMessage,
  } = useAppContext();
  const [campaignTab, setCampaignTab] = useState("create");
  const [campaignForm, setCampaignForm] = useState({ groupId: "", name: "", targetAmount: "", fixedContributionAmount: "", whatsappHeaderText: "", whatsappAdditionalInfo: "" });
  const [campaignEditorForm, setCampaignEditorForm] = useState({ name: "", targetAmount: "", fixedContributionAmount: "", whatsappHeaderText: "", whatsappAdditionalInfo: "" });
  const [paymentForm, setPaymentForm] = useState({ campaignId: selectedCampaignId, methodType: "paybill", value: "", accountReference: "", label: "" });

  useEffect(() => {
    setCampaignForm((current) => ({
      ...current,
      groupId: current.groupId || groups[0]?.id || "",
    }));
  }, [groups]);

  useEffect(() => {
    if (!selectedCampaignId && campaigns[0]?.id) {
      setSelectedCampaignId(campaigns[0].id);
    }

    setPaymentForm((current) => ({
      ...current,
      campaignId: current.campaignId || selectedCampaignId || campaigns[0]?.id || "",
    }));
  }, [campaigns, selectedCampaignId, setSelectedCampaignId]);

  useEffect(() => {
    setCampaignEditorForm({
      name: selectedCampaign?.name || "",
      targetAmount: selectedCampaign?.target_amount ?? "",
      fixedContributionAmount: selectedCampaign?.fixed_contribution_amount ?? "",
      whatsappHeaderText: selectedCampaign?.whatsapp_header_text || "",
      whatsappAdditionalInfo: selectedCampaign?.whatsapp_additional_info || "",
    });
  }, [selectedCampaign]);

  return (
    <section className="grid grid-main">
      <Panel title="Campaign Setup" subtitle="Create new campaigns or update an existing one without leaving this page.">
        <div className="tab-row admin-tab-row">
          <button className={`tab-button ${campaignTab === "create" ? "active" : ""}`} type="button" onClick={() => setCampaignTab("create")}>Create Campaign</button>
          <button className={`tab-button ${campaignTab === "edit" ? "active" : ""}`} type="button" onClick={() => setCampaignTab("edit")}>Edit Campaign</button>
        </div>

        {campaignTab === "create" ? (
          <form
            className="form-grid compact"
            onSubmit={async (event) => {
              event.preventDefault();
              clearNotice();
              if (!campaignForm.groupId || !campaignForm.name.trim()) {
                log("Create campaign blocked", "Group and campaign name are required.");
                showNotice({ tone: "error", title: "Create campaign failed", message: "Group and campaign name are required." });
                return;
              }

              try {
                await createCampaign({
                  groupId: campaignForm.groupId,
                  name: campaignForm.name,
                  targetAmount: campaignForm.targetAmount || undefined,
                  fixedContributionAmount: campaignForm.fixedContributionAmount || undefined,
                  whatsappHeaderText: campaignForm.whatsappHeaderText || undefined,
                  whatsappAdditionalInfo: campaignForm.whatsappAdditionalInfo || undefined,
                });
              } catch (error) {
                const message = getErrorMessage(error, "Unknown error");
                log("Create campaign failed", message);
                showNotice({ tone: "error", title: "Create campaign failed", message });
                return;
              }

              setCampaignForm({ groupId: "", name: "", targetAmount: "", fixedContributionAmount: "", whatsappHeaderText: "", whatsappAdditionalInfo: "" });
            }}
          >
            <SelectField label="Group" value={campaignForm.groupId} helperText="Choose the group that owns this campaign." options={groups.map((group) => ({ value: group.id, label: group.name }))} onChange={(value) => setCampaignForm((current) => ({ ...current, groupId: value }))} />
            <TextField label="Campaign Name" value={campaignForm.name} helperText="Use a clear fundraising or contribution drive name." onChange={(value) => setCampaignForm((current) => ({ ...current, name: value }))} />
            <TextField label="Target Amount" type="number" helperText="Optional contribution target in Kenya shillings." value={campaignForm.targetAmount} onChange={(value) => setCampaignForm((current) => ({ ...current, targetAmount: value }))} />
            <TextField label="Suggested Member Contribution" type="number" helperText="Optional fixed amount used when payment allocations are suggested across campaigns." value={campaignForm.fixedContributionAmount} onChange={(value) => setCampaignForm((current) => ({ ...current, fixedContributionAmount: value }))} />
            <TextAreaField label="WhatsApp Header" rows={4} value={campaignForm.whatsappHeaderText} helperText="Optional default header block for WhatsApp updates. You can paste a title plus multiple narrative lines here." onChange={(value) => setCampaignForm((current) => ({ ...current, whatsappHeaderText: value }))} />
            <TextAreaField label="WhatsApp Additional Line" rows={5} value={campaignForm.whatsappAdditionalInfo} helperText="Optional extra block shown below the WhatsApp header. Use this for payment guidance or explanatory notes." onChange={(value) => setCampaignForm((current) => ({ ...current, whatsappAdditionalInfo: value }))} />
            <div className="form-actions-inline field-full">
              <button className="primary-button button-inline" type="submit">Create Campaign</button>
            </div>
          </form>
        ) : selectedCampaign ? (
          <form
            className="form-grid compact"
            onSubmit={async (event) => {
              event.preventDefault();
              clearNotice();

              if (!campaignEditorForm.name.trim()) {
                showNotice({ tone: "error", title: "Update campaign failed", message: "Campaign name is required." });
                return;
              }

              try {
                await updateCampaign(selectedCampaign.id, {
                  name: campaignEditorForm.name,
                  targetAmount: campaignEditorForm.targetAmount,
                  fixedContributionAmount: campaignEditorForm.fixedContributionAmount,
                  whatsappHeaderText: campaignEditorForm.whatsappHeaderText,
                  whatsappAdditionalInfo: campaignEditorForm.whatsappAdditionalInfo,
                });
                showNotice({ tone: "success", title: "Campaign updated", message: "Campaign details and WhatsApp defaults were saved." });
              } catch (error) {
                showNotice({ tone: "error", title: "Update campaign failed", message: getErrorMessage(error, "Unable to update the campaign.") });
              }
            }}
          >
            <SelectField label="Existing Campaign" value={selectedCampaignId} helperText="Choose which campaign you want to edit." options={campaigns.map((campaign) => ({ value: campaign.id, label: `${campaign.name} (${campaign.group_name || "Group"})` }))} onChange={setSelectedCampaignId} />
            <TextField label="Campaign Name" value={campaignEditorForm.name} helperText="Update the display name used across the app." onChange={(value) => setCampaignEditorForm((current) => ({ ...current, name: value }))} />
            <TextField label="Target Amount" type="number" helperText="Optional campaign target in Kenya shillings." value={campaignEditorForm.targetAmount} onChange={(value) => setCampaignEditorForm((current) => ({ ...current, targetAmount: value }))} />
            <TextField label="Suggested Member Contribution" type="number" helperText="Used by split-payment previews when this campaign is active in the same group." value={campaignEditorForm.fixedContributionAmount} onChange={(value) => setCampaignEditorForm((current) => ({ ...current, fixedContributionAmount: value }))} />
            <div className="campaign-editor-meta">
              <span className={`status-pill ${selectedCampaign.status}`}>{selectedCampaign.status}</span>
              <small>{selectedCampaign.group_name || "Group"}</small>
            </div>
            <TextAreaField label="WhatsApp Header" rows={5} value={campaignEditorForm.whatsappHeaderText} helperText="This becomes the default summary header, so you do not need to rewrite it on the Log Payment page each time." onChange={(value) => setCampaignEditorForm((current) => ({ ...current, whatsappHeaderText: value }))} />
            <TextAreaField label="WhatsApp Additional Line" rows={6} value={campaignEditorForm.whatsappAdditionalInfo} helperText="Store the recurring narrative, payment instructions, or reminders that should travel with this campaign." onChange={(value) => setCampaignEditorForm((current) => ({ ...current, whatsappAdditionalInfo: value }))} />
            <div className="button-row field-full">
              <button className="primary-button button-inline" type="submit">Save Campaign Details</button>
              <button className="ghost-button button-inline" type="button" onClick={() => setCampaignEditorForm({
                name: selectedCampaign?.name || "",
                targetAmount: selectedCampaign?.target_amount ?? "",
                fixedContributionAmount: selectedCampaign?.fixed_contribution_amount ?? "",
                whatsappHeaderText: selectedCampaign?.whatsapp_header_text || "",
                whatsappAdditionalInfo: selectedCampaign?.whatsapp_additional_info || "",
              })}>Reset</button>
            </div>
          </form>
        ) : (
          <p className="empty-note">Choose a campaign to edit its details.</p>
        )}

        {loading ? <SkeletonPanel lines={5} /> : null}
        {!loading && (
          <div className="stack-list campaign-list">
            {campaigns.map((campaign) => {
              const target = Number(campaign.target_amount || 0);
              const totalRaised = Number(campaign.total_raised || 0);
              const fixedContributionAmount = campaign.fixed_contribution_amount === null ? null : Number(campaign.fixed_contribution_amount || 0);
              const progress = target > 0 ? Math.min((totalRaised / target) * 100, 100) : 0;
              return (
                <article className={`list-card ${campaign.id === selectedCampaignId ? "selected" : ""}`} key={campaign.id}>
                  <div className="list-card-top">
                    <div>
                      <strong>{campaign.name}</strong>
                      <p>{campaign.group_name || "Group"}</p>
                    </div>
                    <span className={`status-pill ${campaign.status}`}>{campaign.status}</span>
                  </div>
                  <div className="meter">
                    <div className="meter-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="metric-row">
                    <span>Raised: KES {formatCurrency(totalRaised)}</span>
                    <span>Target: {target ? `KES ${formatCurrency(target)}` : "Not set"}</span>
                  </div>
                  <div className="metric-row">
                    <span>Suggested contribution: {fixedContributionAmount === null ? "Not set" : `KES ${formatCurrency(fixedContributionAmount)}`}</span>
                  </div>
                  <div className="button-row">
                    <button className="ghost-button" type="button" onClick={() => { setSelectedCampaignId(campaign.id); setPaymentForm((current) => ({ ...current, campaignId: campaign.id })); }}>Focus</button>
                    <button className="ghost-button" type="button" onClick={async () => {
                      clearNotice();
                      try {
                        await updateCampaignStatus(campaign.id, campaign.status === "active" ? "closed" : "active");
                      } catch (error) {
                        showNotice({ tone: "error", title: "Update campaign failed", message: getErrorMessage(error, "Unable to update campaign status.") });
                      }
                    }}>Mark {campaign.status === "active" ? "Closed" : "Active"}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Payment Channels" subtitle="Configure the payment instructions that appear in outgoing summaries.">
        <form
          className="form-grid compact"
          onSubmit={async (event) => {
            event.preventDefault();
            clearNotice();
            if (!paymentForm.campaignId || !paymentForm.methodType || !paymentForm.value.trim() || !paymentForm.label.trim()) {
              log("Save payment method blocked", "Campaign, method type, value, and label are required.");
              showNotice({ tone: "error", title: "Save payment method failed", message: "Campaign, method type, value, and label are required." });
              return;
            }

            if (paymentForm.methodType === "paybill" && !paymentForm.accountReference.trim()) {
              showNotice({ tone: "error", title: "Save payment method failed", message: "Paybill methods require an account number or name." });
              return;
            }

            try {
              await addPaymentMethod(paymentForm);
            } catch (error) {
              const message = getErrorMessage(error, "Unknown error");
              log("Save payment method failed", message);
              showNotice({ tone: "error", title: "Save payment method failed", message });
              return;
            }

            setPaymentForm((current) => ({ ...current, value: "", accountReference: "", label: "" }));
          }}
        >
          <SelectField label="Campaign" value={paymentForm.campaignId || selectedCampaignId} helperText="Choose which campaign should show this payment instruction." options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={(value) => setPaymentForm((current) => ({ ...current, campaignId: value }))} />
          <SelectField label="Method Type" value={paymentForm.methodType} helperText="Select the payment channel supporters should use." options={paymentTypes} onChange={(value) => setPaymentForm((current) => ({ ...current, methodType: value }))} />
          <TextField label="Value" value={paymentForm.value} helperText="Enter the paybill, till, phone number, or bank reference." onChange={(value) => setPaymentForm((current) => ({ ...current, value }))} />
          <TextField label={paymentForm.methodType === "paybill" ? "Account Number or Name" : "Reference Note"} value={paymentForm.accountReference} helperText={paymentForm.methodType === "paybill" ? "Required for paybill methods because each campaign has a different account reference." : "Optional extra note for this payment method."} onChange={(value) => setPaymentForm((current) => ({ ...current, accountReference: value }))} />
          <TextField label="Label" value={paymentForm.label} helperText="Use a short label like Main Paybill or Treasurer Line." onChange={(value) => setPaymentForm((current) => ({ ...current, label: value }))} />
          <div className="form-actions-inline field-full">
            <button className="primary-button button-inline" type="submit">Save Method</button>
          </div>
        </form>
        <div className="stack-list">
          {paymentMethods.map((method) => <PaymentMethodCard key={method.id} method={method} />)}
        </div>
      </Panel>
    </section>
  );
}
