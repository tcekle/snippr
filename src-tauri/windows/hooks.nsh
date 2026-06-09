; snippr NSIS installer hooks.
;
; Tauri's default running-app check matches by process name and can't reliably
; kill it when more than one snippr.exe is alive (the tray app plus a
; `snippr generate` / `snippr mcp` child). That leaves the executable locked, so
; an update can't overwrite it and the app gets stuck re-offering the same
; version (tauri-apps/tauri#8223). Force-kill every snippr.exe before the file
; copy so the binary is always replaceable. The setup .exe has a different image
; name, so it survives and goes on to install and relaunch.

!macro NSIS_HOOK_PREINSTALL
  Push $0
  nsExec::Exec 'taskkill /F /IM snippr.exe'
  Pop $0
  Sleep 1000
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Push $0
  nsExec::Exec 'taskkill /F /IM snippr.exe'
  Pop $0
  Sleep 1000
  Pop $0
!macroend
