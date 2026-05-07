"use client";

import {
  Building2,
  ClipboardList,
  MessageCircle,
  Plus,
  Power,
  RotateCcw,
  Save,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "./DataTable";
import { ROLE_NAMES } from "@/lib/constants";
import { languageLabel, SUPPORTED_LANGUAGES } from "@/lib/languages";

type BaseEntity = {
  id: string;
  name: string;
  code?: string;
  active?: boolean;
};

type UserEntity = {
  id: string;
  name: string;
  email: string;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  whatsappNumber?: string | null;
  whatsappEnabled: boolean;
  preferredLanguage: string;
  active: boolean;
  role: { name: string };
  union?: { name: string } | null;
  conference?: { name: string } | null;
  district?: { name: string } | null;
  church?: { name: string } | null;
};

type AdminPanelProps = {
  unions: BaseEntity[];
  conferences: (BaseEntity & { unionId: string; union: { name: string } })[];
  districts: (BaseEntity & { conferenceId: string; conference: { name: string } })[];
  churches: (BaseEntity & { districtId: string; district: { name: string } })[];
  requestTypes: BaseEntity[];
  users: UserEntity[];
  roles: { id: string; name: string; description: string | null }[];
};

type HierarchyTab = "unions" | "conferences" | "districts" | "churches";
type AdminMenu = "hierarchy" | "users" | "requestTypes" | "roles";

const ADMIN_MENUS: Array<{
  key: AdminMenu;
  label: string;
  description: string;
}> = [
  {
    key: "hierarchy",
    label: "Hierarchy",
    description: "Unions, conferences, districts, churches"
  },
  {
    key: "users",
    label: "Users",
    description: "Accounts, scopes, WhatsApp access"
  },
  {
    key: "requestTypes",
    label: "Request Types",
    description: "Service request categories"
  },
  {
    key: "roles",
    label: "Roles",
    description: "Approval and access roles"
  }
];

function formPayload(form: HTMLFormElement) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  if (form.elements.namedItem("whatsappEnabled")) {
    payload.whatsappEnabled = formData.get("whatsappEnabled") === "true" ? "true" : "false";
  }
  return payload;
}

export function AdminPanel({
  unions,
  conferences,
  districts,
  churches,
  requestTypes,
  users,
  roles
}: AdminPanelProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<AdminMenu>("hierarchy");
  const [hierarchyTab, setHierarchyTab] = useState<HierarchyTab>("unions");
  const menuCounts: Record<AdminMenu, number> = {
    hierarchy: unions.length + conferences.length + districts.length + churches.length,
    users: users.length,
    requestTypes: requestTypes.length,
    roles: roles.length
  };

  async function api(resource: string, method: "POST" | "PATCH", payload: Record<string, unknown>) {
    setPending(`${method}-${resource}`);
    setError("");
    const response = await fetch(`/api/admin/${resource}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setPending(null);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Admin action failed.");
      return false;
    }

    router.refresh();
    return true;
  }

  async function create(resource: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await api(resource, "POST", formPayload(form));
    if (ok) form.reset();
  }

  async function toggle(resource: string, id: string, active: boolean) {
    if (!window.confirm(active ? "Deactivate this item?" : "Reactivate this item?")) return;
    await api(resource, "PATCH", { id, active: !active });
  }

  async function editEntity(resource: string, entity: BaseEntity) {
    const name = window.prompt("Name", entity.name);
    if (!name) return;
    const payload: Record<string, unknown> = { id: entity.id, name };
    if (entity.code) {
      const code = window.prompt("Code", entity.code);
      if (!code) return;
      payload.code = code;
    }
    await api(resource, "PATCH", payload);
  }

  async function editUser(user: UserEntity) {
    const name = window.prompt("Name", user.name);
    if (!name) return;
    const email = window.prompt("Email", user.email);
    if (!email) return;
    const phonePrimary = window.prompt("Primary phone", user.phonePrimary ?? "") ?? user.phonePrimary;
    const whatsappNumber = window.prompt(
      "Approved WhatsApp number",
      user.whatsappNumber ?? user.phonePrimary ?? ""
    ) ?? user.whatsappNumber;
    const roleName = window.prompt("Role name", user.role.name);
    if (!roleName || !(ROLE_NAMES as readonly string[]).includes(roleName)) {
      setError("Role name must match one of the configured roles.");
      return;
    }
    const languageCodes = SUPPORTED_LANGUAGES.map((language) => language.code).join(", ");
    const preferredLanguage = window.prompt(
      `Preferred language code: ${languageCodes}`,
      user.preferredLanguage
    ) ?? user.preferredLanguage;
    await api("users", "PATCH", { id: user.id, name, email, roleName, phonePrimary, whatsappNumber, preferredLanguage });
  }

  async function toggleWhatsApp(user: UserEntity) {
    let whatsappNumber = user.whatsappNumber ?? user.phonePrimary ?? user.phoneSecondary ?? "";
    if (!user.whatsappEnabled && !whatsappNumber) {
      whatsappNumber = window.prompt("Enter approved WhatsApp number in +263 format", "") ?? "";
    }
    if (!user.whatsappEnabled && !whatsappNumber) {
      setError("A WhatsApp number is required before messaging can be enabled.");
      return;
    }
    await api("users", "PATCH", {
      id: user.id,
      whatsappEnabled: !user.whatsappEnabled,
      whatsappNumber
    });
  }

  return (
    <div className="admin-grid">
      <nav className="admin-menu" aria-label="Admin management sections">
        {ADMIN_MENUS.map((item) => (
          <button
            aria-current={activeMenu === item.key ? "page" : undefined}
            className={`admin-menu-button ${activeMenu === item.key ? "active" : ""}`}
            key={item.key}
            onClick={() => setActiveMenu(item.key)}
            type="button"
          >
            <AdminMenuIcon menu={item.key} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
            <em>{menuCounts[item.key]}</em>
          </button>
        ))}
      </nav>

      {error ? <div className="error-message">{error}</div> : null}

      {activeMenu === "hierarchy" ? (
      <section className="entity-section">
        <div className="entity-header tabbed-entity-header">
          <div>
            <h2>Church Hierarchy</h2>
            <p>Manage unions, conferences, districts, and local churches.</p>
          </div>
          <div className="tab-list" role="tablist" aria-label="Hierarchy management">
            {[
              ["unions", "Unions"],
              ["conferences", "Conferences"],
              ["districts", "Districts"],
              ["churches", "Churches"]
            ].map(([key, label]) => (
              <button
                aria-selected={hierarchyTab === key}
                className={`tab-button ${hierarchyTab === key ? "active" : ""}`}
                key={key}
                onClick={() => setHierarchyTab(key as HierarchyTab)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="entity-body">
          {hierarchyTab === "unions" ? (
            <>
              <form className="inline-form compact" onSubmit={(event) => create("unions", event)}>
                <div className="field">
                  <label htmlFor="union-name">Name</label>
                  <input id="union-name" name="name" required />
                </div>
                <div className="field">
                  <label htmlFor="union-code">Code</label>
                  <input id="union-code" name="code" required />
                </div>
                <button className="button" disabled={pending !== null} type="submit">
                  <Plus size={16} aria-hidden="true" />
                  Add union
                </button>
              </form>
              <EntityTable entities={unions} resource="unions" onEdit={editEntity} onToggle={toggle} />
            </>
          ) : null}

          {hierarchyTab === "conferences" ? (
            <>
              <form className="inline-form" onSubmit={(event) => create("conferences", event)}>
                <div className="field">
                  <label htmlFor="conference-name">Name</label>
                  <input id="conference-name" name="name" required />
                </div>
                <div className="field">
                  <label htmlFor="conference-code">Code</label>
                  <input id="conference-code" name="code" required />
                </div>
                <div className="field">
                  <label htmlFor="conference-union">Union</label>
                  <select id="conference-union" name="unionId" required>
                    {unions.map((union) => (
                      <option key={union.id} value={union.id}>
                        {union.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="button" disabled={pending !== null} type="submit">
                  <Plus size={16} aria-hidden="true" />
                  Add conference
                </button>
              </form>
              <EntityTable
                entities={conferences.map((conference) => ({
                  ...conference,
                  parent: conference.union.name
                }))}
                resource="conferences"
                onEdit={editEntity}
                onToggle={toggle}
              />
            </>
          ) : null}

          {hierarchyTab === "districts" ? (
            <>
              <form className="inline-form" onSubmit={(event) => create("districts", event)}>
                <div className="field">
                  <label htmlFor="district-name">Name</label>
                  <input id="district-name" name="name" required />
                </div>
                <div className="field">
                  <label htmlFor="district-code">Code</label>
                  <input id="district-code" name="code" required />
                </div>
                <div className="field">
                  <label htmlFor="district-conference">Conference</label>
                  <select id="district-conference" name="conferenceId" required>
                    {conferences.map((conference) => (
                      <option key={conference.id} value={conference.id}>
                        {conference.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="button" disabled={pending !== null} type="submit">
                  <Plus size={16} aria-hidden="true" />
                  Add district
                </button>
              </form>
              <EntityTable
                entities={districts.map((district) => ({
                  ...district,
                  parent: district.conference.name
                }))}
                resource="districts"
                onEdit={editEntity}
                onToggle={toggle}
              />
            </>
          ) : null}

          {hierarchyTab === "churches" ? (
            <>
              <form className="inline-form" onSubmit={(event) => create("churches", event)}>
                <div className="field">
                  <label htmlFor="church-name">Name</label>
                  <input id="church-name" name="name" required />
                </div>
                <div className="field">
                  <label htmlFor="church-code">Code</label>
                  <input id="church-code" name="code" required />
                </div>
                <div className="field">
                  <label htmlFor="church-district">District</label>
                  <select id="church-district" name="districtId" required>
                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="button" disabled={pending !== null} type="submit">
                  <Plus size={16} aria-hidden="true" />
                  Add church
                </button>
              </form>
              <EntityTable
                entities={churches.map((church) => ({
                  ...church,
                  parent: church.district.name
                }))}
                resource="churches"
                onEdit={editEntity}
                onToggle={toggle}
              />
            </>
          ) : null}
        </div>
      </section>
      ) : null}

      {activeMenu === "users" ? (
      <section className="entity-section">
        <div className="entity-header">
          <div>
            <h2>Users</h2>
            <p>Manage user accounts, hierarchy assignments, and messaging access.</p>
          </div>
        </div>
        <div className="entity-body">
          <form className="inline-form" onSubmit={(event) => create("users", event)}>
            <div className="field">
              <label htmlFor="user-name">Name</label>
              <input id="user-name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="user-email">Email</label>
              <input id="user-email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="user-password">Password</label>
              <input id="user-password" name="password" type="password" minLength={8} required />
            </div>
            <div className="field">
              <label htmlFor="user-phone-primary">Primary phone</label>
              <input id="user-phone-primary" name="phonePrimary" placeholder="+263..." />
            </div>
            <div className="field">
              <label htmlFor="user-whatsapp">WhatsApp number</label>
              <input id="user-whatsapp" name="whatsappNumber" placeholder="+263..." />
            </div>
            <label className="check-field">
              <input name="whatsappEnabled" type="checkbox" value="true" />
              Enable WhatsApp messaging
            </label>
            <div className="field">
              <label htmlFor="user-role">Role</label>
              <select id="user-role" name="roleName" required>
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="user-language">Preferred language</label>
              <select id="user-language" name="preferredLanguage" defaultValue="en">
                {SUPPORTED_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.localLabel}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="user-union">Union</label>
              <select id="user-union" name="unionId" defaultValue="">
                <option value="">None</option>
                {unions.map((union) => (
                  <option key={union.id} value={union.id}>
                    {union.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="user-conference">Conference</label>
              <select id="user-conference" name="conferenceId" defaultValue="">
                <option value="">None</option>
                {conferences.map((conference) => (
                  <option key={conference.id} value={conference.id}>
                    {conference.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="user-district">District</label>
              <select id="user-district" name="districtId" defaultValue="">
                <option value="">None</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="user-church">Church</label>
              <select id="user-church" name="churchId" defaultValue="">
                <option value="">None</option>
                {churches.map((church) => (
                  <option key={church.id} value={church.id}>
                    {church.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="button" disabled={pending !== null} type="submit">
              <Plus size={16} aria-hidden="true" />
              Add user
            </button>
          </form>
          <UsersTable users={users} onEdit={editUser} onToggle={toggle} onToggleWhatsApp={toggleWhatsApp} />
        </div>
      </section>
      ) : null}

      {activeMenu === "requestTypes" ? (
      <section className="entity-section">
        <div className="entity-header">
          <div>
            <h2>Service Request Types</h2>
            <p>Manage the categories clerks can select when creating requests.</p>
          </div>
        </div>
        <div className="entity-body">
          <form className="inline-form compact" onSubmit={(event) => create("requestTypes", event)}>
            <div className="field">
              <label htmlFor="type-name">Name</label>
              <input id="type-name" name="name" required />
            </div>
            <button className="button" disabled={pending !== null} type="submit">
              <Plus size={16} aria-hidden="true" />
              Add
            </button>
          </form>
          <EntityTable entities={requestTypes} resource="requestTypes" onEdit={editEntity} onToggle={toggle} />
        </div>
      </section>
      ) : null}

      {activeMenu === "roles" ? (
      <section className="entity-section">
        <div className="entity-header">
          <div>
            <h2>Roles</h2>
            <p>Review the configured access and approval roles.</p>
          </div>
        </div>
        <div className="entity-body">
          <RolesTable roles={roles} />
        </div>
      </section>
      ) : null}
    </div>
  );
}

function AdminMenuIcon({ menu }: { menu: AdminMenu }) {
  if (menu === "hierarchy") return <Building2 size={18} aria-hidden="true" />;
  if (menu === "users") return <UsersRound size={18} aria-hidden="true" />;
  if (menu === "requestTypes") return <ClipboardList size={18} aria-hidden="true" />;
  return <ShieldCheck size={18} aria-hidden="true" />;
}

function EntityTable({
  entities,
  resource,
  onEdit,
  onToggle
}: {
  entities: (BaseEntity & { parent?: string })[];
  resource: string;
  onEdit: (resource: string, entity: BaseEntity) => void;
  onToggle: (resource: string, id: string, active: boolean) => void;
}) {
  type EntityRow = BaseEntity & { parent?: string };
  const columns: DataTableColumn<EntityRow>[] = [
    { key: "name", header: "Name", cell: (entity) => entity.name, sortValue: (entity) => entity.name },
    { key: "code", header: "Code", cell: (entity) => entity.code ?? "N/A", sortValue: (entity) => entity.code ?? "" },
    {
      key: "parent",
      header: "Parent",
      cell: (entity) => entity.parent ?? "N/A",
      sortValue: (entity) => entity.parent ?? ""
    },
    {
      key: "status",
      header: "Status",
      cell: (entity) => (entity.active === false ? "Inactive" : "Active"),
      sortValue: (entity) => (entity.active === false ? "Inactive" : "Active")
    },
    {
      key: "actions",
      header: "Actions",
      cell: (entity) => (
        <div className="button-row">
          <button className="button secondary" onClick={() => onEdit(resource, entity)} type="button">
            <Save size={15} aria-hidden="true" />
            Edit
          </button>
          <button
            className="button ghost"
            onClick={() => onToggle(resource, entity.id, entity.active !== false)}
            type="button"
          >
            {entity.active !== false ? <Power size={15} /> : <RotateCcw size={15} />}
            {entity.active !== false ? "Deactivate" : "Activate"}
          </button>
        </div>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      emptyMessage="No hierarchy records found."
      getSearchText={(entity) => `${entity.name} ${entity.code ?? ""} ${entity.parent ?? ""}`}
      initialSortKey="name"
      itemName={resource}
      rows={entities}
    />
  );
}

function scopeForUser(user: UserEntity) {
  return [user.union?.name, user.conference?.name, user.district?.name, user.church?.name]
    .filter(Boolean)
    .join(" / ") || "Global";
}

function UsersTable({
  users,
  onEdit,
  onToggle,
  onToggleWhatsApp
}: {
  users: UserEntity[];
  onEdit: (user: UserEntity) => void;
  onToggle: (resource: string, id: string, active: boolean) => void;
  onToggleWhatsApp: (user: UserEntity) => void;
}) {
  const columns: DataTableColumn<UserEntity>[] = [
    {
      key: "user",
      header: "User",
      sortValue: (item) => item.name,
      cell: (item) => (
        <div className="row-title">
          <strong>{item.name}</strong>
          <span className="muted">{item.email}</span>
        </div>
      )
    },
    { key: "role", header: "Role", cell: (item) => item.role.name, sortValue: (item) => item.role.name },
    {
      key: "language",
      header: "Language",
      cell: (item) => languageLabel(item.preferredLanguage),
      sortValue: (item) => languageLabel(item.preferredLanguage)
    },
    { key: "scope", header: "Scope", cell: scopeForUser, sortValue: scopeForUser },
    {
      key: "whatsapp",
      header: "WhatsApp",
      sortValue: (item) => (item.whatsappEnabled ? "Enabled" : "Disabled"),
      cell: (item) => (
        <div className="row-title">
          <strong>{item.whatsappEnabled ? "Enabled" : "Disabled"}</strong>
          <span className="muted">{item.whatsappNumber ?? item.phonePrimary ?? "No number"}</span>
        </div>
      )
    },
    {
      key: "status",
      header: "Status",
      cell: (item) => (item.active ? "Active" : "Inactive"),
      sortValue: (item) => (item.active ? "Active" : "Inactive")
    },
    {
      key: "actions",
      header: "Actions",
      cell: (item) => (
        <div className="button-row">
          <button className="button secondary" onClick={() => onEdit(item)} type="button">
            <Save size={15} aria-hidden="true" />
            Edit
          </button>
          <button className="button ghost" onClick={() => onToggle("users", item.id, item.active)} type="button">
            {item.active ? <Power size={15} /> : <RotateCcw size={15} />}
            {item.active ? "Deactivate" : "Activate"}
          </button>
          <button className="button ghost" onClick={() => onToggleWhatsApp(item)} type="button">
            <MessageCircle size={15} aria-hidden="true" />
            {item.whatsappEnabled ? "Disable WhatsApp" : "Enable WhatsApp"}
          </button>
        </div>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      emptyMessage="No users found."
      getSearchText={(item) =>
        `${item.name} ${item.email} ${item.role.name} ${languageLabel(item.preferredLanguage)} ${scopeForUser(item)} ${item.whatsappNumber ?? ""} ${
          item.phonePrimary ?? ""
        }`
      }
      initialSortKey="user"
      itemName="users"
      rows={users}
    />
  );
}

function RolesTable({ roles }: { roles: { id: string; name: string; description: string | null }[] }) {
  return (
    <DataTable
      columns={[
        { key: "role", header: "Role", cell: (role) => role.name, sortValue: (role) => role.name },
        {
          key: "description",
          header: "Description",
          cell: (role) => role.description ?? "N/A",
          sortValue: (role) => role.description ?? ""
        }
      ]}
      emptyMessage="No roles found."
      getSearchText={(role) => `${role.name} ${role.description ?? ""}`}
      initialSortKey="role"
      itemName="roles"
      rows={roles}
    />
  );
}
