import { useEffect, useState } from "react";
import PaymentMethodCard from "../components/cards/PaymentMethodCard";
import TextField from "../components/forms/TextField";
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
    selectedCampaignId,
    setSelectedCampaignId,
    createCampaign,
    addPaymentMethod,
    updateCampaignStatus,
    log,
    loading,
    showNotice,
    clearNotice,
    getErrorMessage,
  } = useAppContext();
  const [campaignForm, setCampaignForm] = useState({ groupId: "", name: "", targetAmount: "", whatsappHeaderText: "", whatsappAdditionalInfo: "" });
  const [paymentForm, setPaymentForm] = useState({ campaignId: selectedCampaignId, methodType: "paybill", value: "", label: "" });

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

  return (
    <section className="grid grid-main">
      <Panel title="Campaigns" subtitle="Create focused fundraising campaigns and keep their status current.">
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
                whatsappHeaderText: campaignForm.whatsappHeaderText || undefined,
                whatsappAdditionalInfo: campaignForm.whatsappAdditionalInfo || undefined,
              });
            } catch (error) {
              const message = getErrorMessage(error, "Unknown error");
              log("Create campaign failed", message);
              showNotice({ tone: "error", title: "Create campaign failed", message });
              return;
            }

            setCampaignForm({ groupId: "", name: "", targetAmount: "", whatsappHeaderText: "", whatsappAdditionalInfo: "" });
          }}
        >
          <SelectField label="Group" value={campaignForm.groupId} helperText="Choose the group that owns this campaign." options={groups.map((group) => ({ value: group.id, label: group.name }))} onChange={(value) => setCampaignForm((current) => ({ ...current, groupId: value }))} />
          <TextField label="Campaign Name" value={campaignForm.name} helperText="Use a clear fundraising or contribution drive name." onChange={(value) => setCampaignForm((current) => ({ ...current, name: value }))} />
          <TextField label="Target Amount" type="number" helperText="Optional contribution target in Kenya shillings." value={campaignForm.targetAmount} onChange={(value) => setCampaignForm((current) => ({ ...current, targetAmount: value }))} />
          <TextField label="WhatsApp Header" value={campaignForm.whatsappHeaderText} helperText="Optional default top line for WhatsApp updates. It can still be edited later from the payments page." onChange={(value) => setCampaignForm((current) => ({ ...current, whatsappHeaderText: value }))} />
          <TextField label="WhatsApp Additional Line" value={campaignForm.whatsappAdditionalInfo} helperText="Optional extra line shown below the WhatsApp header." onChange={(value) => setCampaignForm((current) => ({ ...current, whatsappAdditionalInfo: value }))} />
          <button className="primary-button" type="submit">Create Campaign</button>
        </form>

        {loading ? <SkeletonPanel lines={5} /> : null}
        {!loading && (
          <div className="stack-list campaign-list">
            {campaigns.map((campaign) => {
              const target = Number(campaign.target_amount || 0);
              const totalRaised = Number(campaign.total_raised || 0);
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

            try {
              await addPaymentMethod(paymentForm);
            } catch (error) {
              const message = getErrorMessage(error, "Unknown error");
              log("Save payment method failed", message);
              showNotice({ tone: "error", title: "Save payment method failed", message });
              return;
            }

            setPaymentForm((current) => ({ ...current, value: "", label: "" }));
          }}
        >
          <SelectField label="Campaign" value={paymentForm.campaignId || selectedCampaignId} helperText="Choose which campaign should show this payment instruction." options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))} onChange={(value) => setPaymentForm((current) => ({ ...current, campaignId: value }))} />
          <SelectField label="Method Type" value={paymentForm.methodType} helperText="Select the payment channel supporters should use." options={paymentTypes} onChange={(value) => setPaymentForm((current) => ({ ...current, methodType: value }))} />
          <TextField label="Value" value={paymentForm.value} helperText="Enter the paybill, till, phone number, or bank reference." onChange={(value) => setPaymentForm((current) => ({ ...current, value }))} />
          <TextField label="Label" value={paymentForm.label} helperText="Use a short label like Main Paybill or Treasurer Line." onChange={(value) => setPaymentForm((current) => ({ ...current, label: value }))} />
          <button className="primary-button" type="submit">Save Method</button>
        </form>
        <div className="stack-list">
          {paymentMethods.map((method) => <PaymentMethodCard key={method.id} method={method} />)}
        </div>
      </Panel>
    </section>
  );
}
