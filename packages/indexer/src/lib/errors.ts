/**
 * Error classification for indexer error handling
 *
 * Distinguishes between programmer errors (should crash) and data errors (should log & skip).
 *
 * Programmer errors indicate bugs in the indexer code that need fixing.
 * Data errors indicate malformed events from the chain that shouldn't halt indexing.
 */

/**
 * Context for parse errors, providing details about where parsing failed
 */
export interface ParseErrorContext {
  index: number;
  dataLength: number;
  field: string;
}

/**
 * Error thrown when parsing event data fails due to insufficient or malformed data
 *
 * This is a data error - the event should be logged and skipped, not crash the indexer.
 */
export class ParseError extends Error {
  public readonly context: ParseErrorContext;

  constructor(message: string, context: ParseErrorContext) {
    super(message);
    this.name = "ParseError";
    this.context = context;
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, ParseError);
  }
}

/**
 * Error thrown when a programming invariant is violated
 *
 * This is a programmer error - the indexer should crash immediately
 * so the bug can be fixed.
 */
export class InvariantError extends Error {
  constructor(message: string) {
    super(`Invariant violation: ${message}`);
    this.name = "InvariantError";
    Error.captureStackTrace(this, InvariantError);
  }
}

/**
 * Error thrown when event data is malformed or unexpected
 *
 * This is a data error - the event should be logged and skipped.
 */
export class DataError extends Error {
  public readonly event?: unknown;

  constructor(message: string, event?: unknown) {
    super(message);
    this.name = "DataError";
    this.event = event;
    Error.captureStackTrace(this, DataError);
  }
}

/**
 * Assert that a condition is true, throwing InvariantError if not
 *
 * Use for conditions that should always be true if the code is correct.
 *
 * @example
 * invariant(user.id != null, "User must have an ID");
 */
export function invariant(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}

/**
 * Assert that a value should never be reached (exhaustive check)
 *
 * Useful for switch statements to ensure all cases are handled.
 *
 * @example
 * switch (eventType) {
 *   case "mint": return handleMint();
 *   case "burn": return handleBurn();
 *   default: assertNever(eventType);
 * }
 */
export function assertNever(value: never): never {
  throw new InvariantError(`Unexpected value: ${JSON.stringify(value)}`);
}

/**
 * Check if an error is a programmer error (should crash)
 *
 * Use to determine whether to rethrow or log and continue.
 */
export function isProgrammerError(err: unknown): boolean {
  return err instanceof InvariantError;
}

/**
 * Check if an error is a data error (should log and skip)
 */
export function isDataError(err: unknown): boolean {
  return err instanceof DataError || err instanceof ParseError;
}
