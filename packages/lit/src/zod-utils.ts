import type { FormFieldMeta, FormInputType } from './types';

// ─── Internal Zod type representations (duck-typed, v3 + v4) ─
//
// Zod v3: _def.typeName = 'ZodString' | 'ZodNumber' | ...
// Zod v4: _def.type     = 'string'    | 'number'    | ...

interface ZodDef {
  // v3 discriminant
  typeName?: string;
  // v4 discriminant
  type?: string;
  // shared
  checks?: any[];
  innerType?: ZodFieldLike;
  // ZodDefault: v3 = function, v4 = raw value
  defaultValue?: unknown;
  // ZodObject: v3 = function, v4 = plain object
  shape?: (() => Record<string, ZodFieldLike>) | Record<string, ZodFieldLike>;
  // ZodEnum v3: array of strings
  values?: readonly string[];
  // ZodEnum v4: object { key: value }
  entries?: Record<string, string>;
  // ZodEffects v3: inner schema
  schema?: ZodFieldLike;
  [key: string]: unknown;
}

interface ZodFieldLike {
  _def: ZodDef;
  description?: string;
  // v4 ZodString instance properties
  minLength?: number | null;
  maxLength?: number | null;
  format?: string | null;
  // v4 ZodNumber instance properties
  minValue?: number | null;
  maxValue?: number | null;
  // v4 ZodEnum instance property
  options?: readonly string[];
}

// ─── Type name helpers ───────────────────────────────────────

/**
 * Normalize v4 short names ('string', 'number', ...) to the
 * v3 ZodXxx style so the rest of the code can use a single switch.
 */
function resolveTypeName(field: ZodFieldLike): string {
  const raw = (field._def.typeName ?? field._def.type) as string | undefined;
  if (!raw) return '';
  const v4Map: Record<string, string> = {
    string: 'ZodString',
    number: 'ZodNumber',
    boolean: 'ZodBoolean',
    enum: 'ZodEnum',
    date: 'ZodDate',
    optional: 'ZodOptional',
    nullable: 'ZodNullable',
    default: 'ZodDefault',
    object: 'ZodObject',
    pipe: 'ZodPipe',
  };
  return v4Map[raw] ?? raw;
}

// ─── Unwrap wrappers ─────────────────────────────────────────

interface UnwrapResult {
  inner: ZodFieldLike;
  required: boolean;
  defaultValue: unknown;
  description: string;
}

function unwrapType(zodType: ZodFieldLike): UnwrapResult {
  let inner = zodType;
  let required = true;
  let defaultValue: unknown = undefined;
  let description = zodType.description ?? '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const typeName = resolveTypeName(inner);

    if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
      required = false;
      inner = inner._def.innerType!;
    } else if (typeName === 'ZodDefault') {
      const raw = inner._def.defaultValue;
      // v3: defaultValue is a function  () => T
      // v4: defaultValue is the raw value directly
      defaultValue = typeof raw === 'function' ? raw() : raw;
      inner = inner._def.innerType!;
    } else if (typeName === 'ZodEffects') {
      // v3 only: .refine() / .transform() wraps in ZodEffects
      inner = inner._def.schema!;
    } else {
      break;
    }

    // Pick up description from inner type if not already set
    if (!description && inner.description) {
      description = inner.description;
    }
  }

  return { inner, required, defaultValue, description };
}

// ─── Field extraction ────────────────────────────────────────

function extractFieldMeta(key: string, zodType: ZodFieldLike): FormFieldMeta | null {
  const { inner, required, defaultValue, description } = unwrapType(zodType);
  const typeName = resolveTypeName(inner);

  let inputType: FormInputType;
  let options: string[] = [];
  let min: number | undefined;
  let max: number | undefined;
  let minLength: number | undefined;
  let maxLength: number | undefined;

  switch (typeName) {
    case 'ZodString': {
      inputType = 'text';

      // v4: format / minLength / maxLength are direct instance properties
      if (inner.format === 'email') inputType = 'email';
      else if (inner.format === 'url') inputType = 'url';
      if (inner.minLength != null) minLength = inner.minLength;
      if (inner.maxLength != null) maxLength = inner.maxLength;

      // v3 fallback: parse _def.checks array
      const checks = inner._def.checks ?? [];
      for (const check of checks) {
        const kind: string | undefined = check.kind ?? check.def?.check;
        const fmt: string | undefined = check.format ?? check.def?.format;
        if (!fmt && (kind === 'email' || fmt === 'email')) inputType = 'email';
        else if (!fmt && (kind === 'url' || fmt === 'url')) inputType = 'url';
        else if (fmt === 'email' && inputType === 'text') inputType = 'email';
        else if (fmt === 'url' && inputType === 'text') inputType = 'url';
        if (kind === 'min' && check.value != null && minLength == null) minLength = check.value;
        if (kind === 'max' && check.value != null && maxLength == null) maxLength = check.value;
      }
      break;
    }

    case 'ZodNumber': {
      inputType = 'number';

      // v4: minValue / maxValue are direct instance properties
      if (inner.minValue != null) min = inner.minValue;
      if (inner.maxValue != null) max = inner.maxValue;

      // v3 fallback
      if (min == null || max == null) {
        const checks = inner._def.checks ?? [];
        for (const check of checks) {
          if (check.kind === 'min' && check.value != null && min == null) min = check.value;
          if (check.kind === 'max' && check.value != null && max == null) max = check.value;
        }
      }
      break;
    }

    case 'ZodBoolean':
      inputType = 'checkbox';
      break;

    case 'ZodEnum': {
      inputType = 'select';
      // v4: .options is a direct array
      if (inner.options?.length) {
        options = [...inner.options];
      } else if (inner._def.entries) {
        // v4 fallback via _def.entries (object { key: value })
        options = Object.values(inner._def.entries);
      } else if (inner._def.values?.length) {
        // v3: _def.values is a readonly string array
        options = [...inner._def.values];
      }
      break;
    }

    case 'ZodNativeEnum': {
      inputType = 'select';
      const enumValues = inner._def.values as Record<string, string | number> | undefined;
      if (enumValues) {
        options = Object.values(enumValues).filter((v) => typeof v === 'string') as string[];
      }
      break;
    }

    case 'ZodDate':
      inputType = 'date';
      break;

    default:
      return null;
  }

  const label = description || key;

  return {
    key,
    inputType,
    label,
    description: description && description !== label ? description : '',
    required,
    options,
    placeholder: '',
    min,
    max,
    minLength,
    maxLength,
    defaultValue,
  };
}

// ─── Public API ──────────────────────────────────────────────

export function extractFormFields(schema: {
  _def: {
    shape?: (() => Record<string, ZodFieldLike>) | Record<string, ZodFieldLike>;
    [key: string]: unknown;
  };
}): FormFieldMeta[] {
  const shapeDef = schema._def.shape;
  if (!shapeDef) return [];

  // v3: shape is a lazy function; v4: shape is a plain object
  const shape = typeof shapeDef === 'function' ? shapeDef() : shapeDef;
  if (!shape) return [];

  const fields: FormFieldMeta[] = [];
  for (const [key, zodType] of Object.entries(shape)) {
    const meta = extractFieldMeta(key, zodType as ZodFieldLike);
    if (meta) fields.push(meta);
  }
  return fields;
}
