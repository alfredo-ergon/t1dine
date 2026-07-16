import { StyleSheet } from "react-native";
import Svg, { Defs, Rect, RadialGradient, Stop } from "react-native-svg";

import { auroraBackground } from "../theme";

// The signature "Aurora" wash — two soft radial glows (cyan top-right,
// emerald top-left) layered over the mist gradient in App.tsx. This is the
// atmospheric depth the design system is named for; without it the app reads
// as a flat vertical fade.
//
// Rendered once as a static, absolutely-positioned <Svg> (no animation, no
// state) so it costs nothing per frame even sitting behind a scrolling list.
// The glow stops/positions come straight from the shared `auroraBackground`
// token so mobile and the admin/web app stay in visual lockstep.
//
// Purely decorative — hidden from the screen-reader traversal order (same
// treatment as the Mascot), and `pointerEvents="none"` so it never intercepts
// a touch meant for the content above it.
export function AuroraBackground() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        {auroraBackground.glows.map((glow, index) => (
          <RadialGradient key={index} id={`aurora-${index}`} cx={glow.cx} cy={glow.cy} r={glow.r}>
            <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity} />
            <Stop offset="1" stopColor={glow.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {auroraBackground.glows.map((_, index) => (
        <Rect key={index} x="0" y="0" width="100%" height="100%" fill={`url(#aurora-${index})`} />
      ))}
    </Svg>
  );
}
