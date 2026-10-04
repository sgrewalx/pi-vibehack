---
description: Start a new vibehack engagement against the given target
model: claude-haiku-4-5, claude-sonnet-4-6
thinking: minimal
skill: planner-recipes
restore: true
---

You are starting a new engagement against target: $@

Authorized testing only. The operator has confirmed scope. Proceed:

1. Call `vibehack_expand` with `parent_id: null`, `kind: "root"`, `claim: "engagement: $@"`, `falsifier: "n/a"`.
2. Expand the root into top-level attack surfaces: web, subdomains, API, email, and third-party. For EVERY one of these nodes, use `kind: "surface"`; put the surface name in `claim`/`rationale`, never in `kind`. Give each a sharp falsifier.
3. Pick the highest-confidence-gain surface and add one child using `kind: "hypothesis"` with a concrete `next_test` and `falsifier`.
4. The only valid `kind` values are `"root"`, `"surface"`, `"hypothesis"`, and `"leaf"`. Do not use `"web"`, `"subdomain"`, `"api"`, `"email"`, or `"third_party"` as `kind`.
5. Stop after the first hypothesis. The operator will steer next.
