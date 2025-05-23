import type { InterpolationData, InterpolationValue } from './types.js';

/**
 * Template engine for variable interpolation
 */
export class PromptTemplate {
  /**
   * Interpolate variables in a template string
   * Supports:
   * - {variable} - simple variable replacement
   * - {obj.prop} - nested property access
   * - {cond ? yes : no} - ternary expressions
   * - \{escaped} - escaped syntax
   * Also supports ${variable} syntax for backward compatibility
   */
  interpolate(template: string, data: InterpolationData): string {
    // First, handle escaped syntax - preserve the entire escaped sequence
    let escaped = template.replace(/\\\$\{/g, '\u0000');
    escaped = escaped.replace(/\\\{/g, '\u0001');

    // Replace {expression} with evaluated results (but not ${expression})
    let interpolated = escaped.replace(/(?<!\$)\{([^}]+)\}/g, (match, expression) => {
      return this.processExpression(expression, data, match);
    });
    
    // Also handle ${expression} for backward compatibility
    interpolated = interpolated.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      return this.processExpression(expression, data, match);
    });

    // Restore escaped symbols
    interpolated = interpolated.replace(/\u0000/g, '${');
    return interpolated.replace(/\u0001/g, '{');
  }
  
  private processExpression(expression: string, data: InterpolationData, originalMatch: string): string {
    try {
      // Check if it's a simple variable
      const trimmed = expression.trim();

      // Direct variable access
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
        return this.formatValue(data[trimmed]);
      }

      // Property access (e.g., obj.prop)
      if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(trimmed)) {
        const value = this.getNestedValue(data, trimmed);
        return this.formatValue(value);
      }

      // Ternary expression (simple)
      if (trimmed.includes('?') && trimmed.includes(':')) {
        return this.evaluateTernary(trimmed, data);
      }

      // Fallback: return original if can't evaluate
      return originalMatch;
    } catch (_error) {
      // On error, return original expression
      return originalMatch;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(
    obj: InterpolationData | InterpolationValue,
    path: string
  ): InterpolationValue {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && !Array.isArray(current)) {
        current = (current as Record<string, InterpolationValue>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Evaluate simple ternary expressions
   */
  private evaluateTernary(expression: string, data: InterpolationData): string {
    // Match: condition ? true_value : false_value
    const match = expression.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/);
    if (!match) return expression;

    const [, condition, trueValue, falseValue] = match;

    // Evaluate condition
    const conditionValue = this.evaluateCondition(condition.trim(), data);

    // Return appropriate value
    const selectedValue = conditionValue ? trueValue.trim() : falseValue.trim();

    // Remove quotes if present
    if (
      (selectedValue.startsWith('"') && selectedValue.endsWith('"')) ||
      (selectedValue.startsWith("'") && selectedValue.endsWith("'"))
    ) {
      return selectedValue.slice(1, -1);
    }

    // Check if it's a variable reference
    if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(selectedValue)) {
      const value = this.getNestedValue(data, selectedValue);
      return this.formatValue(value !== undefined ? value : selectedValue);
    }

    return selectedValue;
  }

  /**
   * Evaluate a simple condition
   */
  private evaluateCondition(condition: string, data: InterpolationData): boolean {
    // Direct variable check
    if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(condition)) {
      const value = this.getNestedValue(data, condition);
      return !!value;
    }

    // Negation
    if (condition.startsWith('!')) {
      return !this.evaluateCondition(condition.slice(1).trim(), data);
    }

    // Simple comparisons (==, !=, ===, !==)
    const comparisonMatch = condition.match(/^(.+?)\s*(===?|!==?)\s*(.+)$/);
    if (comparisonMatch) {
      const [, left, operator, right] = comparisonMatch;
      const leftValue = this.getValue(left.trim(), data);
      const rightValue = this.getValue(right.trim(), data);

      switch (operator) {
        case '==':
          return leftValue === rightValue;
        case '===':
          return leftValue === rightValue;
        case '!=':
          return leftValue !== rightValue;
        case '!==':
          return leftValue !== rightValue;
      }
    }

    return false;
  }

  /**
   * Get value from expression (variable, string literal, or number)
   */
  private getValue(expr: string, data: InterpolationData): InterpolationValue {
    // String literals
    if (
      (expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))
    ) {
      return expr.slice(1, -1);
    }

    // Numbers
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return Number.parseFloat(expr);
    }

    // Booleans
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (expr === 'undefined') return undefined;

    // Variable reference
    return this.getNestedValue(data, expr);
  }

  /**
   * Format a value for output
   */
  private formatValue(value: InterpolationValue): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }
}
