type PilotBrand = "BMW" | "SHACMAN" | "KAMAZ";

interface BrandAliasRule {
  id: string;
  brand: PilotBrand;
  pattern: RegExp;
}

interface ModelFamilyRule {
  id: string;
  brand: PilotBrand;
  family: string;
  pattern: RegExp;
}

export interface CatalogModelNormalizationInput {
  brand: string | null;
  model: string | null;
  modification: string | null;
}

export interface CatalogModelNormalizationResult {
  applied: boolean;
  brandCanonical: PilotBrand | null;
  modelFamilyCanonical: string | null;
  modificationNormalized: string | null;
  confidence: number;
  minConfidenceToApply: number;
  method: "disabled" | "no_match" | "rule";
  matchedBrandRuleId: string | null;
  matchedModelRuleId: string | null;
}

const TRANSLIT_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
  ь: "",
  ъ: "",
};

const BRAND_ALIAS_RULES: BrandAliasRule[] = [
  { id: "brand-bmw-latin", brand: "BMW", pattern: /\bbmw\b/i },
  { id: "brand-bmw-cyr-translit", brand: "BMW", pattern: /\bbmv\b/i },
  { id: "brand-shacman-latin", brand: "SHACMAN", pattern: /\bshacman\b/i },
  { id: "brand-shacman-translit", brand: "SHACMAN", pattern: /\bshakman\b/i },
  { id: "brand-shacman-shaanxi", brand: "SHACMAN", pattern: /\bshaanxi\b/i },
  { id: "brand-kamaz-latin", brand: "KAMAZ", pattern: /\bkamaz\b/i },
];

const MODEL_FAMILY_RULES: ModelFamilyRule[] = [
  { id: "bmw-5-series-en", brand: "BMW", family: "5", pattern: /\b5\s*series\b/i },
  { id: "bmw-5-series-translit", brand: "BMW", family: "5", pattern: /\b5\s*seri(?:ya|i[iy])\b/i },
  { id: "bmw-5-body", brand: "BMW", family: "5", pattern: /\b(g30|g31|f10|f11|e60|e61)\b/i },
  { id: "bmw-5-engine-index", brand: "BMW", family: "5", pattern: /\b(520|525|528|530|535|540)[a-z]?\b/i },
  { id: "bmw-3-series-en", brand: "BMW", family: "3", pattern: /\b3\s*series\b/i },
  { id: "bmw-3-series-translit", brand: "BMW", family: "3", pattern: /\b3\s*seri(?:ya|i[iy])\b/i },
  { id: "bmw-3-body", brand: "BMW", family: "3", pattern: /\b(g20|g21|f30|f31|e90|e91)\b/i },
  { id: "bmw-3-engine-index", brand: "BMW", family: "3", pattern: /\b(316|318|320|325|328|330|335|340)[a-z]?\b/i },
  { id: "bmw-x5", brand: "BMW", family: "X5", pattern: /\bx5\b/i },
  { id: "bmw-x5-body", brand: "BMW", family: "X5", pattern: /\b(f15|g05|e70|e53)\b/i },
  { id: "bmw-x3", brand: "BMW", family: "X3", pattern: /\bx3\b/i },
  { id: "bmw-x7", brand: "BMW", family: "X7", pattern: /\bx7\b/i },
  { id: "shacman-x3000", brand: "SHACMAN", family: "X3000", pattern: /\bx3000\b/i },
  { id: "shacman-f3000", brand: "SHACMAN", family: "F3000", pattern: /\bf3000\b/i },
  { id: "shacman-m3000", brand: "SHACMAN", family: "M3000", pattern: /\bm3000\b/i },
  { id: "shacman-l3000", brand: "SHACMAN", family: "L3000", pattern: /\bl3000\b/i },
  { id: "shacman-sx3258", brand: "SHACMAN", family: "X3000", pattern: /\bsx3258\b/i },
  { id: "shacman-sx3318", brand: "SHACMAN", family: "X3000", pattern: /\bsx3318\b/i },
  { id: "kamaz-54901", brand: "KAMAZ", family: "54901", pattern: /\b54901\b/i },
  { id: "kamaz-5490", brand: "KAMAZ", family: "5490", pattern: /\b5490\b/i },
  { id: "kamaz-65115", brand: "KAMAZ", family: "65115", pattern: /\b65115\b/i },
  { id: "kamaz-6520", brand: "KAMAZ", family: "6520", pattern: /\b6520\b/i },
  { id: "kamaz-43118", brand: "KAMAZ", family: "43118", pattern: /\b43118\b/i },
  { id: "kamaz-65117", brand: "KAMAZ", family: "65117", pattern: /\b65117\b/i },
  { id: "kamaz-65201", brand: "KAMAZ", family: "65201", pattern: /\b65201\b/i },
  { id: "kamaz-65206", brand: "KAMAZ", family: "65206", pattern: /\b65206\b/i },
  { id: "kamaz-6580", brand: "KAMAZ", family: "6580", pattern: /\b6580\b/i },
  { id: "kamaz-65116", brand: "KAMAZ", family: "65116", pattern: /\b65116\b/i },
  { id: "kamaz-65111", brand: "KAMAZ", family: "65111", pattern: /\b65111\b/i },
  { id: "kamaz-5460", brand: "KAMAZ", family: "5460", pattern: /\b5460\b/i },
];

function normalizeBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes" || value === "on") {
    return true;
  }
  if (value === "0" || value === "false" || value === "no" || value === "off") {
    return false;
  }

  return fallback;
}

function normalizeNumberEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.floor(parsed * 100) / 100;
  if (normalized < min || normalized > max) {
    return fallback;
  }

  return normalized;
}

const CATALOG_MODEL_NORMALIZATION_ENABLED = normalizeBooleanEnv(
  "CATALOG_MODEL_NORMALIZATION_ENABLED",
  false,
);
const CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE = normalizeNumberEnv(
  "CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE",
  0.75,
  0,
  1,
);

function transliterateToLatin(value: string): string {
  const lower = value.toLowerCase();
  let result = "";

  for (const char of lower) {
    result += TRANSLIT_MAP[char] ?? char;
  }

  return result;
}

function normalizeComparableText(value: string | null): string {
  if (!value) {
    return "";
  }

  return transliterateToLatin(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function mergeUniqueTextParts(parts: Array<string | null>): string | null {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const cleaned = part.trim().replace(/\s+/g, " ");
    if (!cleaned) {
      continue;
    }

    const normalized = normalizeComparableText(cleaned);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(cleaned);
  }

  return result.length > 0 ? result.join(" ").trim() : null;
}

function findBrandByRules(value: string): { brand: PilotBrand; ruleId: string } | null {
  for (const rule of BRAND_ALIAS_RULES) {
    if (rule.pattern.test(value)) {
      return { brand: rule.brand, ruleId: rule.id };
    }
  }

  return null;
}

function findModelFamilyByRules(
  brand: PilotBrand,
  value: string,
): { family: string; ruleId: string } | null {
  for (const rule of MODEL_FAMILY_RULES) {
    if (rule.brand !== brand) {
      continue;
    }
    if (rule.pattern.test(value)) {
      return { family: rule.family, ruleId: rule.id };
    }
  }

  return null;
}

export function normalizeCatalogModelIdentity(
  input: CatalogModelNormalizationInput,
): CatalogModelNormalizationResult {
  if (!CATALOG_MODEL_NORMALIZATION_ENABLED) {
    return {
      applied: false,
      brandCanonical: null,
      modelFamilyCanonical: null,
      modificationNormalized: input.modification,
      confidence: 0,
      minConfidenceToApply: CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE,
      method: "disabled",
      matchedBrandRuleId: null,
      matchedModelRuleId: null,
    };
  }

  const brandComparable = normalizeComparableText(input.brand);
  const modelComparable = normalizeComparableText(input.model);
  const modificationComparable = normalizeComparableText(input.modification);
  const sourceComparable = [brandComparable, modelComparable, modificationComparable]
    .filter(Boolean)
    .join(" ");

  if (!sourceComparable) {
    return {
      applied: false,
      brandCanonical: null,
      modelFamilyCanonical: null,
      modificationNormalized: input.modification,
      confidence: 0,
      minConfidenceToApply: CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE,
      method: "no_match",
      matchedBrandRuleId: null,
      matchedModelRuleId: null,
    };
  }

  const brandMatch = findBrandByRules(brandComparable) ?? findBrandByRules(sourceComparable);
  if (!brandMatch) {
    return {
      applied: false,
      brandCanonical: null,
      modelFamilyCanonical: null,
      modificationNormalized: input.modification,
      confidence: 0,
      minConfidenceToApply: CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE,
      method: "no_match",
      matchedBrandRuleId: null,
      matchedModelRuleId: null,
    };
  }

  const modelMatch = findModelFamilyByRules(brandMatch.brand, sourceComparable);
  if (!modelMatch) {
    return {
      applied: false,
      brandCanonical: brandMatch.brand,
      modelFamilyCanonical: null,
      modificationNormalized: input.modification,
      confidence: 0.45,
      minConfidenceToApply: CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE,
      method: "no_match",
      matchedBrandRuleId: brandMatch.ruleId,
      matchedModelRuleId: null,
    };
  }

  const mergedModification = mergeUniqueTextParts([
    input.model && normalizeComparableText(input.model) !== normalizeComparableText(modelMatch.family)
      ? input.model
      : null,
    input.modification,
  ]);

  let confidence = 0.8;
  if (mergedModification) {
    confidence += 0.1;
  }
  confidence = Math.min(confidence, 1);

  const targetModelComparable = normalizeComparableText(modelMatch.family);
  const originalModelComparable = normalizeComparableText(input.model);
  const targetModificationComparable = normalizeComparableText(mergedModification);
  const originalModificationComparable = normalizeComparableText(input.modification);
  const modelChanged = targetModelComparable !== originalModelComparable;
  const modificationChanged =
    targetModificationComparable !== originalModificationComparable;

  if (confidence < CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE || (!modelChanged && !modificationChanged)) {
    return {
      applied: false,
      brandCanonical: brandMatch.brand,
      modelFamilyCanonical: modelMatch.family,
      modificationNormalized: mergedModification,
      confidence,
      minConfidenceToApply: CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE,
      method: "rule",
      matchedBrandRuleId: brandMatch.ruleId,
      matchedModelRuleId: modelMatch.ruleId,
    };
  }

  return {
    applied: true,
    brandCanonical: brandMatch.brand,
    modelFamilyCanonical: modelMatch.family,
    modificationNormalized: mergedModification,
    confidence,
    minConfidenceToApply: CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE,
    method: "rule",
    matchedBrandRuleId: brandMatch.ruleId,
    matchedModelRuleId: modelMatch.ruleId,
  };
}
