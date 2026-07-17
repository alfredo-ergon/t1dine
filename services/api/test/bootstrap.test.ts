// Unit tests for `../src/bootstrap.ts` — the DB fail-closed-in-prod
// behaviour (security review M5) and the demo-admin prod guard (C3).
// `server.ts` itself is never imported here (it opens a real socket at
// module load — see its header); everything below is fully offline, with
// the real Postgres attempt replaced by an injected fake.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureDemoAdmin, inMemoryRepositories, resolveRepositories } from "../src/bootstrap.js";
import { InMemoryMealRepository } from "../src/repositories/inMemoryMealRepository.js";
import { InMemoryUserRepository } from "../src/repositories/inMemoryUserRepository.js";
import { DEFAULT_ADMIN_PASSWORD } from "../src/prodGate.js";

describe("resolveRepositories", () => {
  it("returns in-memory repositories when DATABASE_URL is unset", async () => {
    const repositories = await resolveRepositories({});
    expect(repositories.mealRepository).toBeInstanceOf(InMemoryMealRepository);
  });

  it("returns the Postgres attempt's result when it succeeds", async () => {
    const fakeRepositories = inMemoryRepositories(); // stand-in return value, not real Postgres
    const attemptPostgres = vi.fn(async () => fakeRepositories);

    const repositories = await resolveRepositories(
      { DATABASE_URL: "postgres://fake-host/fake-db" },
      { attemptPostgres },
    );

    expect(attemptPostgres).toHaveBeenCalledWith("postgres://fake-host/fake-db");
    expect(repositories).toBe(fakeRepositories);
  });

  describe("when the Postgres attempt fails", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("falls back to in-memory storage in dev (unchanged legacy behaviour)", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const attemptPostgres = vi.fn(async () => {
        throw new Error("connection refused");
      });

      const repositories = await resolveRepositories(
        { DATABASE_URL: "postgres://fake-host/fake-db", NODE_ENV: "development" },
        { attemptPostgres },
      );

      expect(repositories.mealRepository).toBeInstanceOf(InMemoryMealRepository);
      errorSpy.mockRestore();
    });

    it("exits the process non-zero in production instead of falling back (M5)", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const attemptPostgres = vi.fn(async () => {
        throw new Error("connection refused");
      });

      await expect(
        resolveRepositories(
          { DATABASE_URL: "postgres://fake-host/fake-db", NODE_ENV: "production" },
          { attemptPostgres },
        ),
      ).rejects.toThrow();

      expect(exitSpy).toHaveBeenCalledWith(1);
      errorSpy.mockRestore();
    });

    it("never logs the caught error itself (may embed a connection string/credentials)", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const attemptPostgres = vi.fn(async () => {
        throw new Error("postgres://user:supersecretpassword@host/db connection failed");
      });

      await resolveRepositories(
        { DATABASE_URL: "postgres://fake-host/fake-db", NODE_ENV: "development" },
        { attemptPostgres },
      );

      const loggedText = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
      expect(loggedText).not.toContain("supersecretpassword");
    });
  });
});

describe("ensureDemoAdmin", () => {
  it("creates the demo admin in dev when ADMIN_PASSWORD is unset (existing dev behaviour)", async () => {
    const userRepository = new InMemoryUserRepository();
    await ensureDemoAdmin(userRepository, ["admin@t1dine.local"], { NODE_ENV: "development" });

    const created = await userRepository.findByEmail("admin@t1dine.local");
    expect(created).not.toBeNull();
  });

  it("does nothing when an admin account already exists, regardless of env", async () => {
    const userRepository = new InMemoryUserRepository();
    await userRepository.create({ email: "admin@t1dine.local", passwordHash: "hash", salt: "salt" });

    await ensureDemoAdmin(userRepository, ["admin@t1dine.local"], { NODE_ENV: "production", ADMIN_PASSWORD: "" });

    // No throw, and still exactly the original account (not overwritten).
    const existing = await userRepository.findByEmail("admin@t1dine.local");
    expect(existing?.passwordHash).toBe("hash");
  });

  it("refuses to seed a demo admin in production when ADMIN_PASSWORD is unset (C3)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const userRepository = new InMemoryUserRepository();

    await ensureDemoAdmin(userRepository, ["admin@t1dine.local"], { NODE_ENV: "production" });

    expect(await userRepository.findByEmail("admin@t1dine.local")).toBeNull();
    errorSpy.mockRestore();
  });

  it("refuses to seed a demo admin in production when ADMIN_PASSWORD is still the dev default (C3)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const userRepository = new InMemoryUserRepository();

    await ensureDemoAdmin(userRepository, ["admin@t1dine.local"], {
      NODE_ENV: "production",
      ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD,
    });

    expect(await userRepository.findByEmail("admin@t1dine.local")).toBeNull();
    errorSpy.mockRestore();
  });

  it("seeds a demo admin in production when ADMIN_PASSWORD is a non-default value", async () => {
    const userRepository = new InMemoryUserRepository();

    await ensureDemoAdmin(userRepository, ["admin@t1dine.local"], {
      NODE_ENV: "production",
      ADMIN_PASSWORD: "a-strong-non-default-password",
    });

    expect(await userRepository.findByEmail("admin@t1dine.local")).not.toBeNull();
  });
});
