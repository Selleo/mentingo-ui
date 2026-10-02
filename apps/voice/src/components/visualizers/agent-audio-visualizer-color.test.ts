import { afterEach, describe, expect, it, vi } from "vitest";

import { colorToRgb, DEFAULT_VISUALIZER_COLOR } from "./agent-audio-visualizer-color";

const rgb = (hex: string) =>
  [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);

describe("colorToRgb", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  it("resolves variables against the given element, not only :root", () => {
    document.documentElement.style.setProperty("--primary", "#000000");
    // jsdom does not inherit custom properties, so the token is set on the element itself;
    // in browsers a token on any ancestor (e.g. a theme wrapper) resolves the same way.
    const element = document.createElement("div");
    element.style.setProperty("--primary", "#4796fd");
    document.body.appendChild(element);

    expect(colorToRgb("var(--primary)", element)).toEqual(rgb("#4796fd"));
    expect(colorToRgb("var(--primary)")).toEqual(rgb("#000000"));
  });

  it("defaults to the Mentingo primary instead of a hard-coded brand color", () => {
    expect(colorToRgb(DEFAULT_VISUALIZER_COLOR)).toEqual(rgb("#3f58b6"));
  });

  it("falls back to the Mentingo primary for unresolvable colors", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(colorToRgb("var(--missing)")).toEqual(rgb("#3f58b6"));
    expect(colorToRgb("not-a-color")).toEqual(rgb("#3f58b6"));
    error.mockRestore();
  });
});
