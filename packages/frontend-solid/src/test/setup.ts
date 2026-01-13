import "@testing-library/jest-dom/vitest";

// Mock ResizeObserver for components that use it
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

// Mock matchMedia for responsive components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver for lazy loading components
class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = IntersectionObserverMock;

// Mock scrollTo for navigation tests
window.scrollTo = () => {};

// Suppress console errors during tests unless explicitly testing error handling
const originalError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out expected hydration warnings in SolidJS tests
  if (
    typeof args[0] === "string" &&
    (args[0].includes("Hydration mismatch") ||
      args[0].includes("computations created outside"))
  ) {
    return;
  }
  originalError.call(console, ...args);
};
