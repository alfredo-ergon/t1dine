import { mascotSvg } from "@t1dine/design-tokens";

/**
 * "Tino", the T1Dine mascot, rendered inline.
 *
 * `mascotSvg` returns trusted SVG markup from our own design-tokens package
 * (a constant string — no user input), so injecting it via
 * `dangerouslySetInnerHTML` is safe. A wrapper span carries the accessible
 * name and the requested size. This is a plain (server-safe) component; it can
 * also be used inside client components.
 */
export function Mascot({
  size = 40,
  mono,
  decorative = false,
}: {
  size?: number;
  /** Single-colour silhouette (e.g. for muted/empty states). */
  mono?: string;
  /** When true, the mascot is purely decorative and hidden from assistive tech. */
  decorative?: boolean;
}): JSX.Element {
  return (
    <span
      className="mascot"
      style={{ display: "inline-flex", width: size, height: size }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Tino"}
      aria-hidden={decorative ? true : undefined}
      dangerouslySetInnerHTML={{ __html: mascotSvg({ size, mono }) }}
    />
  );
}
