# Changelog

All notable changes to focusdot are documented here. Releases follow [Semantic Versioning](https://semver.org/).

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

[0.1.4]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.4
[0.1.3]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.3
[0.1.2]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.2
[0.1.1]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.1
[0.1.0]: https://github.com/mingolladaniele/focusdot/releases/tag/v0.1.0
