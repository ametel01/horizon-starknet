/**
 * Error Handling Tests
 *
 * Tests error classification and error utility functions.
 */

import { describe, expect, it } from "vitest";

import {
  assertNever,
  DataError,
  InvariantError,
  invariant,
  isDataError,
  isProgrammerError,
  ParseError,
} from "../src/lib/errors";

// ============================================================
// PARSE ERROR TESTS
// ============================================================

describe("ParseError", () => {
  it("creates error with correct name and message", () => {
    const error = new ParseError("Insufficient data", {
      index: 5,
      dataLength: 3,
      field: "amount",
    });

    expect(error.name).toBe("ParseError");
    expect(error.message).toBe("Insufficient data");
  });

  it("stores context correctly", () => {
    const context = {
      index: 10,
      dataLength: 5,
      field: "exchange_rate",
    };

    const error = new ParseError("Index out of bounds", context);

    expect(error.context).toEqual(context);
    expect(error.context.index).toBe(10);
    expect(error.context.dataLength).toBe(5);
    expect(error.context.field).toBe("exchange_rate");
  });

  it("is instanceof Error", () => {
    const error = new ParseError("Test", {
      index: 0,
      dataLength: 0,
      field: "test",
    });

    expect(error instanceof Error).toBe(true);
    expect(error instanceof ParseError).toBe(true);
  });

  it("has stack trace", () => {
    const error = new ParseError("Test", {
      index: 0,
      dataLength: 0,
      field: "test",
    });

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ParseError");
  });
});

// ============================================================
// INVARIANT ERROR TESTS
// ============================================================

describe("InvariantError", () => {
  it("creates error with correct name and prefixed message", () => {
    const error = new InvariantError("Database connection missing");

    expect(error.name).toBe("InvariantError");
    expect(error.message).toBe(
      "Invariant violation: Database connection missing"
    );
  });

  it("is instanceof Error", () => {
    const error = new InvariantError("Test");

    expect(error instanceof Error).toBe(true);
    expect(error instanceof InvariantError).toBe(true);
  });
});

// ============================================================
// DATA ERROR TESTS
// ============================================================

describe("DataError", () => {
  it("creates error with correct name and message", () => {
    const error = new DataError("Malformed event data");

    expect(error.name).toBe("DataError");
    expect(error.message).toBe("Malformed event data");
  });

  it("stores optional event data", () => {
    const eventData = { keys: ["0x1"], data: ["0x2"] };
    const error = new DataError("Invalid event", eventData);

    expect(error.event).toEqual(eventData);
  });

  it("handles undefined event data", () => {
    const error = new DataError("Invalid event");

    expect(error.event).toBeUndefined();
  });

  it("is instanceof Error", () => {
    const error = new DataError("Test");

    expect(error instanceof Error).toBe(true);
    expect(error instanceof DataError).toBe(true);
  });
});

// ============================================================
// INVARIANT FUNCTION TESTS
// ============================================================

describe("invariant", () => {
  it("does not throw for truthy condition", () => {
    expect(() => {
      invariant(true, "Should not throw");
    }).not.toThrow();

    expect(() => {
      invariant(1, "Should not throw");
    }).not.toThrow();

    expect(() => {
      invariant("non-empty", "Should not throw");
    }).not.toThrow();

    expect(() => {
      invariant({}, "Should not throw");
    }).not.toThrow();
  });

  it("throws InvariantError for falsy condition", () => {
    expect(() => {
      invariant(false, "Condition failed");
    }).toThrow(InvariantError);

    expect(() => {
      invariant(null, "Null value");
    }).toThrow(InvariantError);

    expect(() => {
      invariant(undefined, "Undefined value");
    }).toThrow(InvariantError);

    expect(() => {
      invariant(0, "Zero value");
    }).toThrow(InvariantError);

    expect(() => {
      invariant("", "Empty string");
    }).toThrow(InvariantError);
  });

  it("includes message in thrown error", () => {
    try {
      invariant(false, "Custom message");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err instanceof InvariantError).toBe(true);
      expect((err as InvariantError).message).toContain("Custom message");
    }
  });

  it("narrows type after assertion", () => {
    // Use a function to create the value so TypeScript can't optimize away the null check
    const getValue = (): string | null => "test";
    const value = getValue();
    invariant(value !== null, "Value is null");
    // TypeScript should now know value is string
    expect(value.length).toBe(4);
  });
});

// ============================================================
// ASSERT NEVER TESTS
// ============================================================

describe("assertNever", () => {
  it("throws InvariantError with value in message", () => {
    // @ts-expect-error - Intentionally passing wrong type for test
    expect(() => assertNever("unexpected")).toThrow(InvariantError);
  });

  it("includes JSON representation of value", () => {
    try {
      // @ts-expect-error - Intentionally passing wrong type for test
      assertNever({ type: "unknown" });
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as InvariantError).message).toContain("unknown");
    }
  });
});

// ============================================================
// ERROR CLASSIFICATION TESTS
// ============================================================

describe("isProgrammerError", () => {
  it("returns true for InvariantError", () => {
    const error = new InvariantError("Test");
    expect(isProgrammerError(error)).toBe(true);
  });

  it("returns false for ParseError", () => {
    const error = new ParseError("Test", {
      index: 0,
      dataLength: 0,
      field: "test",
    });
    expect(isProgrammerError(error)).toBe(false);
  });

  it("returns false for DataError", () => {
    const error = new DataError("Test");
    expect(isProgrammerError(error)).toBe(false);
  });

  it("returns false for generic Error", () => {
    const error = new Error("Test");
    expect(isProgrammerError(error)).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isProgrammerError("string error")).toBe(false);
    expect(isProgrammerError(null)).toBe(false);
    expect(isProgrammerError(undefined)).toBe(false);
    expect(isProgrammerError(42)).toBe(false);
  });
});

describe("isDataError", () => {
  it("returns true for ParseError", () => {
    const error = new ParseError("Test", {
      index: 0,
      dataLength: 0,
      field: "test",
    });
    expect(isDataError(error)).toBe(true);
  });

  it("returns true for DataError", () => {
    const error = new DataError("Test");
    expect(isDataError(error)).toBe(true);
  });

  it("returns false for InvariantError", () => {
    const error = new InvariantError("Test");
    expect(isDataError(error)).toBe(false);
  });

  it("returns false for generic Error", () => {
    const error = new Error("Test");
    expect(isDataError(error)).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isDataError("string error")).toBe(false);
    expect(isDataError(null)).toBe(false);
  });
});

// ============================================================
// ERROR CLASSIFICATION CONSISTENCY TESTS
// ============================================================

describe("Error Classification Consistency", () => {
  it("InvariantError is programmer error, not data error", () => {
    const error = new InvariantError("Test");
    expect(isProgrammerError(error)).toBe(true);
    expect(isDataError(error)).toBe(false);
  });

  it("ParseError is data error, not programmer error", () => {
    const error = new ParseError("Test", {
      index: 0,
      dataLength: 0,
      field: "test",
    });
    expect(isProgrammerError(error)).toBe(false);
    expect(isDataError(error)).toBe(true);
  });

  it("DataError is data error, not programmer error", () => {
    const error = new DataError("Test");
    expect(isProgrammerError(error)).toBe(false);
    expect(isDataError(error)).toBe(true);
  });

  it("generic Error is neither programmer nor data error", () => {
    const error = new Error("Test");
    expect(isProgrammerError(error)).toBe(false);
    expect(isDataError(error)).toBe(false);
  });
});
