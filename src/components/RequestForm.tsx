"use client";

import { ArrowLeft, ArrowRight, FileUp, Save, Search, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { LanguagePreferenceSelect } from "./LanguagePreferenceSelect";
import { normalizeLanguage, type LanguageCode } from "@/lib/languages";
import { requestFormT } from "@/lib/request-form-i18n";
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

const PRESENTATION_METHODS = [
  { value: "In person", labelKey: "method.inPerson" },
  { value: "Online", labelKey: "method.online" },
  { value: "Hybrid", labelKey: "method.hybrid" },
  { value: "Recorded", labelKey: "method.recorded" },
  { value: "Other", labelKey: "method.other" }
] as const;

const REQUEST_FORM_STEPS = [
  { id: "request-section-details", labelKey: "step.details", titleKey: "section.details" },
  { id: "request-section-target", labelKey: "step.target", titleKey: "section.target" },
  { id: "request-section-schedule", labelKey: "step.schedule", titleKey: "section.schedule" },
  { id: "request-section-signatories", labelKey: "step.signatories", titleKey: "section.signatories" },
  { id: "request-section-submit", labelKey: "step.submit", titleKey: "section.submit" }
] as const;

type RequestFormStepId = (typeof REQUEST_FORM_STEPS)[number]["id"];

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
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [highestStepIndex, setHighestStepIndex] = useState(0);
  const [language, setLanguage] = useState<LanguageCode>(normalizeLanguage(user.preferredLanguage));
  const activeStep = REQUEST_FORM_STEPS[activeStepIndex];
  const t = (key: string, options?: Record<string, unknown>) => requestFormT(language, key, options);

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
  const isSuperAdmin = user.roleName === "Super Admin";
  const [requestChurchId, setRequestChurchId] = useState(defaultRequestChurch?.id ?? "");
  const [requestChurchSearch, setRequestChurchSearch] = useState(
    defaultRequestChurch ? churchLabels.get(defaultRequestChurch.id) ?? defaultRequestChurch.name : ""
  );

  const [targetChurchId, setTargetChurchId] = useState("");
  const [targetChurchSearch, setTargetChurchSearch] = useState("");

  const requestHierarchy = hierarchyForChurch(
    requestingChurches.find((church) => church.id === requestChurchId) ?? null
  );
  const targetHierarchy = hierarchyForChurch(churches.find((church) => church.id === targetChurchId) ?? null);

  function selectChurchFromSearch(value: string, source: ChurchOption[], labels: Map<string, string>) {
    const normalized = value.trim().toLowerCase();
    return (
      source.find((church) => labels.get(church.id)?.toLowerCase() === normalized) ??
      source.find((church) => church.name.toLowerCase() === normalized) ??
      null
    );
  }

  function showStep(index: number) {
    setActiveStepIndex(index);
    window.requestAnimationFrame(() => {
      document.getElementById(REQUEST_FORM_STEPS[index].id)?.focus({ preventScroll: true });
    });
  }

  function validateStep(index: number, showError = true) {
    const step = REQUEST_FORM_STEPS[index];

    if (step.id === "request-section-details" && !requestChurchId) {
      if (showError) {
        setError(t("form.requestChurchError"));
        (document.getElementById("requestChurchSearch") ?? document.getElementById("typeId"))?.focus({
          preventScroll: true
        });
      }
      return false;
    }

    const section = document.getElementById(step.id);
    if (!section) return true;
    const fields = Array.from(
      section.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")
    ).filter((field) => field.type !== "hidden" && !field.disabled);
    const invalidField = fields.find((field) => !field.checkValidity());

    if (!invalidField) return true;
    if (showError) {
      setError(t("form.validation"));
      invalidField.focus({ preventScroll: true });
      invalidField.reportValidity();
    }
    return false;
  }

  function validateAllSteps() {
    for (let index = 0; index < REQUEST_FORM_STEPS.length; index += 1) {
      if (!validateStep(index, false)) {
        showStep(index);
        window.requestAnimationFrame(() => validateStep(index));
        return false;
      }
    }
    return true;
  }

  function goToStep(index: number) {
    if (index > highestStepIndex) return;
    setError("");
    showStep(index);
  }

  function goNext() {
    if (!validateStep(activeStepIndex)) return;
    setError("");
    const nextIndex = Math.min(activeStepIndex + 1, REQUEST_FORM_STEPS.length - 1);
    setHighestStepIndex((current) => Math.max(current, nextIndex));
    showStep(nextIndex);
  }

  function goBack() {
    setError("");
    showStep(Math.max(activeStepIndex - 1, 0));
  }

  async function submitForm(saveAsDraft: boolean) {
    setError("");
    const form = formRef.current;
    if (!form) return;

    if (!validateAllSteps()) return;

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
      setError(data?.error ?? t("form.submitError"));
      return;
    }

    const data = (await response.json()) as { id: string };
    router.push(`/requests/${data.id}`);
    router.refresh();
  }

  function SectionHeader({ stepIndex }: { stepIndex: number }) {
    const step = REQUEST_FORM_STEPS[stepIndex];
    return (
      <div className="request-section-header">
        <span>{t("form.step", { number: stepIndex + 1 })}</span>
        <h3 id={`${step.id}-title`}>{t(step.titleKey)}</h3>
      </div>
    );
  }

  function sectionProps(stepId: RequestFormStepId, stepIndex: number) {
    const isActive = activeStep.id === stepId;
    return {
      className: `request-form-section ${isActive ? "active" : ""}`,
      id: stepId,
      "aria-labelledby": `${stepId}-title`,
      hidden: !isActive,
      tabIndex: -1
    };
  }

  return (
    <form
      className="panel request-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submitForm(false);
      }}
      ref={formRef}
    >
      <div className="panel-header request-form-header">
        <div>
          <h2>{t("form.heading")}</h2>
          <p>{t("form.description")}</p>
        </div>
        <LanguagePreferenceSelect
          value={language}
          label={t("form.language")}
          onLanguageChange={(nextLanguage) => setLanguage(nextLanguage)}
        />
      </div>

      <div className="request-stepper" aria-label="Request form steps">
        {REQUEST_FORM_STEPS.map((step, index) => {
          const active = activeStepIndex === index;
          const completed = index < highestStepIndex;
          const locked = index > highestStepIndex;
          return (
            <button
              aria-current={active ? "step" : undefined}
              className={`request-stepper-button ${active ? "active" : ""} ${completed ? "completed" : ""}`}
              disabled={locked || pending}
              key={step.id}
              onClick={() => goToStep(index)}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{t(step.labelKey)}</strong>
            </button>
          );
        })}
      </div>

      <div className="panel-body request-form-body">
        <section {...sectionProps("request-section-details", 0)}>
          <input type="hidden" name="requestingChurchId" value={requestChurchId} />
          <SectionHeader stepIndex={0} />
          <div className="request-section-grid">
            <div className="field">
              <label htmlFor="typeId">{t("label.type")}</label>
              <select id="typeId" name="typeId" required>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="serviceRequired">{t("label.serviceRequired")}</label>
              <input
                id="serviceRequired"
                name="serviceRequired"
                maxLength={120}
                placeholder={t("placeholder.serviceRequired")}
              />
            </div>
            <div className="field">
              <label htmlFor="presentationMethod">{t("label.presentationMethod")}</label>
              <select id="presentationMethod" name="presentationMethod" defaultValue="In person">
                {PRESENTATION_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {t(method.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="title">{t("label.title")}</label>
              <input id="title" name="title" minLength={4} maxLength={160} required />
            </div>
            <div className="field full">
              <label htmlFor="description">{t("label.description")}</label>
              <textarea id="description" name="description" minLength={10} maxLength={5000} required />
            </div>
            <div className="field">
              <label htmlFor="nameSuggested">{t("label.nameSuggested")}</label>
              <input id="nameSuggested" name="nameSuggested" maxLength={160} placeholder={t("placeholder.nameSuggested")} />
            </div>
            <div className="field">
              <label htmlFor="contactEmail">{t("label.contactEmail")}</label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                maxLength={160}
                placeholder={t("placeholder.email")}
              />
            </div>
          </div>
          <div className="request-subsection-header">
            <h4>{t("section.requesting")}</h4>
          </div>
          <div className="request-section-grid">
            {isSuperAdmin ? (
              <div className="field full lookup-field">
                <label htmlFor="requestChurchSearch">{t("label.requestChurchSearch")}</label>
                <div className="lookup-input">
                  <Search size={16} aria-hidden="true" />
                  <input
                    id="requestChurchSearch"
                    list="requestChurchOptions"
                    value={requestChurchSearch}
                    onChange={(event) => {
                      const value = event.target.value;
                      setRequestChurchSearch(value);
                      const church = selectChurchFromSearch(value, requestingChurches, churchLabels);
                      setRequestChurchId(church?.id ?? "");
                    }}
                    required
                  />
                </div>
                <datalist id="requestChurchOptions">
                  {requestingChurches.map((church) => (
                    <option key={church.id} value={churchLabels.get(church.id) ?? church.name} />
                  ))}
                </datalist>
              </div>
            ) : (
              <ReadOnlyField
                label={t("label.church")}
                value={
                  requestHierarchy.church
                    ? churchLabel(requestHierarchy.church, requestHierarchy)
                    : t("empty.noAssignedChurch")
                }
              />
            )}
            <HierarchyPreview
              hierarchy={requestHierarchy}
              emptyLabel={t("empty.noRequestingChurch")}
              labels={{
                union: t("label.union"),
                conference: t("label.conference"),
                district: t("label.district")
              }}
            />
          </div>
        </section>

        <section {...sectionProps("request-section-target", 1)}>
          <input type="hidden" name="targetChurchId" value={targetChurchId} />
          <input type="hidden" name="targetDistrictId" value={targetHierarchy.district?.id ?? ""} />
          <input type="hidden" name="targetConferenceId" value={targetHierarchy.conference?.id ?? ""} />
          <input type="hidden" name="targetUnionId" value={targetHierarchy.union?.id ?? ""} />
          <SectionHeader stepIndex={1} />
          <div className="request-section-grid">
            <div className="field full lookup-field">
              <label htmlFor="targetChurchSearch">{t("label.targetChurchSearch")}</label>
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
                  placeholder={t("placeholder.targetChurch")}
                />
              </div>
              <datalist id="targetChurchOptions">
                {churches.map((church) => (
                  <option key={church.id} value={churchLabels.get(church.id) ?? church.name} />
                ))}
              </datalist>
            </div>
            <HierarchyPreview
              hierarchy={targetHierarchy}
              emptyLabel={t("empty.noTargetChurch")}
              labels={{
                union: t("label.union"),
                conference: t("label.conference"),
                district: t("label.district")
              }}
            />
          </div>
        </section>

        <section {...sectionProps("request-section-schedule", 2)}>
          <SectionHeader stepIndex={2} />
          <div className="request-section-grid">
            <div className="field">
              <label htmlFor="proposedDate">{t("label.proposedDate")}</label>
              <input id="proposedDate" name="proposedDate" type="date" />
            </div>
            <div className="field">
              <label htmlFor="requiredToDate">{t("label.requiredToDate")}</label>
              <input id="requiredToDate" name="requiredToDate" type="date" />
            </div>
            <div className="field">
              <label htmlFor="contactPerson">{t("label.contactPerson")}</label>
              <input id="contactPerson" name="contactPerson" minLength={2} maxLength={120} required />
            </div>
            <div className="field">
              <label htmlFor="boardActionNumber">{t("label.boardActionNumber")}</label>
              <input id="boardActionNumber" name="boardActionNumber" maxLength={80} />
            </div>
            <div className="field full">
              <label htmlFor="expensesIncurredBy">{t("label.expensesIncurredBy")}</label>
              <input
                id="expensesIncurredBy"
                name="expensesIncurredBy"
                maxLength={160}
                placeholder={t("placeholder.expenses")}
              />
            </div>
          </div>
        </section>

        <section {...sectionProps("request-section-signatories", 3)}>
          <SectionHeader stepIndex={3} />
          <div className="request-section-grid">
            <ReadOnlyField label={t("label.clericalOffice")} value={signatories.clericalOffice} />
            <ReadOnlyField label={t("label.districtPastor")} value={signatories.districtPastor} />
            <div className="field">
              <label htmlFor="firstElderName">{t("label.firstElderName")}</label>
              <input id="firstElderName" name="firstElderName" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="firstElderPhone">{t("label.firstElderPhone")}</label>
              <input id="firstElderPhone" name="firstElderPhone" maxLength={60} />
            </div>
            <div className="field full">
              <label htmlFor="attachments">{t("label.attachments")}</label>
              <input
                id="attachments"
                name="attachments"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              />
            </div>
          </div>
        </section>

        <section {...sectionProps("request-section-submit", 4)}>
          <SectionHeader stepIndex={4} />
          <div className="request-section-grid">
            <div className="field full">
              <label htmlFor="additionalNotes">{t("label.additionalNotes")}</label>
              <textarea id="additionalNotes" name="additionalNotes" maxLength={3000} />
            </div>
          </div>
        </section>

        {error ? <div className="error-message request-form-error" aria-live="polite">{error}</div> : null}
        <div className="request-step-actions">
          <button
            className="button secondary"
            disabled={pending || activeStepIndex === 0}
            onClick={goBack}
            type="button"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t("button.back")}
          </button>
          {activeStepIndex < REQUEST_FORM_STEPS.length - 1 ? (
            <button className="button" disabled={pending} onClick={goNext} type="button">
              {t("button.next")}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <>
              <button className="button" disabled={pending} type="submit">
                <Send size={16} aria-hidden="true" />
                {t("button.submit")}
              </button>
              <button
                className="button secondary"
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  void submitForm(true);
                }}
                type="button"
              >
                <Save size={16} aria-hidden="true" />
                {t("button.draft")}
              </button>
            </>
          )}
          <span className="muted request-file-help">
            <FileUp size={14} aria-hidden="true" /> {t("button.fileHelp")}
          </span>
        </div>
      </div>
    </form>
  );
}

function HierarchyPreview({
  hierarchy,
  emptyLabel = "Select a church",
  labels
}: {
  hierarchy: ChurchHierarchy;
  emptyLabel?: string;
  labels: {
    union: string;
    conference: string;
    district: string;
  };
}) {
  return (
    <div className="hierarchy-preview full">
      <ReadOnlyField label={labels.union} value={hierarchy.union?.name ?? emptyLabel} />
      <ReadOnlyField label={labels.conference} value={hierarchy.conference?.name ?? emptyLabel} />
      <ReadOnlyField label={labels.district} value={hierarchy.district?.name ?? emptyLabel} />
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
