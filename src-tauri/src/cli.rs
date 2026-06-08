//! `snippr` command-line front-end.
//!
//! snippr's renderer is Konva running in the WebView, not Rust — so the CLI does
//! not re-implement drawing. Instead `generate` boots a hidden Tauri window that
//! loads the real frontend (`index.html?cli=render`), hands it the job, and the
//! frontend renders with the exact same pipeline as the app, then a command
//! writes the PNG and exits the process. Zero rendering drift.
//!
//! clap gives the System.CommandLine-style surface: declarative subcommands,
//! typed options with help text, auto `--help`/`--version`, and shell completion.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering::SeqCst};
use std::time::Duration;

use clap::{CommandFactory, Parser, Subcommand};
use tauri::webview::WebviewWindowBuilder;
use tauri::{Manager, WebviewUrl};

use crate::commands;

const SCENE_SCHEMA: &str = include_str!("../resources/scene-schema.json");
const SCENE_NOTES: &str = include_str!("../resources/scene-notes.md");

// ── clap surface ─────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(
    name = "snippr",
    bin_name = "snippr",
    version,
    about = "Annotate images from JSON scenes — feed a scene + image, get a PNG.",
    long_about = "snippr CLI: apply a JSON annotation scene onto an image and render it \
                  with the same engine as the snippr app.\n\n\
                  Run `snippr describe` to learn the scene format, then \
                  `snippr generate --input shot.png --scene scene.json --output out.png`."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Print the scene JSON format: annotation types, fields, and coordinate rules.
    Describe {
        /// Emit only the raw JSON Schema (machine-readable; pipe to a file or a tool).
        #[arg(long)]
        json: bool,
    },
    /// Render a scene onto an input image and write a PNG.
    Generate {
        /// Base image to annotate (PNG/JPEG/...).
        #[arg(short, long, value_name = "FILE")]
        input: PathBuf,
        /// Scene JSON file, or "-" to read the scene from stdin.
        #[arg(short, long, value_name = "FILE")]
        scene: String,
        /// Output PNG path.
        #[arg(short, long, value_name = "FILE")]
        output: PathBuf,
        /// Embed the editable scene so the PNG reopens as a snippr workspace.
        #[arg(long)]
        editable: bool,
    },
    /// Print a shell-completion script (bash, zsh, fish, powershell, elvish).
    Completions {
        /// Target shell.
        #[arg(value_enum)]
        shell: clap_complete::Shell,
    },
}

/// argv[1] values that mean "run as a CLI" rather than launch the tray app.
const CLI_TOKENS: &[&str] = &[
    "describe",
    "generate",
    "completions",
    "help",
    "-h",
    "--help",
    "-V",
    "--version",
];

/// True when the process was started as a CLI (a known subcommand or help/version
/// flag). A bare launch or a file-association open (argv[1] = a path) returns false
/// so the normal tray app runs.
pub fn is_cli_invocation() -> bool {
    match std::env::args_os().nth(1) {
        Some(a) => CLI_TOKENS.contains(&a.to_string_lossy().as_ref()),
        None => false,
    }
}

// ── entry ────────────────────────────────────────────────────────────────────

/// Run the CLI to completion. For `generate` this never returns — the headless
/// render app exits the process via `AppHandle::exit` (its code becomes ours).
pub fn run_cli() {
    attach_console();
    let cli = Cli::parse(); // clap handles --help/--version/parse errors + exit codes

    match cli.command {
        Commands::Describe { json } => {
            if json {
                println!("{SCENE_SCHEMA}");
            } else {
                print!("{SCENE_NOTES}");
            }
        }
        Commands::Completions { shell } => {
            let mut cmd = Cli::command();
            let name = cmd.get_name().to_string();
            clap_complete::generate(shell, &mut cmd, name, &mut std::io::stdout());
        }
        Commands::Generate {
            input,
            scene,
            output,
            editable,
        } => {
            if let Err(e) = run_generate(input, scene, output, editable) {
                eprintln!("snippr: {e}");
                std::process::exit(1);
            }
        }
    }
}

/// On Windows the binary is `windows_subsystem = "windows"` (no console), so wire
/// stdout/stderr to the launching terminal. No-op if there's no parent console.
#[cfg(windows)]
fn attach_console() {
    use windows::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    unsafe {
        let _ = AttachConsole(ATTACH_PARENT_PROCESS);
    }
}
#[cfg(not(windows))]
fn attach_console() {}

// ── generate ───────────────────────────────────────────────────────────────-

fn run_generate(
    input: PathBuf,
    scene: String,
    output: PathBuf,
    editable: bool,
) -> Result<(), String> {
    let input_bytes =
        std::fs::read(&input).map_err(|e| format!("read input {}: {e}", input.display()))?;

    let scene_json = if scene == "-" {
        use std::io::Read;
        let mut s = String::new();
        std::io::stdin()
            .read_to_string(&mut s)
            .map_err(|e| format!("read scene from stdin: {e}"))?;
        s
    } else {
        std::fs::read_to_string(&scene).map_err(|e| format!("read scene {scene}: {e}"))?
    };

    // Fail early with a clear message rather than a silent frontend parse error.
    serde_json::from_str::<serde_json::Value>(&scene_json)
        .map_err(|e| format!("scene is not valid JSON: {e}"))?;

    // Resolve before the webview (its CWD may differ).
    let output = std::path::absolute(&output).unwrap_or(output);

    run_render_app(CliJob {
        input: input_bytes,
        scene_json,
        editable,
        output,
    });

    // run_render_app runs the OS event loop and exits the process from a command;
    // reaching here means the render window closed without producing output.
    Err("render window closed before producing output".into())
}

// ── headless render harness ──────────────────────────────────────────────────

/// The render job handed to the frontend via `cli_*` commands.
pub struct CliJob {
    pub input: Vec<u8>,
    pub scene_json: String,
    pub editable: bool,
    pub output: PathBuf,
}

#[derive(Default)]
pub struct CliState {
    pub job_input: Vec<u8>,
    pub job_scene: String,
    pub job_editable: bool,
    pub output: PathBuf,
    /// Set once a terminal command (write/fail/timeout) has fired, so the
    /// watchdog doesn't double-exit.
    pub done: AtomicBool,
}

/// Build a one-window, no-tray Tauri app that renders the job and exits.
fn run_render_app(job: CliJob) {
    let mut ctx = tauri::generate_context!();
    // Suppress the tray editor window declared in tauri.conf.json — we make our
    // own hidden render window instead.
    ctx.config_mut().app.windows.clear();

    let state = CliState {
        job_input: job.input,
        job_scene: job.scene_json,
        job_editable: job.editable,
        output: job.output,
        done: AtomicBool::new(false),
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::cli_get_job,
            commands::cli_get_input_image,
            commands::cli_write_output,
            commands::cli_fail,
        ])
        .setup(|app| {
            // Watchdog: never hang an automated invocation.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(30));
                let st = handle.state::<CliState>();
                if !st.done.swap(true, SeqCst) {
                    eprintln!("snippr: render timed out after 30s");
                    handle.exit(2);
                }
            });

            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html?cli=render".into()),
            )
            .visible(false)
            .skip_taskbar(true)
            .build()?;
            Ok(())
        })
        .build(ctx)
        .expect("error building snippr render app")
        .run(|_app, _event| {});
}
