import { existsSync, readFileSync } from 'fs';
import matter from 'gray-matter';
import { z } from 'zod';
import type { PromptConfig } from './types.js';

/**
 * Load a prompt file with frontmatter
 */
export async function loadPromptFile(
  path: string
): Promise<{ config: PromptConfig; content: string }> {
  try {
    const fileContent = readFileSync(path, 'utf-8');
    const parsed = matter(fileContent);

    // Convert YAML schema notation to Zod if needed
    const config = await processConfig(parsed.data);

    return {
      config,
      content: parsed.content,
    };
  } catch (error) {
    throw new Error(`Failed to load prompt file ${path}: ${error}`);
  }
}

/**
 * Process configuration from frontmatter
 */
async function processConfig(data: Record<string, unknown>): Promise<PromptConfig> {
  const config: PromptConfig = {};

  // Copy basic options
  if (data.systemPrompt !== undefined) config.systemPrompt = String(data.systemPrompt);
  if (data.allowedTools !== undefined && Array.isArray(data.allowedTools)) {
    config.allowedTools = data.allowedTools.map(String);
  }

  // Process input schema
  if (data.input) {
    config.input = parseSchema(data.input, 'input');
  }

  // Process output schema
  if (data.output) {
    config.output = parseSchema(data.output, 'output');
  }

  return config;
}

/**
 * Parse schema from YAML notation to Zod
 */
function parseSchema(
  schema: unknown,
  type: 'input' | 'output'
): z.ZodSchema | Record<string, z.ZodType> {
  // If it's already a Zod schema (shouldn't happen from YAML, but just in case)
  if (schema instanceof z.ZodSchema) {
    return schema;
  }

  // If it's a simple object notation, convert to Zod
  if (typeof schema === 'object' && !Array.isArray(schema)) {
    const zodSchema: Record<string, z.ZodType> = {};

    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      zodSchema[key] = parseFieldType(key, value);
    }

    // For output schemas, always return as z.object()
    if (type === 'output') {
      return z.object(zodSchema);
    }

    // For input schemas, return as record (will be converted to z.object in validation)
    return zodSchema;
  }

  throw new Error(`Invalid schema format for ${type}`);
}

/**
 * Parse individual field type from YAML notation
 */
function parseFieldType(key: string, value: unknown): z.ZodType {
  // Handle string type annotations
  if (typeof value === 'string') {
    // Check for optional modifier
    const isOptional = key.endsWith('?');
    const baseType = parseTypeString(value);

    return isOptional ? baseType.optional() : baseType;
  }

  // Handle object with type property
  if (typeof value === 'object' && value !== null && 'type' in value) {
    const schemaConfig = value as Record<string, unknown>;
    const baseType = parseTypeString(String(schemaConfig.type));
    let schema = baseType;

    // Apply modifiers
    if (schemaConfig.optional) schema = schema.optional();
    if (schemaConfig.nullable) schema = schema.nullable();
    if (schemaConfig.default !== undefined) schema = schema.default(schemaConfig.default);

    // Apply validators
    if (schemaConfig.min !== undefined && schema instanceof z.ZodString) {
      schema = (schema as z.ZodString).min(Number(schemaConfig.min));
    }
    if (schemaConfig.max !== undefined && schema instanceof z.ZodString) {
      schema = (schema as z.ZodString).max(Number(schemaConfig.max));
    }
    if (schemaConfig.enum && Array.isArray(schemaConfig.enum)) {
      schema = z.enum(schemaConfig.enum as [string, ...string[]]);
    }

    return schema;
  }

  // Default to string
  return z.string();
}

/**
 * Parse type string to Zod type
 */
function parseTypeString(type: string): z.ZodType {
  switch (type.toLowerCase()) {
    case 'string':
      return z.string();
    case 'number':
      return z.number();
    case 'boolean':
    case 'bool':
      return z.boolean();
    case 'array':
      return z.array(z.any());
    case 'object':
      return z.object({});
    case 'any':
      return z.any();
    default:
      // Check for array notation
      if (type.endsWith('[]')) {
        const itemType = type.slice(0, -2);
        return z.array(parseTypeString(itemType));
      }
      // Default to string for unknown types
      return z.string();
  }
}

/**
 * Resolve system prompt - load from file if it's a path
 */
export async function resolveSystemPrompt(value: string): Promise<string> {
  // Check if it looks like a file path and exists
  if (value.endsWith('.md') || value.endsWith('.txt')) {
    if (existsSync(value)) {
      return readFileSync(value, 'utf-8');
    }
  }

  // Otherwise treat as inline content
  return value;
}
