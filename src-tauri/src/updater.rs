//! GitHub-backed auto-update.
//!
//! Checks the published `latest.json` and, when a newer *signed* release exists,
//! prompts the user (notify + one-click), then downloads, installs, and relaunches.
//! Driven entirely from Rust so the hidden tray/editor window never has to be
//! surfaced just to offer an update. The signature is verified against the public
//! key baked into `tauri.conf.json`; an unsigned or mis-signed artifact is rejected.

use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

/// Check for an update on a background task.
///
/// `manual` distinguishes the tray-invoked check (report "up to date" and errors)
/// from the silent launch check (`false` — stay quiet unless an update is actually
/// available, so autostart never nags with dialogs it doesn't need to).
pub fn check(app: AppHandle, manual: bool) {
    tauri::async_runtime::spawn(async move {
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                notify(&app, manual, MessageDialogKind::Error, format!("Updater unavailable: {e}"));
                return;
            }
        };

        match updater.check().await {
            Ok(Some(update)) => prompt_and_install(app, update),
            Ok(None) => notify(&app, manual, MessageDialogKind::Info, "snippr is up to date.".into()),
            Err(e) => notify(&app, manual, MessageDialogKind::Error, format!("Update check failed: {e}")),
        }
    });
}

/// Offer the update; on confirmation download + install, then relaunch into it.
fn prompt_and_install(app: AppHandle, update: tauri_plugin_updater::Update) {
    let ver = update.version.clone();
    let cur = update.current_version.clone();
    let app2 = app.clone();
    app.dialog()
        .message(format!("snippr {ver} is available (you have {cur}).\n\nDownload and install now? snippr will restart."))
        .title("Update available")
        .buttons(MessageDialogButtons::OkCancelCustom("Update now".into(), "Later".into()))
        .show(move |accepted| {
            if !accepted {
                return;
            }
            tauri::async_runtime::spawn(async move {
                match update.download_and_install(|_, _| {}, || {}).await {
                    // On Windows the NSIS installer relaunches us; restart() is the
                    // documented belt-and-suspenders for the other targets.
                    Ok(_) => app2.restart(),
                    Err(e) => notify(&app2, true, MessageDialogKind::Error, format!("Update failed: {e}")),
                }
            });
        });
}

/// Show a native dialog only when `show` is set (manual checks / hard errors).
fn notify(app: &AppHandle, show: bool, kind: MessageDialogKind, msg: String) {
    if !show {
        return;
    }
    app.dialog().message(msg).title("snippr").kind(kind).show(|_| {});
}
