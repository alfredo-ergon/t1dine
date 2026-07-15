import type { ChipVariant } from "../../lib/i18n";

/**
 * A status/confidence/quality chip. Colour is always accompanied by the text
 * `label`, so meaning is never conveyed by colour alone (WCAG 1.4.1).
 */
export function Chip({ variant, label }: { variant: ChipVariant; label: string }): JSX.Element {
  return <span className={`chip chip--${variant}`}>{label}</span>;
}
