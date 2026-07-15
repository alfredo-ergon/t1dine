import { describe, expect, it } from "vitest";
import { calculateDoseEstimate, type DoseEstimateInput, type DoseEstimateResult } from "@t1dine/dose-engine";

// Default profile mirrors the configured example:
//   I:C ratio      1 unit / 50 g carbohydrate   (carbGramsPerUnit = 50)
//   correction     1 unit / 50 mg/dL            (glucosePerCorrectionUnit = 50)
//   target         100 mg/dL
//   hypo guard     70 mg/dL, half-unit pen, 30 u ceiling, 0 active insulin
function baseInput(overrides: Partial<DoseEstimateInput> = {}): DoseEstimateInput {
  return {
    confirmedCarbohydrateGrams: 0,
    glucoseValue: 100,
    glucoseUnit: "mg/dL",
    glucoseMeasuredAt: "2026-07-15T08:00:00.000Z",
    calculatedAt: "2026-07-15T08:00:00.000Z",
    targetGlucose: 100,
    carbGramsPerUnit: 50,
    glucosePerCorrectionUnit: 50,
    activeInsulinUnits: 0,
    administrationIncrementUnits: 0.5,
    maximumEstimateUnits: 30,
    minimumGlucoseToDose: 70,
    profileVersion: "profile-test-1",
    ...overrides,
  };
}

function estimate(result: DoseEstimateResult) {
  if (result.status !== "estimate") throw new Error(`expected estimate, got blocked: ${result.status === "blocked" ? result.reasons.join(",") : ""}`);
  return result;
}

describe("carbohydrate insulin (HC ÷ 50)", () => {
  it.each([
    [50, 1],
    [100, 2],
    [150, 3],
    [200, 4],
    [250, 5],
    [300, 6],
  ])("%i g carbs at target glucose → %i units", (carbs, units) => {
    const r = estimate(calculateDoseEstimate(baseInput({ confirmedCarbohydrateGrams: carbs })));
    expect(r.mealComponentUnits).toBeCloseTo(units, 6);
    expect(r.correctionComponentUnits).toBe(0);
    expect(r.roundedUnits).toBeCloseTo(units, 6);
  });
});

describe("glucose correction ((glicemia - 100) ÷ 50)", () => {
  it.each([
    [150, 1],
    [200, 2],
    [250, 3],
    [300, 4],
    [350, 5],
  ])("glucose %i → +%i correction units", (glucose, units) => {
    const r = estimate(calculateDoseEstimate(baseInput({ glucoseValue: glucose })));
    expect(r.correctionComponentUnits).toBeCloseTo(units, 6);
    expect(r.roundedUnits).toBeCloseTo(units, 6);
  });
});

describe("full worked example from the annex", () => {
  it("211.8 g HC + glucose 215 → 6.5 u on a half-unit pen", () => {
    const r = estimate(calculateDoseEstimate(baseInput({ confirmedCarbohydrateGrams: 211.8, glucoseValue: 215 })));
    expect(r.mealComponentUnits).toBeCloseTo(4.236, 3);
    expect(r.correctionComponentUnits).toBeCloseTo(2.3, 6);
    expect(r.unroundedUnits).toBeCloseTo(6.536, 3);
    expect(r.roundedUnits).toBe(6.5);
  });

  it("same example → 7 u on a whole-unit pen", () => {
    const r = estimate(
      calculateDoseEstimate(baseInput({ confirmedCarbohydrateGrams: 211.8, glucoseValue: 215, administrationIncrementUnits: 1 })),
    );
    expect(r.roundedUnits).toBe(7);
  });
});

describe("active insulin is subtracted and never silently assumed", () => {
  it("subtracts active insulin from the total", () => {
    const r = estimate(calculateDoseEstimate(baseInput({ confirmedCarbohydrateGrams: 200, glucoseValue: 200, activeInsulinUnits: 1.5 })));
    // meal 4 + correction 2 - 1.5 = 4.5
    expect(r.unroundedUnits).toBeCloseTo(4.5, 6);
  });

  it("fails closed when active insulin is unknown (null)", () => {
    const r = calculateDoseEstimate(baseInput({ activeInsulinUnits: null }));
    expect(r.status).toBe("blocked");
    if (r.status === "blocked") expect(r.reasons).toContain("active-insulin-unknown-or-invalid");
  });
});

describe("safety: fail closed", () => {
  it("blocks at or below the hypo threshold (treat the low first)", () => {
    for (const g of [70, 65, 40]) {
      const r = calculateDoseEstimate(baseInput({ glucoseValue: g, confirmedCarbohydrateGrams: 100 }));
      expect(r.status).toBe("blocked");
      if (r.status === "blocked") expect(r.reasons).toContain("glucose-below-safe-threshold");
    }
  });

  it("blocks an implausible glucose value", () => {
    const r = calculateDoseEstimate(baseInput({ glucoseValue: 700 }));
    expect(r.status).toBe("blocked");
    if (r.status === "blocked") expect(r.reasons).toContain("glucose-out-of-plausible-range");
  });

  it("blocks an implausible carbohydrate amount", () => {
    const r = calculateDoseEstimate(baseInput({ confirmedCarbohydrateGrams: 100000 }));
    expect(r.status).toBe("blocked");
    if (r.status === "blocked") expect(r.reasons).toContain("carbohydrate-implausible");
  });

  it("blocks a future-dated glucose reading", () => {
    const r = calculateDoseEstimate(baseInput({ glucoseMeasuredAt: "2026-07-15T09:00:00.000Z", calculatedAt: "2026-07-15T08:00:00.000Z" }));
    expect(r.status).toBe("blocked");
    if (r.status === "blocked") expect(r.reasons).toContain("glucose-timestamp-in-future");
  });

  it("blocks a missing profile version", () => {
    const r = calculateDoseEstimate(baseInput({ profileVersion: "  " }));
    expect(r.status).toBe("blocked");
    if (r.status === "blocked") expect(r.reasons).toContain("missing-profile-version");
  });

  it("blocks a negative total (would suggest no or negative insulin)", () => {
    const r = calculateDoseEstimate(baseInput({ confirmedCarbohydrateGrams: 0, glucoseValue: 100, activeInsulinUnits: 5 }));
    expect(r.status).toBe("blocked");
    if (r.status === "blocked") expect(r.reasons).toContain("calculated-value-below-zero");
  });

  it("re-asserts the maximum AFTER rounding", () => {
    const r = calculateDoseEstimate(baseInput({ confirmedCarbohydrateGrams: 400, glucoseValue: 500, maximumEstimateUnits: 10 }));
    expect(r.status).toBe("blocked");
    if (r.status === "blocked") expect(r.reasons).toContain("calculated-value-exceeds-maximum");
  });
});

describe("edge + unit handling", () => {
  it("allows a valid zero-unit result (nothing to dose)", () => {
    const r = estimate(calculateDoseEstimate(baseInput({ confirmedCarbohydrateGrams: 0, glucoseValue: 100, activeInsulinUnits: 0 })));
    expect(r.roundedUnits).toBe(0);
  });

  it("supports mmol/L with a consistent basis", () => {
    const r = estimate(
      calculateDoseEstimate(
        baseInput({ glucoseUnit: "mmol/L", glucoseValue: 12, targetGlucose: 6, glucosePerCorrectionUnit: 3, minimumGlucoseToDose: 3.9 }),
      ),
    );
    expect(r.correctionComponentUnits).toBeCloseTo(2, 6);
  });

  it("is deterministic and carries the unreleased algorithm version", () => {
    const input = baseInput({ confirmedCarbohydrateGrams: 123, glucoseValue: 180 });
    const a = calculateDoseEstimate(input);
    const b = calculateDoseEstimate(input);
    expect(a).toEqual(b);
    expect(a.algorithmVersion).toMatch(/^unreleased-/);
  });
});
