<p align="center"><img src="assets/punto-readme.svg" alt="Punto" width="96" height="96" /></p>

# Punto

**A tray-first Pomodoro for Windows.** Start a focus block, close the window, and keep working. No browser tab to babysit, no account, no sync noise.

If you live in IDEs, docs, and spreadsheets all day, Punto stays out of the way until you need it: one glance at the tray tells you **idle (white dot)**, **focus (green)**, or **break (blue)**.

---

## Who it’s for

- **Developers and makers** who want a native timer that respects deep work and doesn’t hijack the taskbar.
- **Knowledge workers on Windows** who already use the tray for tools they trust, and want Pomodoro to behave the same way.
- **Anyone allergic to “another dashboard”**: presets, stats, and settings exist when you open them; the default mode is *quiet*.

---

## Why Punto (instead of a web timer or heavy app)

| You want… | Punto |
|-----------|--------|
| State at a glance | Tray icon color shows phase without opening a window |
| Fast preset starts | Right‑click tray → pick a preset or use the dashboard |
| Motivation, not nagging | Short Windows toasts + daily stats (minutes, sessions, streak) |
| Your data, your machine | Everything under `%AppData%\Punto\` as JSON (local only) |

---

## What you get

- **Presets**: custom focus/break lengths, **repeat cycles**, optional **auto-start** of the next focus after break.
- **Statistics**: sessions today, focus minutes today, streak, weekly totals (updates as you complete focus blocks).
- **Tray-first UX**: left‑click opens the dashboard; right‑click has **Settings…**, presets, and timer controls.
- **Built with Tauri 2**: small footprint, native notifications, real Windows integration.

---

## Install

1. Download `Punto_<version>_x64_en-US.msi` from [Releases](https://github.com/YOUR_ORG/focusdot/releases) (replace `YOUR_ORG` after you publish).
2. Run the installer. Punto starts in the tray only; look for the circle icon.
3. Optional: **Settings…** in the tray menu → *Launch on Windows startup*.

---

## Build from source

Requires [Node.js](https://nodejs.org/) 20+, [Rust](https://rustup.rs/) stable, and [Tauri 2 Windows prerequisites](https://v2.tauri.app/start/prerequisites/) (WebView2, MSVC Build Tools).

```powershell
npm install
npm run build:installer
```

The MSI is written to `src-tauri\target\release\bundle\msi\`.

---

## Develop

```powershell
npm install
npm run tauri dev
```

---

## Test

```powershell
npm test                 # Vitest + cargo test
npm run typecheck        # TypeScript
npm run build            # Production frontend (via build:prod)
npm run test:frontend    # Vitest only
npm run test:rust        # Rust tests only
```

---

## Repo layout

| Path | Role |
|------|------|
| `src/` | Vite + TypeScript dashboard |
| `src-tauri/` | Rust: timer, tray, notifications, persistence |
| `assets/` | Brand assets for docs (e.g. README badge) |

---

## License

MIT (add a `LICENSE` file in the repo root when you publish).
