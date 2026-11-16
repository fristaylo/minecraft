use anyhow::{bail, Result};
use futures_util::future::try_join;
use serde::{Deserialize, Deserializer, Serialize};
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio_util::sync::CancellationToken;
#[cfg(windows)]
use windows_sys::core::BOOL;
#[cfg(windows)]
use windows_sys::Win32::Foundation::{HWND, LPARAM};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowThreadProcessId, IsWindowVisible,
};

use crate::download::Ctx;
#[cfg(windows)]
use crate::loader::CREATE_NO_WINDOW;
use crate::loader::LoaderKind;
use crate::settings::{AfterLaunch, Settings, WindowMode};
use crate::{authlib, java, loader, minecraft, AppState};

#[cfg(windows)]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
const CLASSPATH_SEPARATOR: &str = if cfg!(windows) { ";" } else { ":" };
const WINDOW_POLL: Duration = Duration::from_millis(500);
const WINDOW_TIMEOUT: Duration = Duration::from_secs(180);
const DEFAULT_JVM_FLAGS: [&str; 8] = [
    "-XX:+UseG1GC",
    "-XX:+UnlockExperimentalVMOptions",
    "-XX:G1NewSizePercent=20",
    "-XX:G1ReservePercent=20",
    "-XX:MaxGCPauseMillis=50",
    "-XX:G1HeapRegionSize=32M",
    "-XX:+ParallelRefProcEnabled",
    "-XX:+DisableExplicitGC",
];

#[derive(Deserialize)]
pub struct Instance {
    pub id: String,
    pub minecraft: String,
    pub loader: Loader,
    pub java_major: Option<u32>,
    pub server: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Loader {
    #[serde(rename = "type")]
    pub kind: LoaderKind,
    #[serde(default, deserialize_with = "null_as_default")]
    pub version: String,
}

#[derive(Deserialize)]
pub struct Auth {
    pub name: String,
    pub uuid: String,
    pub access_token: String,
}

#[derive(Clone, Serialize)]
struct Exited {
    code: Option<i32>,
}

struct Prepared {
    java: PathBuf,
    args: Vec<String>,
    game_dir: PathBuf,
}

#[tauri::command]
pub async fn launch(
    app: AppHandle,
    state: State<'_, AppState>,
    instance: Instance,
    auth: Auth,
) -> Result<(), String> {
    let stop = CancellationToken::new();
    {
        let mut running = state.game_stop.lock().unwrap();
        if running.is_some() {
            return Err("game is already running".to_owned());
        }
        *running = Some(stop.clone());
    }
    let settings = state.settings.lock().unwrap().clone();
    let ctx = Ctx::new(&app, &state);
    let prepared = match prepare(&ctx, &settings, &instance, &auth).await {
        Ok(prepared) => prepared,
        Err(e) => {
            state.game_stop.lock().unwrap().take();
            return Err(format!("{e:#}"));
        }
    };
    ctx.progress("game", "Открываем Minecraft…", 0, 0);
    if let Err(e) = spawn(app, &settings, prepared, stop, ctx.cancel).await {
        state.game_stop.lock().unwrap().take();
        return Err(format!("{e:#}"));
    }
    Ok(())
}

#[tauri::command]
pub fn stop_game(state: State<'_, AppState>) {
    if let Some(stop) = &*state.game_stop.lock().unwrap() {
        stop.cancel();
    }
}

async fn prepare(
    ctx: &Ctx,
    settings: &Settings,
    instance: &Instance,
    auth: &Auth,
) -> Result<Prepared> {
    let ((version, java, assets_index), mut args) = try_join(
        prepare_game(ctx, settings, instance),
        authlib::jvm_args(ctx),
    )
    .await?;

    let game_dir = ctx.root.join("instances").join(&instance.id);
    tokio::fs::create_dir_all(&game_dir).await?;
    let assets_root = ctx.root.join("assets").display().to_string();
    let classpath = minecraft::classpath(ctx, &version)
        .iter()
        .map(|p| p.display().to_string())
        .collect::<Vec<_>>()
        .join(CLASSPATH_SEPARATOR);
    let vars = [
        ("auth_player_name", auth.name.clone()),
        ("version_name", version.id.clone()),
        ("game_directory", game_dir.display().to_string()),
        ("assets_root", assets_root.clone()),
        ("game_assets", assets_root),
        ("assets_index_name", assets_index),
        ("auth_uuid", auth.uuid.clone()),
        ("auth_access_token", auth.access_token.clone()),
        (
            "auth_session",
            format!("token:{}:{}", auth.access_token, auth.uuid),
        ),
        ("clientid", String::new()),
        ("auth_xuid", String::new()),
        ("user_type", "mojang".to_owned()),
        ("version_type", "release".to_owned()),
        ("user_properties", "{}".to_owned()),
        (
            "natives_directory",
            minecraft::natives_dir(ctx, &version).display().to_string(),
        ),
        ("launcher_name", "launcher".to_owned()),
        ("launcher_version", env!("CARGO_PKG_VERSION").to_owned()),
        ("classpath", classpath),
        ("classpath_separator", CLASSPATH_SEPARATOR.to_owned()),
        (
            "library_directory",
            ctx.root.join("libraries").display().to_string(),
        ),
    ];

    let (jvm, game) = match &version.arguments {
        Some(a) => (minecraft::expand(&a.jvm), minecraft::expand(&a.game)),
        None => {
            let mut jvm = vec![
                "-Djava.library.path=${natives_directory}".to_owned(),
                "-cp".to_owned(),
                "${classpath}".to_owned(),
            ];
            if cfg!(target_os = "macos") {
                jvm.push("-XstartOnFirstThread".to_owned());
            }
            (
                jvm,
                version
                    .minecraft_arguments
                    .as_deref()
                    .unwrap_or_default()
                    .split_whitespace()
                    .map(str::to_owned)
                    .collect(),
            )
        }
    };
    let xmx = (settings.ram_gb * 1024.0) as u32;
    args.push(format!("-Xmx{xmx}M"));
    args.push(format!("-Xms{}M", xmx / 2));
    args.extend(DEFAULT_JVM_FLAGS.iter().map(|f| (*f).to_owned()));
    args.extend(settings.jvm_args.split_whitespace().map(str::to_owned));
    if let Some(server) = &instance.server {
        args.push(format!("-Dagon.server={server}"));
    }
    args.extend(jvm.iter().map(|a| fill(a, &vars)));
    args.push(version.main_class.clone());
    args.extend(game.iter().map(|a| fill(a, &vars)));
    let fullscreen = matches!(settings.window.mode, WindowMode::Fullscreen);
    write_options(&game_dir, fullscreen).await?;
    if !fullscreen {
        args.extend([
            "--width".to_owned(),
            settings.window.width.to_string(),
            "--height".to_owned(),
            settings.window.height.to_string(),
        ]);
    }
    if let Some(server) = instance.server.as_ref().filter(|_| settings.auto_join) {
        args.push("--quickPlayMultiplayer".to_owned());
        args.push(if server.contains(':') {
            server.clone()
        } else {
            format!("{server}:25565")
        });
    }
    Ok(Prepared {
        java,
        args,
        game_dir,
    })
}

async fn prepare_game(
    ctx: &Ctx,
    settings: &Settings,
    instance: &Instance,
) -> Result<(minecraft::VersionJson, PathBuf, String)> {
    let vanilla = minecraft::vanilla(ctx, &instance.minecraft).await?;
    let version = match instance.loader.kind.meta_dir() {
        Some(dir) => {
            if instance.loader.version.is_empty() {
                bail!("loader version is not set");
            }
            let profile =
                loader::profile(ctx, dir, &instance.minecraft, &instance.loader.version).await?;
            minecraft::merge(vanilla, profile)
        }
        None => vanilla,
    };
    let major = version
        .java_version
        .as_ref()
        .map_or(8, |j| j.major_version)
        .max(instance.java_major.unwrap_or(0));
    let java = java::resolve(ctx, settings, major).await?;
    minecraft::install(ctx, &version).await?;
    let assets_index = minecraft::install_assets(ctx, &version).await?;
    loader::run_processors(ctx, &version, &instance.minecraft, &java).await?;
    Ok((version, java, assets_index))
}

async fn spawn(
    app: AppHandle,
    settings: &Settings,
    prepared: Prepared,
    stop: CancellationToken,
    cancel: CancellationToken,
) -> Result<()> {
    #[cfg(windows)]
    let exe = prepared.java.with_file_name(if settings.console {
        "java.exe"
    } else {
        "javaw.exe"
    });
    #[cfg(not(windows))]
    let exe = &prepared.java;
    let mut command = tokio::process::Command::new(exe);
    command.args(&prepared.args).current_dir(&prepared.game_dir);
    #[cfg(windows)]
    command.creation_flags(if settings.console {
        CREATE_NEW_CONSOLE
    } else {
        CREATE_NO_WINDOW
    });
    let mut child = command.spawn()?;
    wait_window(&mut child, &stop, &cancel).await?;
    let _ = app.emit("game://started", ());
    let hide = settings.after_launch == AfterLaunch::Hide;
    match settings.after_launch {
        AfterLaunch::Close => {
            app.exit(0);
            return Ok(());
        }
        AfterLaunch::Hide => set_window_visible(&app, false),
        AfterLaunch::Keep => {}
    }
    tauri::async_runtime::spawn(async move {
        let code = tokio::select! {
            status = child.wait() => status.ok().and_then(|s| s.code()),
            _ = stop.cancelled() => {
                let _ = child.kill().await;
                None
            }
        };
        app.state::<AppState>().game_stop.lock().unwrap().take();
        if hide {
            set_window_visible(&app, true);
        }
        let _ = app.emit("game://exited", Exited { code });
    });
    Ok(())
}

async fn wait_window(
    child: &mut tokio::process::Child,
    stop: &CancellationToken,
    cancel: &CancellationToken,
) -> Result<()> {
    let pid = child.id().unwrap_or_default();
    let deadline = tokio::time::Instant::now() + WINDOW_TIMEOUT;
    while tokio::time::Instant::now() < deadline {
        if let Some(status) = child.try_wait()? {
            let code = status
                .code()
                .map_or_else(|| "?".to_owned(), |c| c.to_string());
            bail!("Игра завершилась до открытия окна (код {code})");
        }
        if has_visible_window(pid) {
            return Ok(());
        }
        tokio::select! {
            () = tokio::time::sleep(WINDOW_POLL) => {}
            () = stop.cancelled() => {
                let _ = child.kill().await;
                bail!("cancelled");
            }
            () = cancel.cancelled() => {
                let _ = child.kill().await;
                bail!("cancelled");
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
fn has_visible_window(pid: u32) -> bool {
    struct Search {
        pid: u32,
        found: bool,
    }
    unsafe extern "system" fn visit(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam as *mut Search);
        let mut owner = 0;
        GetWindowThreadProcessId(hwnd, &mut owner);
        if owner == search.pid && IsWindowVisible(hwnd) != 0 {
            search.found = true;
            return 0;
        }
        1
    }
    let mut search = Search { pid, found: false };
    unsafe { EnumWindows(Some(visit), &mut search as *mut Search as LPARAM) };
    search.found
}

#[cfg(target_os = "macos")]
fn has_visible_window(pid: u32) -> bool {
    use core_graphics::window::{
        copy_window_info, kCGNullWindowID, kCGWindowListExcludeDesktopElements,
        kCGWindowListOptionOnScreenOnly,
    };
    copy_window_info(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    )
    .is_some_and(|windows| {
        windows
            .iter()
            .any(|window| is_game_window(*window, pid).unwrap_or(false))
    })
}

#[cfg(target_os = "macos")]
fn is_game_window(window: *const std::ffi::c_void, pid: u32) -> Option<bool> {
    use core_foundation::{base::TCFType, dictionary::CFDictionary, string::CFString};
    use core_graphics::window::{kCGWindowBounds, kCGWindowLayer, kCGWindowOwnerPID};
    use std::ffi::c_void;

    type Dict = CFDictionary<*const c_void, *const c_void>;
    let window = unsafe { Dict::wrap_under_get_rule(window as _) };
    let (owner, layer, bounds) = unsafe {
        (
            number(&window, kCGWindowOwnerPID as _)?,
            number(&window, kCGWindowLayer as _)?,
            Dict::wrap_under_get_rule(*window.find(kCGWindowBounds as *const c_void)? as _),
        )
    };
    let width = number(&bounds, CFString::new("Width").as_concrete_TypeRef() as _)?;
    let height = number(&bounds, CFString::new("Height").as_concrete_TypeRef() as _)?;
    Some(owner as u32 == pid && layer == 0.0 && width > 1.0 && height > 1.0)
}

#[cfg(target_os = "macos")]
fn number(
    dict: &core_foundation::dictionary::CFDictionary<
        *const std::ffi::c_void,
        *const std::ffi::c_void,
    >,
    key: *const std::ffi::c_void,
) -> Option<f64> {
    use core_foundation::{base::TCFType, number::CFNumber};
    let value = dict.find(key)?;
    unsafe { CFNumber::wrap_under_get_rule(*value as _) }.to_f64()
}

fn set_window_visible(app: &AppHandle, visible: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = if visible {
            window.show().and_then(|()| window.set_focus())
        } else {
            window.hide()
        };
    }
}

fn fill(template: &str, vars: &[(&str, String)]) -> String {
    vars.iter().fold(template.to_owned(), |acc, (key, value)| {
        acc.replace(&format!("${{{key}}}"), value)
    })
}

fn null_as_default<'de, D: Deserializer<'de>>(deserializer: D) -> Result<String, D::Error> {
    Ok(Option::<String>::deserialize(deserializer)?.unwrap_or_default())
}

async fn write_options(game_dir: &Path, fullscreen: bool) -> Result<()> {
    let path = game_dir.join("options.txt");
    let line = format!("fullscreen:{fullscreen}");
    let existing = match tokio::fs::read_to_string(&path).await {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(e.into()),
    };
    let mut found = false;
    let mut lines: Vec<String> = existing
        .lines()
        .map(|l| {
            if l.starts_with("fullscreen:") {
                found = true;
                line.clone()
            } else {
                with_compat_pack(l).unwrap_or_else(|| l.to_owned())
            }
        })
        .collect();
    if !found {
        lines.push(line);
    }
    tokio::fs::write(&path, lines.join("\n") + "\n").await?;
    Ok(())
}

fn with_compat_pack(line: &str) -> Option<String> {
    const COMPAT_PACK: &str = "vanillabackport:freshly_animated_legacy";
    let mut packs: Vec<String> =
        serde_json::from_str(line.strip_prefix("resourcePacks:")?).ok()?;
    packs.retain(|p| p != COMPAT_PACK);
    let fresh = packs
        .iter()
        .position(|p| p.starts_with("file/") && p.contains("FreshAnimations"))?;
    packs.insert(fresh + 1, COMPAT_PACK.to_owned());
    Some(format!("resourcePacks:{}", serde_json::to_string(&packs).ok()?))
}
