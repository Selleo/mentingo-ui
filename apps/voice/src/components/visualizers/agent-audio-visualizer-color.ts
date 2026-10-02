import { useEffect, useLayoutEffect, useRef, useState, type RefCallback } from "react";

/** Mentingo `--primary-700`, used when no `--primary` token is defined. */
const MENTINGO_PRIMARY_FALLBACK = "#3f58b6";

export const DEFAULT_VISUALIZER_COLOR = `var(--primary, ${MENTINGO_PRIMARY_FALLBACK})`;

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const RGB_COLOR_PATTERN = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/;
const CSS_VARIABLE_PATTERN = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/;

const fallbackRgbColor = [0x3f / 255, 0x58 / 255, 0xb6 / 255];

const parseResolvedColor = (color: string) => {
  const hexColor = color.match(HEX_COLOR_PATTERN);

  if (hexColor) {
    const [, r = "00", g = "00", b = "00"] = hexColor;

    return [r, g, b].map((channel) => Number.parseInt(channel, 16) / 255);
  }

  const rgbColor = color.match(RGB_COLOR_PATTERN);

  if (rgbColor) {
    const [, r = "0", g = "0", b = "0"] = rgbColor;

    return [r, g, b].map((channel) => Number.parseInt(channel, 10) / 255);
  }

  return null;
};

const resolveCssColor = (color: string, element: Element): string => {
  const trimmedColor = color.trim();
  const variable = trimmedColor.match(CSS_VARIABLE_PATTERN);

  if (!variable) {
    return trimmedColor;
  }

  const [, variableName, fallback] = variable;
  const variableValue = window.getComputedStyle(element).getPropertyValue(variableName).trim();

  if (variableValue) {
    return resolveCssColor(variableValue, element);
  }

  if (fallback) {
    return resolveCssColor(fallback, element);
  }

  return MENTINGO_PRIMARY_FALLBACK;
};

export const colorToRgb = (color = DEFAULT_VISUALIZER_COLOR, element?: Element | null) => {
  const resolvedColor =
    typeof window === "undefined"
      ? color.trim()
      : resolveCssColor(color, element ?? document.documentElement);
  const rgbColor = parseResolvedColor(resolvedColor);

  if (rgbColor) {
    return rgbColor;
  }

  if (typeof window !== "undefined") {
    console.error(
      `Invalid visualizer color '${color}'. Falling back to '${MENTINGO_PRIMARY_FALLBACK}'.`,
    );
  }

  return fallbackRgbColor;
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const isSameColor = (a: number[], b: number[]) => a.every((channel, index) => channel === b[index]);

export function useVisualizerColor(color: string, forwardedRef?: unknown) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [rgbColor, setRgbColor] = useState(() =>
    color.trim().startsWith("var(") ? fallbackRgbColor : colorToRgb(color),
  );

  useIsomorphicLayoutEffect(() => {
    const next = colorToRgb(color, elementRef.current);
    setRgbColor((current) => (isSameColor(current, next) ? current : next));
  }, [color]);

  const ref: RefCallback<HTMLDivElement> = (node) => {
    elementRef.current = node;
    if (typeof forwardedRef === "function") {
      (forwardedRef as RefCallback<HTMLDivElement>)(node);
    } else if (forwardedRef && typeof forwardedRef === "object") {
      (forwardedRef as { current: HTMLDivElement | null }).current = node;
    }
  };

  return { ref, rgbColor };
}
