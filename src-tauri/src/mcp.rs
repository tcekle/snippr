//! Minimal MCP (Model Context Protocol) server over stdio.
//!
//! Speaks newline-delimited JSON-RPC 2.0 on stdin/stdout (the MCP stdio
//! transport) so an MCP client (Claude, etc.) can call snippr directly. Two
//! tools:
//!   * `snippr_describe_scene`  → the scene JSON Schema (in-process).
//!   * `snippr_generate_image`  → render a scene onto an image; returns the PNG.
//!
//! `generate` boots a WebView and hard-exits the process, so it can't run inside
//! this long-lived server — each call spawns `snippr generate` as a subprocess of
//! the current exe. The subprocess's stdout/stderr are piped (never inherited), so
//! only protocol JSON ever reaches our stdout.

use std::io::{BufRead, Write};
use std::process::Stdio;

use base64::Engine;
use serde_json::{json, Value};

/// MCP protocol revision we advertise when the client doesn't pin one.
const PROTOCOL_VERSION: &str = "2024-11-05";

pub fn run_mcp() {
    eprintln!("snippr mcp: ready (stdio)");
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break, // stdin closed
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let req: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("snippr mcp: ignoring bad JSON-RPC line: {e}");
                continue;
            }
        };
        if let Some(resp) = handle(&req) {
            if let Ok(s) = serde_json::to_string(&resp) {
                let _ = writeln!(stdout, "{s}");
                let _ = stdout.flush();
            }
        }
    }
}

/// Returns `Some(response)` for requests (those carrying an `id`), `None` for
/// notifications (which expect no reply).
fn handle(req: &Value) -> Option<Value> {
    let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");

    // No id → notification (e.g. notifications/initialized); nothing to send back.
    let id = req.get("id").cloned()?;

    let resp = match method {
        "initialize" => {
            let pv = req
                .get("params")
                .and_then(|p| p.get("protocolVersion"))
                .and_then(|v| v.as_str())
                .unwrap_or(PROTOCOL_VERSION);
            ok(
                id,
                json!({
                    "protocolVersion": pv,
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "snippr", "version": env!("CARGO_PKG_VERSION") }
                }),
            )
        }
        "ping" => ok(id, json!({})),
        "tools/list" => ok(id, json!({ "tools": tools() })),
        "tools/call" => handle_tool_call(id, req.get("params")),
        other => err(id, -32601, &format!("method not found: {other}")),
    };
    Some(resp)
}

fn ok(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn err(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

/// The tool catalog. `snippr_generate_image` nests the full scene schema as its
/// `scene` argument, so a client sees exactly what to produce.
fn tools() -> Value {
    let mut scene_schema: Value = serde_json::from_str(crate::cli::SCENE_SCHEMA).unwrap_or(json!({}));
    if let Some(obj) = scene_schema.as_object_mut() {
        obj.remove("$schema");
        obj.remove("$id");
    }
    json!([
        {
            "name": "snippr_describe_scene",
            "description": "Return the JSON Schema for snippr annotation scenes (annotation types, fields, coordinate rules). All coordinates are base-image pixels, origin top-left; colors are CSS hex. Read this before building a scene for snippr_generate_image.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "snippr_generate_image",
            "description": "Render an annotation scene onto an image and write a PNG, returning the rendered image so you can verify placement and self-correct. Build `scene` per snippr_describe_scene.",
            "inputSchema": {
                "type": "object",
                "required": ["input", "scene", "output"],
                "properties": {
                    "input": { "type": "string", "description": "Path to the base image to annotate (PNG/JPEG/...)." },
                    "output": { "type": "string", "description": "Path to write the rendered PNG." },
                    "editable": { "type": "boolean", "description": "Embed the editable scene so the PNG reopens in snippr. Default false." },
                    "scene": scene_schema
                }
            }
        }
    ])
}

fn handle_tool_call(id: Value, params: Option<&Value>) -> Value {
    let name = params
        .and_then(|p| p.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let args = params
        .and_then(|p| p.get("arguments"))
        .cloned()
        .unwrap_or_else(|| json!({}));

    match name {
        "snippr_describe_scene" => ok(
            id,
            json!({
                "content": [ { "type": "text", "text": crate::cli::SCENE_SCHEMA } ],
                "isError": false
            }),
        ),
        "snippr_generate_image" => match run_generate_tool(&args) {
            Ok((path, png)) => {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
                ok(
                    id,
                    json!({
                        "content": [
                            { "type": "text", "text": format!("Rendered {path}") },
                            { "type": "image", "data": b64, "mimeType": "image/png" }
                        ],
                        "isError": false
                    }),
                )
            }
            // Tool-level failure: report via isError, not a JSON-RPC error, so the
            // model sees the message and can retry with a corrected scene.
            Err(e) => ok(
                id,
                json!({
                    "content": [ { "type": "text", "text": format!("snippr generate failed: {e}") } ],
                    "isError": true
                }),
            ),
        },
        other => err(id, -32602, &format!("unknown tool: {other}")),
    }
}

/// Run `snippr generate` as a subprocess of the current exe, feeding the scene on
/// stdin. Returns (printed output path, rendered PNG bytes).
fn run_generate_tool(args: &Value) -> Result<(String, Vec<u8>), String> {
    let input = args
        .get("input")
        .and_then(|v| v.as_str())
        .ok_or("missing string argument 'input'")?;
    let output = args
        .get("output")
        .and_then(|v| v.as_str())
        .ok_or("missing string argument 'output'")?;
    let editable = args.get("editable").and_then(|v| v.as_bool()).unwrap_or(false);
    let scene = args.get("scene").ok_or("missing 'scene' object")?;
    let scene_str = serde_json::to_string(scene).map_err(|e| format!("serialize scene: {e}"))?;

    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    let mut cmd = std::process::Command::new(exe);
    cmd.arg("generate")
        .arg("--input")
        .arg(input)
        .arg("--scene")
        .arg("-")
        .arg("--output")
        .arg(output);
    if editable {
        cmd.arg("--editable");
    }
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("spawn generate: {e}"))?;
    {
        let mut child_stdin = child.stdin.take().ok_or("child stdin unavailable")?;
        child_stdin
            .write_all(scene_str.as_bytes())
            .map_err(|e| format!("write scene to child: {e}"))?;
        // child_stdin dropped here → EOF so `generate` stops reading stdin.
    }
    let out = child
        .wait_with_output()
        .map_err(|e| format!("wait for generate: {e}"))?;

    if !out.status.success() {
        let msg = String::from_utf8_lossy(&out.stderr);
        let msg = msg.trim();
        return Err(if msg.is_empty() {
            format!("generate exited with {:?}", out.status.code())
        } else {
            msg.to_string()
        });
    }

    let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let png = std::fs::read(output).map_err(|e| format!("read output {output}: {e}"))?;
    Ok((path, png))
}
