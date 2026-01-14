/**
 * Prisma Runtime Shim
 * 
 * Provides fallback implementations for Prisma runtime utilities that don't exist in the version
 * or build configuration, such as Decimal and JsonNull.
 */

// Try to import Decimal from official Prisma runtime, fallback to local implementation
let Decimal: any;
try {
  // @ts-ignore
  Decimal = require('@prisma/client/runtime/library').Decimal;
} catch (e) {
  // Fallback: create a safe Decimal-like proxy
  Decimal = class DecimalShim {
    constructor(private value: number | string) {}

    toNumber() {
      return Number(this.value);
    }

    toString() {
      return String(this.value);
    }

    toJSON() {
      return this.toString();
    }

    // Arithmetic operations - return DecimalShim or number
    add(other: any) {
      const n = Number(other);
      return new DecimalShim(Number(this.value) + n);
    }

    sub(other: any) {
      const n = Number(other);
      return new DecimalShim(Number(this.value) - n);
    }

    mul(other: any) {
      const n = Number(other);
      return new DecimalShim(Number(this.value) * n);
    }

    div(other: any) {
      const n = Number(other);
      return new DecimalShim(Number(this.value) / n);
    }

    // Comparison operations - return boolean
    equals(other: any) {
      return Number(this.value) === Number(other);
    }

    lessThan(other: any) {
      return Number(this.value) < Number(other);
    }

    lessThanOrEqualTo(other: any) {
      return Number(this.value) <= Number(other);
    }

    greaterThan(other: any) {
      return Number(this.value) > Number(other);
    }

    greaterThanOrEqualTo(other: any) {
      return Number(this.value) >= Number(other);
    }

    isPositive() {
      return Number(this.value) > 0;
    }

    isNegative() {
      return Number(this.value) < 0;
    }

    isZero() {
      return Number(this.value) === 0;
    }

    // Static max/min
    static max(...values: any[]) {
      const numbers = values.map(v => Number(v));
      return new DecimalShim(Math.max(...numbers));
    }

    static min(...values: any[]) {
      const numbers = values.map(v => Number(v));
      return new DecimalShim(Math.min(...numbers));
    }
  };
}

// JSON null/db null placeholders
export const JsonNull = null;
export const DbNull = null;

export { Decimal };

// For cases where InputJsonValue is needed (Prisma.InputJsonValue)
export type InputJsonValue =
  | string
  | number
  | boolean
  | { toJSON(): string }
  | null
  | InputJsonValue[]
  | { [key: string]: InputJsonValue };

// Export safe versions of common Prisma Namespace types
export type JsonValue = any;
export type NullableJsonNullValueInput = InstanceType<typeof JsonNull> | 'JsonNull';
export type JsonNullValueInput = 'JsonNull';
