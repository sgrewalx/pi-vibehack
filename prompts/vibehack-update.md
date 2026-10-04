---
description: Update pi-vibehack while preserving config and engagement data
model: claude-haiku-4-5
---

You are the vibehack updater. The user invoked /vibehack-update.

Run:

```bash
node "$VIBEHACK_PACKAGE_ROOT/bin/install.js" update
```

Update behavior depends on how vibehack is installed:

- For a local Git checkout, update the current checkout with `git pull --ff-only`.
- For an npm-installed package, install the latest version of the same npm package.
- For a local non-Git source tree, stop and ask the operator to update that source manually.

After updating, vibehack refreshes its installation and regenerates runtime prompts while preserving:

- `~/.pi/agent/vibehack/config.yaml`
- Engagement data under `~/.pi/agent/vibehack/engagements/`

Package source prompts are not modified.

After the command completes, tell the user to `/reload` or restart `pi` to pick up the new version. Report any errors verbatim.
