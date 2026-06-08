// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // A known subcommand / --help / --version runs the one-shot CLI; a bare
    // launch (or file-association open) starts the tray app.
    if snippr_lib::cli::is_cli_invocation() {
        snippr_lib::cli::run_cli();
    } else {
        snippr_lib::run();
    }
}
