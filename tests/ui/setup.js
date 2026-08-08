// Setup for the chat UI component suite (jsdom).
//
// Only the browser APIs jsdom does not implement are stubbed. Everything else
// — React Query, the components, the hooks' own logic — runs for real, because
// the behaviour under test here (scroll position, which control is rendered)
// only exists once those pieces are wired together.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom has no layout engine, so scrollHeight/clientHeight are 0 and
// scrollIntoView does not exist. Tests that care about scrolling define their
// own element geometry; these are the baseline shims that keep components from
// throwing before they get there.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn(function scrollTo(options) {
    if (typeof options === "object" && options !== null) {
      this.scrollTop = options.top ?? this.scrollTop;
    }
  });
}

// rAF in jsdom is a 16ms timer; the components double-rAF before scrolling.
// Running it as a microtask-ish immediate keeps tests fast and deterministic.
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// ResizeObserver drives the "re-pin to bottom when an image loads" behaviour.
// jsdom never fires layout, so a no-op double keeps the component mountable;
// the initial-scroll assertions do not depend on it.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}
