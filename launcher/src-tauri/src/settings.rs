use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use sysinfo::System;
use tauri::{AppHandle, Manager, State};

use crate::AppState;

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct Settings {
    pub ram_gb: f32,
    pub window: WindowSettings,
    pub java: JavaSettings,
    pub jvm_args: String,
    pub after_launch: AfterLaunch,
    pub console: bool,
    pub game_dir: PathBuf,
    pub auto_join: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct WindowSettings {
    pub mode: WindowMode,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct JavaSettings {
    pub mode: JavaMode,
    pub path: PathBuf,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum WindowMode {
    #[default]
    Window,
    Fullscreen,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum JavaMode {
    #[default]
    Auto,
    Custom,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum AfterLaunch {
    Close,
    #[default]
    Hide,
    Keep,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            ram_gb: 4.0,
            window: WindowSettings::default(),
            java: JavaSettings::default(),
            jvm_args: String::new(),
            after_launch: AfterLaunch::default(),
            console: false,
            game_dir: std::env::var_os("APPDATA")
                .map(PathBuf::from)
                .unwrap_or_default()
                .join(".agon-launcher"),
            auto_join: false,
        }
    }
}

impl Default for WindowSettings {
    fn default() -> Self {
        Self {
            mode: WindowMode::default(),
            width: 1280,
            height: 720,
            maximized: false,
        }
    }
}

pub fn load(app: &AppHandle) -> Settings {
    app.path()
        .app_data_dir()
        .ok()
        .and_then(|dir| std::fs::read(dir.join("settings.json")).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), String> {
    write(&app, &settings).map_err(|e| e.to_string())?;
    *state.settings.lock().unwrap() = settings;
    Ok(())
}

#[tauri::command]
pub fn system_memory() -> f32 {
    let mut system = System::new();
    system.refresh_memory();
    system.total_memory() as f32 / (1024.0 * 1024.0 * 1024.0)
}

fn write(app: &AppHandle, settings: &Settings) -> anyhow::Result<()> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    std::fs::write(dir.join("settings.json"), serde_json::to_vec_pretty(settings)?)?;
    Ok(())
}
