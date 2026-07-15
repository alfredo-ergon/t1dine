# ADR 0003: Isolate the Dose Engine

Status: Accepted as a safety constraint

Dose logic is a pure deterministic package with no network, AI, persistence, analytics, or UI dependencies. Every calculation carries an algorithm version and explicit input record. Release is governed separately from T1Dine Core.
