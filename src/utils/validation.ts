import { z } from 'zod';
import type { CCResult, InterpolationData } from '../types.js';

/**
 * Result of validation operations
 */
export type ValidationResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Validate input data against a Zod schema
 * @param schema - Zod schema or record of Zod types
 * @param input - Input data to validate
 * @returns Validation result
 */
export function validateInput(
  schema: z.ZodSchema | Record<string, z.ZodType>,
  input: InterpolationData
): ValidationResult {
  try {
    // Convert record to object schema if needed
    const zodSchema =
      schema instanceof z.ZodSchema ? schema : z.object(schema as Record<string, z.ZodType>);

    zodSchema.parse(input);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: errors };
    }
    return { success: false, error: String(error) };
  }
}

/**
 * Validate output data against a Zod schema
 * @param result - Result from Claude execution
 * @param schema - Zod schema or record of Zod types
 * @param context - Optional context for error messages
 * @returns Validation result with typed data
 */
export function validateOutput<T = unknown>(
  result: CCResult,
  schema: z.ZodSchema<T> | Record<string, z.ZodType>,
  context?: string
): ValidationResult<T> {
  if (!result.success) {
    return {
      success: false,
      error: `${context || 'Operation'} failed: ${result.error || 'Unknown error'}`,
    };
  }

  if (!result.data) {
    return {
      success: false,
      error: `${context || 'Operation'} did not return any data`,
    };
  }

  try {
    // Convert Record<string, z.ZodType> to z.ZodSchema if needed
    const zodSchema =
      schema instanceof z.ZodSchema ? schema : z.object(schema as Record<string, z.ZodType>);

    const validatedData = zodSchema.parse(result.data);
    return { success: true, data: validatedData as T };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      return {
        success: false,
        error: `${context || 'Validation'} failed: ${errorMessages}`,
      };
    }

    return {
      success: false,
      error: `${context || 'Validation'} error: ${error}`,
    };
  }
}
