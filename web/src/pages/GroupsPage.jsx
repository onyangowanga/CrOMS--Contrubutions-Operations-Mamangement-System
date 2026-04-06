import { useEffect, useState } from "react";
import TextField from "../components/forms/TextField";
import SelectField from "../components/forms/SelectField";
import Panel from "../components/panels/Panel";
import { SkeletonPanel } from "../components/ui/Skeletons";
import { formatPersonName, useAppContext } from "../context/AppContext";

export default function GroupsPage() {
  const { groups, users, loading, createUser, createGroup, assignMember, log, showNotice, clearNotice, getErrorMessage } = useAppContext();
  const [activeAdminTab, setActiveAdminTab] = useState("group");
  const [userForm, setUserForm] = useState({ fullName: "", email: "", password: "", role: "treasurer" });
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    brandName: "",
    brandColor: "",
  });
  const [memberForm, setMemberForm] = useState({ groupId: "", userId: "", role: "treasurer" });

  useEffect(() => {
    setMemberForm((current) => ({
      ...current,
      groupId: current.groupId || groups[0]?.id || "",
      userId: current.userId || users[0]?.id || "",
    }));
  }, [groups, users]);

  return (
    <section className="grid grid-main">
      <Panel title="Administration" subtitle="Create groups first, then create users and assign them to the right group workspace.">
        <div className="tab-row admin-tab-row">
          <button className={`tab-button ${activeAdminTab === "group" ? "active" : ""}`} type="button" onClick={() => setActiveAdminTab("group")}>Create Group</button>
          <button className={`tab-button ${activeAdminTab === "user" ? "active" : ""}`} type="button" onClick={() => setActiveAdminTab("user")}>Create User</button>
        </div>

        {activeAdminTab === "group" ? (
        <form
          className="form-grid compact"
          onSubmit={async (event) => {
            event.preventDefault();
            clearNotice();
            if (!groupForm.name.trim()) {
              log("Create group blocked", "Group name is required before submission.");
              showNotice({ tone: "error", title: "Create group failed", message: "Group name is required before submission." });
              return;
            }

            try {
              await createGroup(groupForm);
            } catch (error) {
              const message = getErrorMessage(error, "Unknown error");
              log("Create group failed", message);
              showNotice({ tone: "error", title: "Create group failed", message });
              return;
            }

            setGroupForm({
              name: "",
              description: "",
              brandName: "",
              brandColor: "",
            });
          }}
        >
          <TextField label="Group Name" value={groupForm.name} helperText="Use the independent organization, church, welfare, or committee name." onChange={(value) => setGroupForm((current) => ({ ...current, name: value }))} />
          <TextField label="Description" value={groupForm.description} helperText="Optional short description of what this group uses CrOMS for." onChange={(value) => setGroupForm((current) => ({ ...current, description: value }))} />
          <TextField label="Brand Name" value={groupForm.brandName} helperText="Optional shorter public brand name for summaries and headers." onChange={(value) => setGroupForm((current) => ({ ...current, brandName: value }))} />
          <TextField label="Brand Color" value={groupForm.brandColor} helperText="Optional primary color hex code for this group workspace." onChange={(value) => setGroupForm((current) => ({ ...current, brandColor: value }))} />
          <button className="primary-button" type="submit">Create Group</button>
        </form>
        ) : (
        <div className="mini-grid">
        <form
          className="form-grid compact"
          onSubmit={async (event) => {
            event.preventDefault();
            clearNotice();

            if (!userForm.fullName.trim() || !userForm.email.trim() || !userForm.password) {
              showNotice({ tone: "error", title: "Create user failed", message: "Full name, email, and password are required." });
              return;
            }

            try {
              await createUser(userForm);
              setUserForm({ fullName: "", email: "", password: "", role: "treasurer" });
            } catch (error) {
              showNotice({ tone: "error", title: "Create user failed", message: getErrorMessage(error, "Unable to create the user.") });
            }
          }}
        >
          <TextField label="Full Name" value={userForm.fullName} helperText="Enter the full name of the user who will access this workspace." onChange={(value) => setUserForm((current) => ({ ...current, fullName: value }))} />
          <TextField label="Email" type="email" value={userForm.email} helperText="This email becomes the login username for the account." onChange={(value) => setUserForm((current) => ({ ...current, email: value }))} />
          <TextField label="Password" type="password" value={userForm.password} helperText="Set an initial password. The user can change it after signing in." onChange={(value) => setUserForm((current) => ({ ...current, password: value }))} />
          <SelectField label="Role" value={userForm.role} helperText="Treasurers manage their own group data. Viewers can only read it." options={["viewer", "treasurer", "admin"]} onChange={(value) => setUserForm((current) => ({ ...current, role: value }))} />
          <button className="primary-button" type="submit">Create User</button>
        </form>
        <form
          className="form-grid compact overlay-form"
          onSubmit={async (event) => {
            event.preventDefault();
            clearNotice();
            if (!memberForm.groupId || !memberForm.userId || !memberForm.role) {
              log("Assign member blocked", "Group, user, and role are required.");
              showNotice({ tone: "error", title: "Assign member failed", message: "Group, user, and role are required." });
              return;
            }

            try {
              await assignMember(memberForm.groupId, { userId: memberForm.userId, role: memberForm.role });
            } catch (error) {
              const message = getErrorMessage(error, "Unknown error");
              log("Assign member failed", message);
              showNotice({ tone: "error", title: "Assign member failed", message });
            }
          }}
        >
          <SelectField label="Group" value={memberForm.groupId} helperText="Choose the independent group workspace this user should access." options={groups.map((group) => ({ value: group.id, label: group.name }))} onChange={(value) => setMemberForm((current) => ({ ...current, groupId: value }))} />
          <SelectField label="User" value={memberForm.userId} helperText="Pick the user account you want to attach to the selected group." options={users.map((entry) => ({ value: entry.id, label: `${formatPersonName(entry.full_name)} (${entry.role})` }))} onChange={(value) => setMemberForm((current) => ({ ...current, userId: value }))} />
          <SelectField label="Role" value={memberForm.role} helperText="Set the role this user should hold inside the chosen group." options={["viewer", "treasurer", "admin"]} onChange={(value) => setMemberForm((current) => ({ ...current, role: value }))} />
          <button className="ghost-button" type="submit">Assign to Group</button>
        </form>
        </div>
        )}
      </Panel>

      <div className="mini-grid">
        <Panel title="Groups" subtitle="Created organizations and their branding settings.">
          {loading ? <SkeletonPanel lines={6} /> : null}
          {!loading && (
            <div className="stack-list">
              {groups.map((group) => (
                <article className="list-card" key={group.id}>
                  <div className="list-card-top">
                    <div>
                      <strong>{group.name}</strong>
                      <p>{group.description || "No description"}</p>
                    </div>
                    <span className="badge" style={{ backgroundColor: group.brand_color || "#dfe7dc" }}>{group.brand_name || "Brand"}</span>
                  </div>
                  <small>{group.id}</small>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Users" subtitle="Recently created users and their access level.">
          {loading ? <SkeletonPanel lines={5} /> : null}
          {!loading ? (
            <div className="stack-list">
              {users.map((entry) => (
                <article className="list-card" key={entry.id}>
                  <div className="list-card-top">
                    <div>
                      <strong>{formatPersonName(entry.full_name)}</strong>
                      <p>{entry.email}</p>
                    </div>
                    <span className="badge neutral">{entry.role}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>
    </section>
  );
}
