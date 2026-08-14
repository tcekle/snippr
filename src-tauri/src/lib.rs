
pub mod cli;
mod clipboard_watcher;
mod commands;
mod cursor;
mod mcp;
mod export;
mod gif_export;
mod palettes;
mod png_embed;
mod screen_recording;
mod scrolling_capture;
mod settings;
mod snip_filter;
mod state;
mod studio;
mod tray;
mod updater;

use state::AppState;
use tauri::Manager;

pub fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    env_logger::Builder::new()
        .filter_level(log::LevelFilter::Debug)
        .init();

    tauri::Builder::default()
        // single-instance MUST be first plugin
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .setup(|app| {
            tray::build(app)?;
            clipboard_watcher::spawn(app.handle().clone());
            // Silent check on launch — only prompts when an update is actually
            // available. Release builds only; dev shouldn't try to self-update.
            #[cfg(not(debug_assertions))]
            updater::check(app.handle().clone(), false);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_pending_image,
            commands::copy_annotated,
            commands::save_annotated,
            commands::get_settings,
            commands::set_settings,
            commands::open_save_folder,
            commands::hide_window,
            commands::read_image_file,
            palettes::list_palettes,
            palettes::save_palette,
            palettes::delete_palette,
            palettes::import_palette,
            palettes::export_palette,
            scrolling_capture::begin_snapshot_selection,
            scrolling_capture::get_selection_mode,
            scrolling_capture::cancel_scrolling_selection,
            scrolling_capture::capture_snapshot,
            screen_recording::begin_recording_selection,
            screen_recording::start_recording,
            screen_recording::stop_recording,
            screen_recording::cancel_recording,
            commands::open_video,
            studio::probe_recording,
            studio::trim_recording,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Close-to-tray applies to the MAIN editor only. Auxiliary
                // windows (overlays, recorder toolbar) must really close, or
                // they'd pile up hidden.
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error building snippr")
        .run(|_app, event| {
            // close-to-tray: keep the process alive when all windows close;
            // only app.exit() (code = Some) truly quits.
            if let tauri::RunEvent::ExitRequested { code, api, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
