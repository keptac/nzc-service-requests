export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", localLabel: "English" },
  { code: "sn", label: "Shona", localLabel: "ChiShona" },
  { code: "nd", label: "Ndebele", localLabel: "IsiNdebele" },
  { code: "sw", label: "Swahili", localLabel: "Kiswahili" },
  { code: "toi", label: "Tonga", localLabel: "Chitonga" },
  { code: "ve", label: "Venda", localLabel: "Tshivenda" },
  { code: "pt", label: "Portuguese", localLabel: "Português" },
  { code: "ny", label: "Chewa / Nyanja", localLabel: "Chichewa / Chinyanja" },
  { code: "ts", label: "Tsonga / Shangani", localLabel: "XiTsonga / Shangani" },
  { code: "st", label: "Sotho", localLabel: "Sesotho" },
  { code: "tn", label: "Tswana", localLabel: "Setswana" },
  { code: "xh", label: "Xhosa", localLabel: "IsiXhosa" },
  { code: "zu", label: "Zulu", localLabel: "IsiZulu" },
  { code: "af", label: "Afrikaans", localLabel: "Afrikaans" },
  { code: "fr", label: "French", localLabel: "Français" },
  { code: "kck", label: "Kalanga", localLabel: "Kalanga" },
  { code: "nmq", label: "Nambya", localLabel: "Nambya" },
  { code: "ndc", label: "Ndau", localLabel: "ChiNdau" }
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";
export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((language) => language.code) as [
  LanguageCode,
  ...LanguageCode[]
];

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some((language) => language.code === value);
}

export function normalizeLanguage(value: string | null | undefined): LanguageCode {
  return isLanguageCode(value) ? value : DEFAULT_LANGUAGE;
}

export function languageLabel(value: string | null | undefined) {
  const language = SUPPORTED_LANGUAGES.find((item) => item.code === value);
  return language ? language.localLabel : SUPPORTED_LANGUAGES[0].localLabel;
}
