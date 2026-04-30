Software Requirements Specification (SRS)

Project: Punto - Minimalist System Tray Pomodoro Timer

1. Overview

Punto is an ultra-minimalist, lightweight Pomodoro timer designed for Windows. It operates exclusively from the system tray (notification area) with "zero-UI" during normal operation. Its primary goal is to help the user maintain focus without visual distractions, while tracking progress to provide motivation through statistics.

2. Core Features

System Tray Operation: The app runs entirely in the background. Interaction is handled via right-clicking the system tray icon to access a context menu.

Custom Presets: Users can save and trigger custom timer presets (e.g., Focus: 25m / Break: 5m, or Focus: 55m / Break: 5m). There is no hard limit to the number of presets.

Native Notifications: When a timer finishes, the app triggers a standard Windows OS toast notification. No custom intrusive pop-ups are used.

Minimalist State Indication: The system tray icon subtly changes (e.g., color change or a tiny badge) to indicate whether a Focus session or a Break session is currently active.

3. Data & Statistics (Motivation System)

History Tracking: The app records every completed focus session (date, time, duration).

Weekly & Daily Stats: The app calculates and displays statistics (e.g., total focus hours this week, sessions completed today) to motivate the user.

Data Reset: The user has the ability to completely wipe their history and reset statistics at any time.

Local Storage: All historical data is stored locally in a lightweight JSON file. No cloud syncing or account creation is required.

4. User Interface (UI)

Tray Menu (Right-Click): Contains quick actions:

Start/Pause/Stop Timer

Presets list (Click to start immediately)

View Statistics

Settings/Edit Presets

Exit

Statistics/Settings Window: A single, ultra-minimal HTML window that only opens when explicitly requested from the tray menu. It displays clean typography for stats and simple inputs for managing presets.

5. Technical Constraints

Technology Stack: Tauri (Rust backend for OS integration) + JavaScript/HTML/CSS for the minimal frontend logic.

Performance: Must consume minimal system resources (target: < 30MB RAM) and zero CPU overhead when idling.

Startup: Must support "Launch on Windows Startup" silently (directly to tray).