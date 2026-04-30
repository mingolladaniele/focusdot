<p align="center"><img src="assets/readme-hero.svg" alt="focusdot: idle (white), Focus (green), break (blue)" width="264" /></p>

# focusdot

**Repository:** [github.com/mingolladaniele/focusdot](https://github.com/mingolladaniele/focusdot)

**A tray-first Pomodoro for Windows.** Start a focus block, close the window, and keep working. No browser tab to babysit, no account, no sync noise.

The logo above is the tray dot in three phases: **idle (white)**, **Focus (green)**, **break (blue)**.

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

## Releases

Installers are published on **[GitHub Releases](https://github.com/mingolladaniele/focusdot/releases)**.

1. Open the [latest release](https://github.com/mingolladaniele/focusdot/releases/latest).
2. Download **`focusdot_<version>_x64_en-US.msi`** (Windows x64).
3. Run the MSI. focusdot starts in the tray only; look for the circle icon.
4. Optional: **Settings…** in the tray menu → *Launch on Windows startup*.

Source code for each release is tagged on the same page.

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

**MIT.** See [`LICENSE`](LICENSE) for the full text.

---

<details>
<summary>Migrating old data</summary>

If you used an older build that stored data under `%AppData%\Punto\`, current installs use **`%AppData%\FocusDot\`**. Copy your `history.json` / `presets.json` / `settings.json` manually if you need to migrate.

</details>
