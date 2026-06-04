
//! System-tray icon, menu, and event handlers.

use std::sync::atomic::Ordering::SeqCst;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use crate::state::AppState;

pub fn build(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle();

    let open = MenuItem::with_id(handle, "open", "Open editor", true, None::<&str>)?;
    let annotate = MenuItem::with_id(handle, "annotate", "Annotate clipboard image", true, None::<&str>)?;
    let pause = CheckMenuItem::with_id(handle, "pause", "Pause watching", true, false, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(handle)?;
    let settings_item = MenuItem::with_id(handle, "settings", "Settings", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(handle)?;
    let quit = MenuItem::with_id(handle, "quit", "Quit snippr", true, None::<&str>)?;

    let menu = Menu::with_items(handle, &[
        &open,
        &annotate,
        &pause,
        &sep1,
        &settings_item,
        &sep2,
        &quit,
    ])?;

    TrayIconBuilder::with_id("snippr-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("snippr — watching for snips")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event({
            let pause_item = pause.clone();
            move |app: &AppHandle, event| {
                match event.id().as_ref() {
                    "open" => {
                        crate::show_main_window(app);
                    }
                    "annotate" => {
                        let app = app.clone();
                        std::thread::spawn(move || {
                            crate::clipboard_watcher::capture_pending(app);
                        });
                    }
                    "pause" => {
                        // CheckMenuItem auto-toggles; read the new state.
                        let paused = pause_item.is_checked().unwrap_or(false);
                        let state = app.state::<AppState>();
                        state.paused.store(paused, SeqCst);

                        let tooltip = if paused {
                            "snippr — paused"
                        } else {
                            "snippr — watching for snips"
                        };
                        if let Some(tray) = app.tray_by_id("snippr-tray") {
                            let _ = tray.set_tooltip(Some(tooltip));
                        }

                        let _ = app.emit_to("main", "watcher-state", serde_json::json!({"paused": paused}));
                    }
                    "settings" => {
                        crate::show_main_window(app);
                        let _ = app.emit_to("main", "open-settings", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}
