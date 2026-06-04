//! Identify whether the current clipboard contents came from the Windows
//! Snipping Tool by resolving the clipboard owner window's process name.

use windows::core::PWSTR;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::DataExchange::GetClipboardOwner;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

/// Full path of the exe owning the clipboard, if resolvable.
/// Must be called promptly after WM_CLIPBOARDUPDATE — the owner HWND is short-lived.
pub fn clipboard_owner_exe() -> Option<String> {
    unsafe {
        let hwnd = GetClipboardOwner().ok()?;
        if hwnd.is_invalid() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = vec![0u16; 1024];
        let mut len = buf.len() as u32;
        let res = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len);
        let _ = CloseHandle(handle);
        res.ok()?;
        Some(String::from_utf16_lossy(&buf[..len as usize]))
    }
}

/// Win11: Win+Shift+S quick snip = ScreenClippingHost.exe, full app = SnippingTool.exe,
/// legacy = ScreenSketch.exe. Compare filename component only — UWP paths embed versions.
pub fn is_snip_process(path: &str) -> bool {
    let name = path
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(path)
        .to_ascii_lowercase();
    matches!(
        name.as_str(),
        "screenclippinghost.exe" | "snippingtool.exe" | "screensketch.exe"
    )
}
