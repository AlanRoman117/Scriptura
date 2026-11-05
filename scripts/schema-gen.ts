/**
 * Generate JSON Schema files from the canonical TypeScript types.
 *
 * Outputs:
 *   - data/schemas/metadata.schema.json
 *   - data/schemas/book.schema.json
 *
 * These schemas can be used for validation in non-TypeScript environments
 * and by the Python validation script.
 *
 * Usage:
 *   npx ts-node scripts/schema-gen.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA_DIR = join(__dirname, '..', 'data', 'schemas');

const metadataSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'TranslationMeta',
  description: 'Metadata for a Scriptura Bible translation.',
  type: 'object',
  required: ['id', 'name', 'language', 'license', 'attribution', 'source_url', 'year', 'testament', 'book_count'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    language: { type: 'string', description: 'ISO 639-1 language code' },
    license: { type: 'string', enum: ['public-domain', 'cc-by-3.0-br', 'cc-by-4.0', 'cc-by-sa-4.0', 'cc0', 'custom-free'] },
    attribution: { type: 'string' },
    attribution_lang: { type: 'string', description: 'Language of the attribution, when it is not the language of the Bible' },
    license_url: { type: 'string', format: 'uri', pattern: '^https://' },
    rights_notice: { type: 'string', minLength: 1, description: 'One line in English saying where the license does not hold' },
    source_url: { type: 'string', format: 'uri' },
    year: { type: 'integer' },
    testament: { type: 'string', enum: ['both', 'OT', 'NT'] },
    book_count: { type: 'integer', const: 66 },
  },
  additionalProperties: false,
};

const bookSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Book',
  description: 'A book of the Bible in Scriptura canonical format.',
  type: 'object',
  required: ['number', 'name', 'abbreviation', 'testament', 'chapters'],
  properties: {
    number: { type: 'integer', minimum: 1, maximum: 66 },
    name: { type: 'string' },
    abbreviation: { type: 'string' },
    testament: { type: 'string', enum: ['OT', 'NT'] },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['number', 'verses'],
        properties: {
          number: { type: 'integer', minimum: 1 },
          superscription: {
            type: 'string',
            minLength: 1,
            description: "The chapter's title where the source has one (a Psalm's superscription); absent, never empty, otherwise",
          },
          verses: {
            type: 'array',
            items: {
              type: 'object',
              required: ['number', 'text'],
              properties: {
                number: { type: 'integer', minimum: 1 },
                text: { type: 'string', minLength: 1 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

mkdirSync(SCHEMA_DIR, { recursive: true });

writeFileSync(
  join(SCHEMA_DIR, 'metadata.schema.json'),
  JSON.stringify(metadataSchema, null, 2) + '\n'
);

writeFileSync(
  join(SCHEMA_DIR, 'book.schema.json'),
  JSON.stringify(bookSchema, null, 2) + '\n'
);

console.log(`Schemas written to ${SCHEMA_DIR}`);
