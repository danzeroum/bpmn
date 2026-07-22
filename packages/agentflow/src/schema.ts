/**
 * Schema normalization (Squad Lane SL-4).
 *
 * `SchemaShape` accepts two forms per field — the Handoff 12 plain type token
 * (`"string"`) and the SL-4 honest JSON-Schema subset ({@link SchemaNode}). The
 * union is additive: existing string-token schemas stay byte-stable, and every
 * reader lifts a string to a {@link SchemaNode} through {@link normalizeSchema}
 * so downstream code sees ONE shape. Pure, imports nothing (independence test).
 */

import type { SchemaField, SchemaNode, SchemaShape } from './types.js';

/** The only keywords the honest subset supports (cerca §5 / SL-4). */
export const SUPPORTED_SCHEMA_KEYWORDS = ['type', 'required', 'enum', 'items', 'properties'] as const;

/** True when a field is already the {@link SchemaNode} object form. */
export function isSchemaNode(field: SchemaField): field is SchemaNode {
  return typeof field === 'object' && field !== null;
}

/** Lifts a field to a {@link SchemaNode}; a legacy string becomes `{ type }`. */
export function normalizeSchemaField(field: SchemaField): SchemaNode {
  return isSchemaNode(field) ? field : { type: field };
}

/** Normalizes every field of a shape to {@link SchemaNode} form. */
export function normalizeSchema(shape: SchemaShape): Record<string, SchemaNode> {
  const out: Record<string, SchemaNode> = {};
  for (const [key, field] of Object.entries(shape)) out[key] = normalizeSchemaField(field);
  return out;
}

/**
 * The keywords present on a {@link SchemaNode} that fall OUTSIDE the honest
 * subset (recursing into `items`/`properties`). A non-empty result is declared
 * as a `SCHEMA_UNSUPPORTED_KEYWORD` warning — never silently honored.
 */
export function unsupportedKeywords(node: SchemaNode): string[] {
  const found = new Set<string>();
  const visit = (n: SchemaNode): void => {
    for (const key of Object.keys(n)) {
      if (!(SUPPORTED_SCHEMA_KEYWORDS as readonly string[]).includes(key)) found.add(key);
    }
    if (n.items) visit(n.items);
    if (n.properties) for (const child of Object.values(n.properties)) visit(child);
  };
  visit(node);
  return [...found];
}

/** The required-field keys of a shape (a field is required only in SchemaNode
 * form with `required: true`; a legacy string field is never required). */
export function requiredKeys(shape: SchemaShape): string[] {
  return Object.entries(shape)
    .filter(([, field]) => isSchemaNode(field) && field.required === true)
    .map(([key]) => key);
}
