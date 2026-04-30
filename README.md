<p align="center"><img src="assets/readme-hero.svg" alt="focusdot" width="264" /></p>

# focusdot

Tray-first Pomodoro for Windows. Start a focus block, close the window, and keep working. No browser tab to babysit, no account, no sync.

## See it in action

[Watch the focusdot demo on YouTube](https://youtu.be/ObeQnt2jrzQ)

---

## Who it’s for

- **Developers and makers** who want a native timer that respects deep work and does not hijack the taskbar.
- **Knowledge workers on Windows** who already use the tray for tools they trust and want Pomodoro to behave the same way.
- **Anyone allergic to “another dashboard”**: presets, stats, and settings are there when you open them; the default mode is quiet.

---

## Why focusdot (instead of a web timer or heavy app)

| You want… | focusdot |
|-----------|----------|
| State at a glance | Tray icon color shows phase without opening a window |
| Fast preset starts | Right-click tray: pick a preset or use the dashboard |
| Motivation, not nagging | Short Windows toasts plus daily stats (minutes, sessions, streak) |
| Your data, your machine | Everything under `%AppData%\FocusDot\` as JSON (local only) |

---

## What you get

- **Presets**: custom focus/break lengths, repeat cycles, optional auto-start of the next focus after break.
- **Statistics**: sessions today, focus minutes today, streak, weekly totals (updates as you complete focus blocks).
- **Tray-first UX**: left-click opens the dashboard; right-click has Settings, presets, and timer controls.
- **Built with Tauri 2**: small footprint, native notifications, real Windows integration.

---

## Install

1. Open **[Releases](https://github.com/mingolladaniele/focusdot/releases)** — all versions live at `https://github.com/mingolladaniele/focusdot/releases`. For the newest installer only, use **[Latest release](https://github.com/mingolladaniele/focusdot/releases/latest)**.
2. Download **`focusdot_<version>_x64_en-US.msi`** (Windows x64).
3. Run the MSI. focusdot starts in the tray only; look for the circle icon.
4. Optional: **Settings** in the tray menu, then *Launch on Windows startup*.

---

## Developers

Requires [Node.js](https://nodejs.org/) 20+, [Rust](https://rustup.rs/) stable, and [Tauri 2 Windows prerequisites](https://v2.tauri.app/start/prerequisites/) (WebView2, MSVC Build Tools).

| Goal | Command |
|------|---------|
| Dev server | `npm install` then `npm run tauri dev` |
| Production + MSI | `npm run build` (alias: `npm run build:installer`) → MSI under `src-tauri\target\release\bundle\msi\`; frontend is built by Tauri `beforeBuildCommand` (`npm run build:prod`) |
| Production frontend only | `npm run build:prod` → `dist/` |
| Tests | `npm test` (Vitest + `cargo test`). Also: `npm run typecheck`, `npm run test:frontend`, `npm run test:rust` |

`src/` is the Vite + TypeScript dashboard; `src-tauri/` is Rust (timer, tray, notifications, persistence). Bundled icon sources live in `assets/`.

---

## License

**MIT.** See [`LICENSE`](LICENSE) for the full text.
