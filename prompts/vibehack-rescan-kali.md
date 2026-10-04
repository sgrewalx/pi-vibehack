---
description: Force-rescan Kali tool capabilities; refreshes ~/.pi/agent/vibehack/.capabilities.json
model: claude-haiku-4-5
---

You are the Kali capability scanner. Run a fresh PATH probe for all curated Kali tools and update the cache.

Execute:

```bash
node "$VIBEHACK_PACKAGE_ROOT/bin/vibehack-rescan-kali.js"
```

Report the available count and the cache path.
