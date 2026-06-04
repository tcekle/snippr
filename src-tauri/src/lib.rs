
mod clipboard_watcher;
mod commands;
mod export;
mod scrolling_capture;
mod settings;
mod snip_filter;
mod state;
mod tray;

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
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState::default())
        .setup(|app| {
            tray::build(app)?;
            clipboard_watcher::spawn(app.handle().clone());
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
            commands::load_image_file,
            scrolling_capture::begin_scrolling_selection,
            scrolling_capture::cancel_scrolling_selection,
            scrolling_capture::start_scrolling_capture,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
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
