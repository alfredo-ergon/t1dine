import { describe, expect, it } from "vitest";

import { ApiError } from "../src/api";
import { glucoseSyncErrorKey } from "../src/glucose";

describe("glucoseSyncErrorKey", () => {
  it("maps a connectivity failure (network/timeout) to the offline message", () => {
    expect(glucoseSyncErrorKey(new ApiError("network", "unreachable"))).toBe("glucose.syncErrorOffline");
    expect(glucoseSyncErrorKey(new ApiError("timeout", "timed out"))).toBe("glucose.syncErrorOffline");
  });

  it("maps a bad request body (e.g. missing/invalid url) to the invalid-connection message", () => {
    expect(glucoseSyncErrorKey(new ApiError("http", "bad request", 400, "invalid_body"))).toBe("glucose.syncErrorInvalidConnection");
  });

  it("maps every upstream Nightscout failure code to the same upstream message", () => {
    expect(glucoseSyncErrorKey(new ApiError("http", "bad gateway", 502, "upstream_unreachable"))).toBe("glucose.syncErrorUpstream");
    expect(glucoseSyncErrorKey(new ApiError("http", "bad gateway", 502, "upstream_error"))).toBe("glucose.syncErrorUpstream");
    expect(glucoseSyncErrorKey(new ApiError("http", "bad gateway", 502, "upstream_malformed"))).toBe("glucose.syncErrorUpstream");
  });

  it("falls back to a generic message for an unrecognised or non-ApiError failure", () => {
    expect(glucoseSyncErrorKey(new ApiError("invalid_response", "unexpected shape"))).toBe("glucose.syncErrorGeneric");
    expect(glucoseSyncErrorKey(new Error("something else"))).toBe("glucose.syncErrorGeneric");
    expect(glucoseSyncErrorKey("not even an Error")).toBe("glucose.syncErrorGeneric");
  });
});
