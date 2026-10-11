# Changelog

All notable changes to focusdot are documented here. Releases follow [Semantic Versioning](https://semver.org/).

## [0.1.5] - 2026-10-11

### Added

- **Start without setup**: on first launch a **Pomodoro** preset (25 min focus / 5 min break) is created, so a timer can start right away.
- **One-button timer card**: a single primary button changes with the state, always in the same place: **Start <last preset>**, **Pause** / **Resume**, **Start focus now** (or **End break** on the last break), **Finish focus** in overtime. A small **Stop** link appears only where it means something different.
- **Preset chips**: when idle, every other preset is a one-click chip under the timer, plus **+ New preset**.
- **Quick start in the tray**: the first tray entry starts the last preset you used. The tray menu shows one primary action per state.
- **Live tray tooltip**: shows minutes left, current cycle and paused state, e.g. `focusdot · Focus · 12 min left · 2/4 · paused`.
- Multi-cycle sessions show the current cycle (`Focus session · 2 of 4`).
- `FOCUSDOT_DATA_DIR` environment variable to run focusdot on a throwaway profile for testing.

### Changed

- **Compact statistics**: today's focus, sessions and day streak on one line; week, month and year in one row underneath. Totals of 10 hours or more drop the minutes (`61h`).
- **Reset** history moved into Settings (**Focus history**). Reset and deleting a preset need a second click within 3 seconds.
- **Presets** section renamed **Manage presets** (edit and delete); starting a preset happens from the chips or the tray.
- Breaks can no longer be paused. Skipping a break does what the end of the break would do, so a single-cycle preset with auto-start keeps repeating.
- New preset form is prefilled with 25 / 5.
- Statistics reload when the dashboard window regains focus.

### Fixed

- Day streak no longer shows 0 in the morning before the first session of the day.
- Timer no longer drifts over long sessions and keeps counting while Windows is suspended.

## [0.1.4] - 2026-06-12

### Added

- **This month** stat tile — total focus minutes in the current calendar month (local timezone).
- **This year** stat tile — total focus minutes in the current calendar year (local timezone).
- Backend fields `focusMinutesThisMonth` and `focusMinutesThisYear` on `get_stats` (no new API).

### Changed

- Statistics card uses a **3×2 grid** (six tiles): sessions today, focus today, streak; then week, month, year.
- Shared `statPeriodMinutesValue()` formatter for week/month/year display (`Xh Ym`).

## [0.1.3] - 2026-06-12

### Added

- **Overtime tracking** (optional): after focus hits 0:00, keep counting in an overtime phase until Stop; full session is logged and break starts.
- Collapsible **Settings** and **Presets** sections (collapsed by default).
- Statistics card moved directly below the timer.

### Changed

- Renamed **App** section to **Settings**; tray menu entry **Settings & dashboard**.
- Settings window scrolls and resizes; overtime toggle applies to an active focus session.

## [0.1.2] - 2026-05-02

Earlier release — preset and dashboard improvements.

## [0.1.1] - 2026-05-01

Earlier release — stability and UI fixes.

## [0.1.0] - 2026-04-30

Initial public release — system tray Pomodoro timer with presets, stats, and local history.

[0.1.5]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.5
[0.1.4]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.4
[0.1.3]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.3
[0.1.2]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.2
[0.1.1]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.1
[0.1.0]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.0
