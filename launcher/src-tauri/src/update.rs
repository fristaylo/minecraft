use serde::Serialize;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

use crate::api::CmdError;

#[derive(Serialize)]
pub struct UpdateInfo {
    version: String,
    notes: Option<String>,
}

#[derive(Clone, Serialize)]
struct UpdateProgress {
    done: u64,
    total: Option<u64>,
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, CmdError> {
    Ok(app.updater()?.check().await?.map(|update| UpdateInfo {
        version: update.version,
        notes: update.body,
    }))
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), CmdError> {
    let Some(update) = app.updater()?.check().await? else {
        return Ok(());
    };
    let mut done = 0;
    let mut last = Instant::now();
    update
        .download_and_install(
            |chunk, total| {
                done += chunk as u64;
                if last.elapsed() >= Duration::from_millis(100) {
                    last = Instant::now();
                    let _ = app.emit("updater://progress", UpdateProgress { done, total });
                }
            },
            || {},
        )
        .await?;
    Ok(())
}
