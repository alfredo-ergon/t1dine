// Web-only live camera barcode scanner (Slice: barcode scanning, web).
//
// Wired into `BarcodeScanScreen.tsx`'s `isWeb` branch. Decodes retail 1D
// barcodes (EAN-13, EAN-8, UPC-A, UPC-E) straight from the device camera in
// the browser, using whichever decoder the browser actually supports:
//
//   - Chromium-family browsers (Chrome/Edge/Chromium on Android + desktop)
//     expose the native `BarcodeDetector` API — fast, no extra JS to ship,
//     used whenever it's present AND (as far as we can tell) actually
//     supports the retail formats this feature needs.
//   - Safari (iOS/desktop) and Firefox don't implement `BarcodeDetector`, so
//     this falls back to `@zxing/browser`'s `BrowserMultiFormatReader`,
//     restricted to the same four formats.
//   - Any failure along the way (no `navigator.mediaDevices`, camera denied
//     /unavailable, decoder setup throwing) calls `onUnavailable()` and
//     renders nothing — `BarcodeScanScreen` falls back to the existing
//     manual-entry form, so the user is never stuck looking at a dead
//     camera view.
//
// This component only ever calls `onDetected`/`onUnavailable` — it has no
// knowledge of the food catalog or OFF lookup (kept in `BarcodeScanScreen`'s
// `handleCode`), and it never logs a camera frame or a decoded barcode
// value beyond handing it to `onDetected`.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { CSSProperties } from "react";

import { colors } from "../theme";

export interface WebBarcodeScannerProps {
  /** Called once, with the first successfully decoded barcode value. */
  onDetected: (code: string) => void;
  /** Called when the camera/decoder cannot be used at all (no camera,
   * permission denied, unsupported browser) so the caller can fall back to
   * manual entry. */
  onUnavailable: () => void;
}

// Mirrors `BARCODE_TYPES` in BarcodeScanScreen.tsx (native's expo-camera
// list) — the retail barcodes a packaged food is realistically labelled
// with. Named per the Web `BarcodeDetector` API's own format vocabulary;
// the ZXing fallback below uses its own `BarcodeFormat` enum for the same
// four formats.
const BARCODE_DETECTOR_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

// --- Minimal ambient typing for the experimental `BarcodeDetector` Web API ---
// Chromium-only as of this writing, and not yet part of TypeScript's DOM
// lib — this declares just the surface this file calls, rather than
// reaching for `any`.
interface DetectedBarcodeLike {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcodeLike[]>;
}
interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: readonly string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

function getBarcodeDetectorConstructor(): BarcodeDetectorConstructorLike | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructorLike }).BarcodeDetector;
}

/**
 * Whether the browser's native `BarcodeDetector` both exists AND (as far as
 * it can tell) actually supports the retail 1D formats this feature needs —
 * some implementations expose the constructor but only support 2D formats
 * (e.g. QR only). Errs towards "yes" when the browser doesn't expose
 * `getSupportedFormats()` at all, since every current BarcodeDetector-
 * shipping browser also ships that method.
 */
async function barcodeDetectorSupportsRetailFormats(Ctor: BarcodeDetectorConstructorLike): Promise<boolean> {
  if (typeof Ctor.getSupportedFormats !== "function") return true;
  try {
    const supported = await Ctor.getSupportedFormats();
    return BARCODE_DETECTOR_FORMATS.some((format) => supported.includes(format));
  } catch {
    return false;
  }
}

// How often to poll `BarcodeDetector.detect()` against the live video frame.
// Fast enough to feel instant, slow enough not to peg a low-end phone's CPU.
const BARCODE_DETECTOR_POLL_MS = 200;

export function WebBarcodeScanner({ onDetected, onUnavailable }: WebBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Purely cosmetic: swaps the loading spinner for the live feed once the
  // camera stream is actually playing. Never gates decoding itself.
  const [ready, setReady] = useState(false);

  // Always call the LATEST `onDetected`/`onUnavailable` the parent passed in,
  // even though the camera-setup effect below runs exactly once (on mount)
  // and never restarts on every re-render. Without this, a stale closure
  // over an early render's callback could, e.g., look a scanned code up
  // against an outdated `foods` catalog snapshot if the parent's callback
  // identity changes while the camera is still running.
  const onDetectedRef = useRef(onDetected);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onDetectedRef.current = onDetected;
    onUnavailableRef.current = onUnavailable;
  }, [onDetected, onUnavailable]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    let zxingControls: { stop: () => void } | null = null;
    // Guards `onDetected` so it fires at most once per mount, even though
    // both decode strategies below keep polling/streaming until told to
    // stop (the parent unmounts this component on a hit, but a frame may
    // already be in flight when it does).
    let done = false;

    const fireDetected = (code: string) => {
      if (done || cancelled) return;
      done = true;
      onDetectedRef.current(code);
    };

    // Marks this run as finished and reports "can't scan here" upward.
    // Cleanup (stopping tracks/timers) still happens via the effect's
    // return function below, driven by `cancelled`.
    const fail = () => {
      if (cancelled) return;
      cancelled = true;
      onUnavailableRef.current();
    };

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        fail();
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      } catch {
        // NotAllowedError (permission denied), NotFoundError (no camera),
        // OverconstrainedError, NotReadableError, etc. — every failure here
        // falls back to manual entry rather than throwing.
        fail();
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) {
        fail();
        return;
      }

      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        fail();
        return;
      }

      if (cancelled) return;
      setReady(true);

      const DetectorCtor = getBarcodeDetectorConstructor();
      const useBarcodeDetector = DetectorCtor ? await barcodeDetectorSupportsRetailFormats(DetectorCtor) : false;
      if (cancelled) return;

      if (DetectorCtor && useBarcodeDetector) {
        const detector = new DetectorCtor({ formats: [...BARCODE_DETECTOR_FORMATS] });
        pollHandle = setInterval(() => {
          if (done || !videoRef.current) return;
          detector
            .detect(videoRef.current)
            .then((codes) => {
              if (codes.length > 0) fireDetected(codes[0].rawValue);
            })
            .catch(() => {
              // Transient decode errors (e.g. a frame that isn't ready yet)
              // are expected during continuous scanning — the next poll
              // simply tries again.
            });
        }, BARCODE_DETECTOR_POLL_MS);
        return;
      }

      // Fall back to ZXing for browsers without a usable `BarcodeDetector`
      // (Safari, Firefox, older Chromium). Lazily imported so Chromium
      // users on the fast path above never pay for this library's weight.
      try {
        const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/browser");
        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();
        reader.possibleFormats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E];

        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) fireDetected(result.getText());
        });

        if (cancelled) {
          controls.stop();
          return;
        }
        zxingControls = controls;
      } catch {
        fail();
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (pollHandle !== null) clearInterval(pollHandle);
      if (zxingControls) {
        try {
          zxingControls.stop();
        } catch {
          // Best-effort cleanup only — the stream stop below is what
          // actually turns the camera light off.
        }
      }
      // Critical: always stop every track, on every exit path, so the
      // camera is never left on after leaving this screen.
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
    // Deliberately mount-only ([]): the camera (and decoder) must start
    // exactly once and never restart just because a parent re-render
    // produced a new `onDetected`/`onUnavailable` reference — see the refs
    // above for how a fresh callback is still always used despite that.
  }, []);

  return (
    <View style={styles.wrap}>
      <video ref={videoRef} playsInline muted autoPlay style={videoStyle} aria-hidden="true" />
      {!ready && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.brandSoft} />
        </View>
      )}
    </View>
  );
}

// A plain CSS object for the raw DOM `<video>` element — react-native-web's
// `StyleSheet` targets RN-style View/Text/Image components, not arbitrary
// HTML tags, so the video element gets its layout via ordinary inline CSS.
const videoStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  backgroundColor: colors.ink,
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
