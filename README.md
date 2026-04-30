**App icon:** add `docs/assets/icon.png` (128×128) and uncomment the image block below when ready.

<!--
<p align="center"><img src="docs/assets/icon.png" alt="Punto" width="96" height="96" /></p>
-->

# Punto

Minimalist Windows Pomodoro timer in the system tray. The tray icon is a small circle: **white** when idle, **green** during focus, **blue** on break.

- **Presets** with focus/break minutes, **repeat cycles**, and optional **auto-start** of the next focus after each break.
- **Native toasts** with short motivational copy and your daily stats (focus minutes today, sessions, streak).
- **Statistics** in the dashboard: sessions today, focus minutes today, streak days, weekly minutes.
- **Tray-first**: left-click opens the dashboard; right-click has **Settings…** plus timer controls.
- **Local-only** data under `%AppData%\Punto\` (JSON). No accounts or cloud.

## Install

1. Download `Punto_<version>_x64_en-US.msi` from [Releases](https://github.com/YOUR_ORG/focusdot/releases) (update URL after publishing).
2. Run the installer. Punto starts in the tray only — look for the circle icon.
3. Optional: open **Settings…** from the tray menu → enable *Launch on Windows startup*.

## Build from source

Requires [Node.js](https://nodejs.org/) 20+, [Rust](https://rustup.rs/) stable, and [Tauri 2 Windows prerequisites](https://v2.tauri.app/start/prerequisites/) (WebView2, MSVC Build Tools).

```powershell
npm install
npm run build:installer
```

The MSI is written to `src-tauri\target\release\bundle\msi\`.

## Develop

```powershell
npm install
npm run tauri dev
```

## Test

```powershell
npm test                 # Vitest + cargo test
npm run typecheck        # TypeScript
npm run build            # Production frontend bundle
npm run test:frontend    # Vitest only
npm run test:rust        # Rust tests only
```

## Repo layout

| Path | Role |
|------|------|
| `src/` | Vite + TypeScript dashboard |
| `src-tauri/` | Rust: timer, tray, notifications, persistence |
| `docs/` | Specs and implementation plans |

## License

MIT (add a `LICENSE` file in the repo root when you publish).
