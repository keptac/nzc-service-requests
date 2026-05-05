"use client";

import { FileUp, Save, Search, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/constants";
import type { AuthUser } from "@/lib/types";

type Option = {
  id: string;
  name: string;
};

type ConferenceOption = Option & {
  unionId: string;
};

type DistrictOption = Option & {
  conferenceId: string;
};

type ChurchOption = Option & {
  districtId: string;
  code?: string;
};

type ChurchHierarchy = {
  church: ChurchOption | null;
  district: DistrictOption | null;
  conference: ConferenceOption | null;
  union: Option | null;
};

type RequestFormProps = {
  user: AuthUser;
  types: Option[];
  requestingChurches: ChurchOption[];
  churches: ChurchOption[];
  districts: DistrictOption[];
  conferences: ConferenceOption[];
  unions: Option[];
  signatories: {
    clericalOffice: string;
    districtPastor: string;
  };
};

const PRESENTATION_METHODS = ["In person", "Online", "Hybrid", "Recorded", "Other"];

function churchLabel(church: ChurchOption, hierarchy: ChurchHierarchy) {
  const parts = [
    church.name,
    church.code ? `(${church.code})` : "",
    hierarchy.district ? `- ${hierarchy.district.name}` : "",
    hierarchy.conference ? `, ${hierarchy.conference.name}` : ""
  ].filter(Boolean);

  return parts.join(" ");
}

export function RequestForm({
  user,
  types,
  requestingChurches,
  churches,
  districts,
  conferences,
  unions,
  signatories
}: RequestFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const districtById = useMemo(
    () => new Map(districts.map((district) => [district.id, district])),
    [districts]
  );
  const conferenceById = useMemo(
    () => new Map(conferences.map((conference) => [conference.id, conference])),
    [conferences]
  );
  const unionById = useMemo(() => new Map(unions.map((union) => [union.id, union])), [unions]);

  function hierarchyForChurch(church: ChurchOption | null): ChurchHierarchy {
    const district = church ? districtById.get(church.districtId) ?? null : null;
    const conference = district ? conferenceById.get(district.conferenceId) ?? null : null;
    const union = conference ? unionById.get(conference.unionId) ?? null : null;

    return { church, district, conference, union };
  }

  const churchLabels = useMemo(() => {
    return new Map(
      churches.map((church) => {
        const hierarchy = hierarchyForChurch(church);
        return [church.id, churchLabel(church, hierarchy)];
      })
    );
  }, [churches, districtById, conferenceById, unionById]);

  const defaultRequestChurch =
    requestingChurches.find((church) => church.id === user.churchId) ?? requestingChurches[0] ?? null;
  const requestChurchId = defaultRequestChurch?.id ?? "";

  const [targetChurchId, setTargetChurchId] = useState("");
  const [targetChurchSearch, setTargetChurchSearch] = useState("");

  const targetHierarchy = hierarchyForChurch(churches.find((church) => church.id === targetChurchId) ?? null);

  function selectChurchFromSearch(value: string, source: ChurchOption[], labels: Map<string, string>) {
    const normalized = value.trim().toLowerCase();
    return (
      source.find((church) => labels.get(church.id)?.toLowerCase() === normalized) ??
      source.find((church) => church.name.toLowerCase() === normalized) ??
      null
    );
  }

  async function submitForm(saveAsDraft: boolean) {
    setError("");
    const form = formRef.current;
    if (!form) return;

    if (!requestChurchId) {
      setError("Your user account is not assigned to a church.");
      return;
    }

    setPending(true);
    const formData = new FormData(form);
    formData.set("saveAsDraft", String(saveAsDraft));

    const response = await fetch("/api/requests", {
      method: "POST",
      body: formData
    });
    setPending(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not create request.");
      return;
    }

    const data = (await response.json()) as { id: string };
    router.push(`/requests/${data.id}`);
    router.refresh();
  }

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        void submitForm(false);
      }}
      ref={formRef}
    >
      <div className="panel-header">
        <div>
          <h2>Request Details</h2>
          <p>Complete the information needed for routing and approval.</p>
        </div>
      </div>
      <div className="panel-body form-grid">
        <div className="field">
          <label htmlFor="typeId">Request type</label>
          <select id="typeId" name="typeId" required>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="priority">Priority</label>
          <select id="priority" name="priority" defaultValue="NORMAL" required>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="serviceRequired">Service required</label>
          <input id="serviceRequired" name="serviceRequired" maxLength={120} placeholder="Preaching, training, music" />
        </div>
        <div className="field">
          <label htmlFor="presentationMethod">Presentation method</label>
          <select id="presentationMethod" name="presentationMethod" defaultValue="In person">
            {PRESENTATION_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label htmlFor="title">Request title</label>
          <input id="title" name="title" minLength={4} maxLength={160} required />
        </div>
        <div className="field full">
          <label htmlFor="description">Event description</label>
          <textarea id="description" name="description" minLength={10} maxLength={5000} required />
        </div>
        <div className="field">
          <label htmlFor="nameSuggested">Name suggested</label>
          <input id="nameSuggested" name="nameSuggested" maxLength={160} placeholder="Person being requested" />
        </div>
        <div className="field">
          <label htmlFor="contactEmail">Email</label>
          <input id="contactEmail" name="contactEmail" type="email" maxLength={160} placeholder="name@example.com" />
        </div>

        <input type="hidden" name="requestingChurchId" value={requestChurchId} />

        <div className="form-section full">
          <h3>Church Being Requested From</h3>
        </div>
        <input type="hidden" name="targetChurchId" value={targetChurchId} />
        <input type="hidden" name="targetDistrictId" value={targetHierarchy.district?.id ?? ""} />
        <input type="hidden" name="targetConferenceId" value={targetHierarchy.conference?.id ?? ""} />
        <input type="hidden" name="targetUnionId" value={targetHierarchy.union?.id ?? ""} />
        <div className="field full lookup-field">
          <label htmlFor="targetChurchSearch">Search target church</label>
          <div className="lookup-input">
            <Search size={16} aria-hidden="true" />
            <input
              id="targetChurchSearch"
              list="targetChurchOptions"
              value={targetChurchSearch}
              onChange={(event) => {
                const value = event.target.value;
                setTargetChurchSearch(value);
                const church = selectChurchFromSearch(value, churches, churchLabels);
                setTargetChurchId(church?.id ?? "");
              }}
              placeholder="Not applicable"
            />
          </div>
          <datalist id="targetChurchOptions">
            {churches.map((church) => (
              <option key={church.id} value={churchLabels.get(church.id) ?? church.name} />
            ))}
          </datalist>
        </div>
        <HierarchyPreview hierarchy={targetHierarchy} emptyLabel="No target church selected" />
        <div className="field">
          <label htmlFor="fromWhere">From where</label>
          <input id="fromWhere" name="fromWhere" maxLength={220} placeholder="Church or location the person comes from" />
        </div>
        <div className="field">
          <label htmlFor="whereRequired">Where required</label>
          <input id="whereRequired" name="whereRequired" maxLength={220} placeholder="Service venue if different from your church" />
        </div>

        <div className="field">
          <label htmlFor="proposedDate">Date required from</label>
          <input id="proposedDate" name="proposedDate" type="date" />
        </div>
        <div className="field">
          <label htmlFor="requiredToDate">Date required to</label>
          <input id="requiredToDate" name="requiredToDate" type="date" />
        </div>
        <div className="field">
          <label htmlFor="contactPerson">Contact person</label>
          <input id="contactPerson" name="contactPerson" minLength={2} maxLength={120} required />
        </div>
        <div className="field">
          <label htmlFor="boardActionNumber">Board action number</label>
          <input id="boardActionNumber" name="boardActionNumber" maxLength={80} />
        </div>
        <div className="field full">
          <label htmlFor="expensesIncurredBy">Expenses incurred by</label>
          <input id="expensesIncurredBy" name="expensesIncurredBy" maxLength={160} placeholder="Church or person responsible for expenses" />
        </div>
        <div className="form-section full">
          <h3>PDF Signatories</h3>
        </div>
        <ReadOnlyField label="Clerical office" value={signatories.clericalOffice} />
        <ReadOnlyField label="District pastor" value={signatories.districtPastor} />
        <div className="field">
          <label htmlFor="firstElderName">First elder name</label>
          <input id="firstElderName" name="firstElderName" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="firstElderPhone">First elder phone</label>
          <input id="firstElderPhone" name="firstElderPhone" maxLength={60} />
        </div>
        <div className="field full">
          <label htmlFor="attachments">Supporting documents</label>
          <input
            id="attachments"
            name="attachments"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          />
        </div>
        <div className="field full">
          <label htmlFor="additionalNotes">Additional notes</label>
          <textarea id="additionalNotes" name="additionalNotes" maxLength={3000} />
        </div>
        {error ? <div className="error-message full">{error}</div> : null}
        <div className="button-row full">
          <button className="button" disabled={pending} type="submit">
            <Send size={16} aria-hidden="true" />
            Submit request
          </button>
          <button
            className="button secondary"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              if (formRef.current?.reportValidity()) {
                void submitForm(true);
              }
            }}
            type="button"
          >
            <Save size={16} aria-hidden="true" />
            Save draft
          </button>
          <span className="muted">
            <FileUp size={14} aria-hidden="true" /> PDF, Word, JPG, PNG, or WebP up to 10 MB each.
          </span>
        </div>
      </div>
    </form>
  );
}

function HierarchyPreview({
  hierarchy,
  emptyLabel = "Select a church"
}: {
  hierarchy: ChurchHierarchy;
  emptyLabel?: string;
}) {
  return (
    <div className="hierarchy-preview full">
      <ReadOnlyField label="Union" value={hierarchy.union?.name ?? emptyLabel} />
      <ReadOnlyField label="Conference" value={hierarchy.conference?.name ?? emptyLabel} />
      <ReadOnlyField label="District" value={hierarchy.district?.name ?? emptyLabel} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} readOnly />
    </div>
  );
}
