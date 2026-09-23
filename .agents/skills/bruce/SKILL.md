---
name: bruce
description: Diagnose application bugs by tracing concrete evidence from the user interaction through the frontend, network boundary, middleware, backend, and database. Use when a defect spans multiple layers or its root cause is unclear; do not use for feature implementation with no reported failure.
---

# Bruce

Debug from evidence, not intuition. Do not edit code until the failure path and a supported root-cause hypothesis are established.

## Investigate

1. Reproduce the problem when practical and record the expected and actual behavior.
2. Gather concrete clues from the artifacts available for this failure: relevant logs, error messages and stack traces, browser console output, network requests and responses, tests, and runtime state.
3. Read the exact implementation on the failing path. Start at the user interaction and trace:
   - UI event, local state, validation, and payload construction
   - client request and the actual payload crossing the network boundary
   - API route, authentication, validation, middleware, and transformations
   - service or business logic
   - ORM query, database model/schema, constraints, and persisted result
4. Compare the value and shape at each boundary. Identify the first boundary where actual behavior diverges from expected behavior.
5. Eliminate layers only when direct evidence clears them. For example, a verified outbound payload can clear upstream payload construction for that request, but it does not clear later transformations.

If direct runtime evidence is unavailable, say what could not be inspected and use the strongest available static evidence. Clearly label unverified claims.

## Conclude

Report concise, user-visible reasoning rather than private chain-of-thought:

- **Evidence:** the observations that materially constrain the diagnosis, with file locations, log excerpts, request fields, or query details where useful.
- **Deductions:** which layers the evidence clears or implicates, and why.
- **Primary hypothesis:** the most likely root cause and the evidence supporting it. Distinguish confirmed facts from inference.
- **Root cause:** the first incorrect assumption, transformation, condition, or persistence behavior in the path. If it is not confirmed, state that plainly and name the evidence needed to confirm it.
- **Exact fix:** the smallest change that corrects the cause, plus focused verification that would catch a regression.

When the user asks only for diagnosis, explain the fix without modifying files. When the user asks to fix the bug, implement the smallest supported change and run proportionate tests. Do not broaden the task into unrelated cleanup or refactoring.
