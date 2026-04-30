<p align="center"><img src="assets/readme-hero.svg" alt="focusdot: brand dot and timer controls (Start, Pause, Stop)" width="320" /></p>

# focusdot

**A tray-first Pomodoro for Windows.** Start a focus block, close the window, and keep working. No browser tab to babysit, no account, no sync noise.

If you live in IDEs, docs, and spreadsheets all day, focusdot stays out of the way until you need it: one glance at the tray tells you **idle (white dot)**, **Focus phase (green)**, or **break (blue)**.

---

## Who it’s for

- **Developers and makers** who want a native timer that respects deep work and doesn’t hijack the taskbar.
- **Knowledge workers on Windows** who already use the tray for tools they trust, and want Pomodoro to behave the same way.
- **Anyone allergic to “another dashboard”**: presets, stats, and settings exist when you open them; the default mode is *quiet*.

---

## Why focusdot (instead of a web timer or heavy app)

| You want… | focusdot |
|-----------|--------|
| State at a glance | Tray icon color shows phase without opening a window |
| Fast preset starts | Right‑click tray → pick a preset or use the dashboard |
| Motivation, not nagging | Short Windows toasts + daily stats (minutes, sessions, streak) |
| Your data, your machine | Everything under `%AppData%\FocusDot\` as JSON (local only) |

---

## What you get

- **Presets**: custom focus/break lengths, **repeat cycles**, optional **auto-start** of the next focus after break.
- **Statistics**: sessions today, focus minutes today, streak, weekly totals (updates as you complete focus blocks).
- **Tray-first UX**: left‑click opens the dashboard; right‑click has **Settings…**, presets, and timer controls.
- **Built with Tauri 2**: small footprint, native notifications, real Windows integration.

---

## Install

1. Download `focusdot_<version>_x64_en-US.msi` from [Releases](https://github.com/mingolladaniele/focusdot/releases).
2. Run the installer. focusdot starts in the tray only; look for the circle icon.
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
| `assets/` | README graphics and source artwork for bundled icons |

---

## License

MIT (add a `LICENSE` file in the repo root when you publish).

---

<details>
<summary>About the README graphic</summary>

The row shows **Start** (white button, green play), **Pause** (blue), and **Stop** (green), matching the dashboard control colors. The green dot is a visible badge on GitHub; in the app, the tray dot is **white** when idle, **green** in a Focus session, and **blue** on break.

If you used an older build that stored data under `%AppData%\Punto\`, new installs use **`%AppData%\FocusDot\`** instead (copy JSON manually if you need to migrate).

</details>
