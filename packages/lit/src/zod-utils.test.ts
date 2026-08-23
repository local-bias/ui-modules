import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractFormFields } from './zod-utils';

/** 単一フィールドのスキーマからそのフィールドのメタ情報だけを取り出す。 */
function field(schema: z.ZodTypeAny) {
  return extractFormFields(z.object({ value: schema }) as never)[0];
}

describe('input type mapping', () => {
  it.each([
    ['string', z.string(), 'text'],
    ['email string', z.string().email(), 'email'],
    ['url string', z.string().url(), 'url'],
    ['number', z.number(), 'number'],
    ['boolean', z.boolean(), 'checkbox'],
    ['enum', z.enum(['a', 'b']), 'select'],
    ['date', z.date(), 'date'],
  ])('maps %s to the %s input', (_name, schema, expected) => {
    expect(field(schema).inputType).toBe(expected);
  });

  it('skips fields it cannot render', () => {
    const fields = extractFormFields(
      z.object({ nested: z.object({ a: z.string() }), ok: z.string() }) as never
    );

    expect(fields.map((f) => f.key)).toEqual(['ok']);
  });

  it('returns an empty array for a schema without a shape', () => {
    expect(extractFormFields({ _def: {} })).toEqual([]);
  });
});

describe('labels and descriptions', () => {
  it('uses .describe() as the label', () => {
    expect(field(z.string().describe('名前')).label).toBe('名前');
  });

  it('falls back to the key when there is no description', () => {
    expect(field(z.string()).label).toBe('value');
  });

  it('does not repeat the label in the description slot', () => {
    const meta = field(z.string().describe('名前'));

    expect(meta.label).toBe('名前');
    expect(meta.description).toBe('');
  });
});

describe('modifiers', () => {
  it('marks a bare field required', () => {
    expect(field(z.string()).required).toBe(true);
  });

  it('marks .optional() and .nullable() not required', () => {
    expect(field(z.string().optional()).required).toBe(false);
    expect(field(z.string().nullable()).required).toBe(false);
  });

  it('extracts .default() values', () => {
    expect(field(z.boolean().default(true)).defaultValue).toBe(true);
    expect(field(z.string().default('x')).defaultValue).toBe('x');
  });

  it('keeps the description through wrappers', () => {
    expect(field(z.string().describe('名前').optional()).label).toBe('名前');
    expect(field(z.string().describe('名前').default('x')).label).toBe('名前');
  });

  it('sees through .refine()', () => {
    const meta = field(z.string().describe('名前').refine((v) => v.length > 2));

    expect(meta.inputType).toBe('text');
    expect(meta.label).toBe('名前');
  });

  it('renders the input side of a .transform()', () => {
    expect(field(z.string().transform((v) => v.length)).inputType).toBe('text');
  });
});

describe('constraints', () => {
  it('carries string length bounds', () => {
    const meta = field(z.string().min(2).max(8));

    expect(meta.minLength).toBe(2);
    expect(meta.maxLength).toBe(8);
  });

  it('carries numeric bounds', () => {
    const meta = field(z.number().min(0).max(150));

    expect(meta.min).toBe(0);
    expect(meta.max).toBe(150);
  });

  it('lists enum options', () => {
    expect(field(z.enum(['admin', 'editor', 'viewer'])).options).toEqual([
      'admin',
      'editor',
      'viewer',
    ]);
  });

  it('leaves options empty for non-enum fields', () => {
    expect(field(z.string()).options).toEqual([]);
  });
});

describe('whole-schema extraction', () => {
  it('preserves declaration order', () => {
    const fields = extractFormFields(
      z.object({
        name: z.string().describe('名前'),
        email: z.string().email().describe('メール'),
        age: z.number().optional().describe('年齢'),
      }) as never
    );

    expect(fields.map((f) => f.key)).toEqual(['name', 'email', 'age']);
    expect(fields.map((f) => f.inputType)).toEqual(['text', 'email', 'number']);
    expect(fields.map((f) => f.required)).toEqual([true, true, false]);
  });
});
