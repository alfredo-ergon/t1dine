// Native (iOS/Android) stub for `WebBarcodeScanner`.
//
// `BarcodeScanScreen.tsx` never actually reaches this component on native —
// its whole camera path there is `expo-camera`'s `CameraView` (see the
// bottom of that file). This stub exists purely so the import statement
// resolves without a bundler error on iOS/Android: Metro picks
// `WebBarcodeScanner.web.tsx` when bundling for web and falls back to this
// file (any other platform) otherwise, per its platform-specific extension
// resolution — no explicit `Platform.OS` branching needed here.
export interface WebBarcodeScannerProps {
  /** Called once, with the first successfully decoded barcode value. */
  onDetected: (code: string) => void;
  /** Called when the camera/decoder cannot be used at all (no camera,
   * permission denied, unsupported browser) so the caller can fall back to
   * manual entry. */
  onUnavailable: () => void;
}

export function WebBarcodeScanner(_props: WebBarcodeScannerProps) {
  return null;
}
