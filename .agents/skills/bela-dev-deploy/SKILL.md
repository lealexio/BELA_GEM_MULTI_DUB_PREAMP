---
name: bela-dev-deploy
description: >-
  Autonomous build, deploy, and error diagnostic toolchain for Bela Gem Multi.
  Use this skill whenever you write or modify C++ DSP code, hardware configurations, or GUI code
  for the Bela board. Deploys source files to Bela, builds natively with Clang++, parses any compilation
  or startup errors into actionable file/line diagnostics, and enables continuous dev-fix-deploy loops.
---

# Bela Autonomous Dev Deploy & Build Toolchain

This skill provides an automated, closed-loop development toolchain for the Bela Gem Multi board.  
It replaces manual file uploads and web IDE interactions by allowing you to deploy code, run native ARM compilation on the board, parse compiler errors directly, apply fixes, and re-deploy until the audio engine is running cleanly.

---

## The Autonomous Dev Loop (Build ➔ Diagnose ➔ Fix ➔ Re-deploy)

When modifying DSP, hardware configurations, or front-end GUI code:

```mermaid
flowchart TD
    A["Agent edits C++ / Header / GUI files"] --> B["Run deploy-and-build.mjs"]
    B --> C{"Exit code 0 ?"}
    C -- "No (Clang Error)" --> D["Read structured error (file, line, col, message)"]
    D --> E["Inspect file at indicated line & fix code"]
    E --> B
    C -- "Yes" --> F["Verify audio initialization logs & inform user"]
```

---

## Source Directory Scope: `/src` Only

> [!IMPORTANT]
> **Strict `/src` Scope:** Only files and folders located inside the `src/` directory are deployed to the Bela board (`/root/Bela/projects/<project>/`).  
> - **Transferred:** C++ source and header files (`*.cpp`, `*.h`), `render.cpp`, `config.json`, `LOGO.png`, `src/samples/` (if present), and the bundled `src/sketch.js`.
> - **Excluded from Bela:** `node_modules/`, `.git/`, `.vscode/`, `docs/`, `gui/` (ES6 source files), `scripts/`, `test/`, and `.agents/`.
> - **GUI Bundling:** Before transfer, `gui/` is bundled into `src/sketch.js` via esbuild so Bela only receives the single required frontend bundle.

---

## How to Execute Deployment

Run the helper script from the workspace root:

```powershell
node .agents/skills/bela-dev-deploy/scripts/deploy-and-build.mjs
```

### Supported Flags:
- `--force` (or `-f`): Forces a full upload of all files in `src/`, bypassing MD5 hash delta checks.
- `--json`: Outputs a machine-readable JSON object containing status, parsed compiler diagnostics, and runtime logs.
- `--build-only`: Synchronizes files and runs compilation on Bela without launching the audio engine.
- `--skip-gui`: Skips rebuilding `src/sketch.js` (useful if you only touched C++ DSP files).
- `--stop`: Stops the currently active program on the Bela board.
- `--project=<name>`: Explicitly overrides the Bela project name (by default, it auto-detects from `/root/Bela/settings.json` or uses the repository directory name).

### Incremental Delta Synchronization:
By default, the script compares MD5 hashes of local `src/` files against remote files on Bela.  
- **Only modified files** are sent via SCP.
- Unmodified files retain their remote `mtime` timestamp, allowing GNU Make to perform lightning-fast incremental builds (~1 to 2 seconds instead of ~45s).

---

## Interpreting Errors and Auto-Correcting

When compilation fails, the script outputs actionable diagnostics:

```
❌ [DEPLOY & BUILD FAILED]
Stage:   compilation
Message: Compilation failed on Bela.

Found 1 actionable diagnostic(s):
  📍 src/render.cpp:184:5 -> [error] use of undeclared identifier 'kInvalidConstant'
     > kInvalidConstant = 12;
```

### Action for the Agent:
1. Note the exact file and line number: `src/render.cpp:184`.
2. Read the surrounding lines using `read_file`.
3. Fix the syntax, missing include, or type error using `edit_file`.
4. Re-run `node .agents/skills/bela-dev-deploy/scripts/deploy-and-build.mjs`.
5. Repeat until exit code is 0.

Consult [references/troubleshooting.md](./references/troubleshooting.md) for recurring Bela / Xenomai / ARM compiler subtleties.
