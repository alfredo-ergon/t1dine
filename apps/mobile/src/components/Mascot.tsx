import { SvgXml } from "react-native-svg";
import { mascotSvg } from "@t1dine/design-tokens";

export interface MascotProps {
  /** Width and height in density-independent pixels. Defaults to a small, inline-friendly size. */
  size?: number;
  /** Single-colour silhouette fill (e.g. for a dark header) instead of the full-colour gradient artwork. */
  mono?: string;
}

// Single reusable wrapper around the shared "Tino" mascot SVG so every screen
// renders the same artwork consistently (splash, empty states, header).
// Decorative by default — accessibilityElementsHidden / importantForAccessibility
// keep it out of the screen-reader traversal order since the surrounding text
// already carries the meaning (e.g. an empty-state title placed next to it).
export function Mascot({ size = 96, mono }: MascotProps) {
  const xml = mascotSvg({ mono });
  return (
    <SvgXml
      xml={xml}
      width={size}
      height={size}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
