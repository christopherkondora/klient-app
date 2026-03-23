/**
 * Generate a project color shade from a client's base color.
 * Each project gets a unique but visibly related hue shift.
 */

function hexToHSL(hex: string): [number, number, number] {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s: number;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));
  const sn = s / 100;
  const ln = l / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a project shade from the client's base color.
 * @param baseColor Client hex color (e.g. "#598392")
 * @param index 0-based index of the project (among that client's projects)
 */
export function generateProjectColor(baseColor: string, index: number): string {
  const [h, s, l] = hexToHSL(baseColor || '#598392');
  // Shift hue by 25° per project, vary lightness for visual distinction
  const hueShift = (index * 25) % 360;
  const lightnessShift = ((index % 4) - 1.5) * 8; // -12, -4, +4, +12
  return hslToHex(h + hueShift, Math.min(s + 10, 85), Math.max(25, Math.min(70, l + lightnessShift)));
}

/**
 * Get an array of preset color options derived from a base client color.
 */
export function getProjectColorOptions(baseColor: string, count: number = 6): string[] {
  return Array.from({ length: count }, (_, i) => generateProjectColor(baseColor, i));
}

/**
 * Soften a hex color for light-background themes.
 * Caps saturation and raises minimum lightness so colors appear pastel.
 */
export function softenColor(hex: string): string {
  const [h, s, l] = hexToHSL(hex);
  return hslToHex(h, Math.min(s, 50), Math.max(l, 55));
}

import { useTheme } from '../contexts/ThemeContext';

/**
 * Returns a helper that adapts a raw hex color for the active theme.
 * In light / ash-soft themes colors are softened; dark themes return the original.
 */
export function useThemedColor() {
  const { theme } = useTheme();
  const isLight = theme === 'light' || theme === 'ash-soft';
  return (color: string | undefined, fallback = '#598392'): string => {
    const hex = color || fallback;
    return isLight ? softenColor(hex) : hex;
  };
}
