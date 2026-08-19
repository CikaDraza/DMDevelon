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

// ResizeObserver drives "keep the end in view when the box changes size" —
// an image finishing, the composer growing under the thread, a hidden pane
// getting a size. jsdom never lays anything out, so this double records WHICH
// elements each observer watches and lets a test fire the callback for one of
// them, exactly as the browser would. Observing the wrong element then shows
// up as a test failure rather than as silence.
class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Set();
    FakeResizeObserver.instances.add(this);
  }
  observe(el) {
    this.elements.add(el);
  }
  unobserve(el) {
    this.elements.delete(el);
  }
  disconnect() {
    this.elements.clear();
    FakeResizeObserver.instances.delete(this);
  }
}
FakeResizeObserver.instances = new Set();
globalThis.ResizeObserver = FakeResizeObserver;

// Report that `el`'s box changed size, to whoever is actually watching it.
globalThis.fireResize = (el) => {
  for (const observer of FakeResizeObserver.instances) {
    if (observer.elements.has(el)) {
      observer.callback([{ target: el }], observer);
    }
  }
};

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
