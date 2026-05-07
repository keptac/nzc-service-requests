"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
  type LanguageCode
} from "@/lib/languages";

type LanguagePreferenceSelectProps = {
  value: LanguageCode | string | null | undefined;
  label?: string;
  compact?: boolean;
  onLanguageChange?: (language: LanguageCode) => void;
};

export function LanguagePreferenceSelect({
  value,
  label = "Preferred language",
  compact = false,
  onLanguageChange
}: LanguagePreferenceSelectProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageCode>(normalizeLanguage(value));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setLanguage(normalizeLanguage(value));
  }, [value]);

  async function updateLanguage(nextLanguage: LanguageCode) {
    const previousLanguage = language;
    setLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage);
    setPending(true);

    const response = await fetch("/api/preferences/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLanguage: nextLanguage })
    });

    setPending(false);
    if (!response.ok) {
      setLanguage(previousLanguage);
      onLanguageChange?.(previousLanguage);
      return;
    }

    router.refresh();
  }

  return (
    <label className={`language-select ${compact ? "compact" : ""}`}>
      <span>
        <Languages size={15} aria-hidden="true" />
        {label}
      </span>
      <select
        aria-label={label}
        disabled={pending}
        value={language}
        onChange={(event) => {
          void updateLanguage(normalizeLanguage(event.target.value));
        }}
      >
        {SUPPORTED_LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.localLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
