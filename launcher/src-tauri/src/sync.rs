use anyhow::{anyhow, bail, Result};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::{
    collections::{HashMap, HashSet},
    io::ErrorKind,
    path::{Component, Path, PathBuf},
};
use tauri::{AppHandle, State};

use crate::api::{self, CmdError, Manifest, ManifestFile, Policy, Role, Side, BASE};
use crate::download::{Ctx, Task};
use crate::launch::{self, Auth, Instance};
use crate::{account, AppState};

const STATE_FILE: &str = ".sync.json";

#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
struct SyncState {
    version: Option<String>,
    files: HashMap<String, Installed>,
    optional: HashMap<String, bool>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Installed {
    sha1: String,
    policy: Policy,
}

struct Plan<'a> {
    downloads: Vec<&'a ManifestFile>,
    remove: Vec<PathBuf>,
    files: HashMap<String, Installed>,
}

#[derive(Serialize)]
pub struct LocalPackState {
    installed_version: Option<String>,
    version: String,
    update_bytes: u64,
    optional: HashMap<String, bool>,
}

#[tauri::command]
pub async fn play(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
) -> Result<(), CmdError> {
    let (access_token, me) = account::signed_in(&app, &state).await?;
    if me.role == Role::Pending {
        return Err(anyhow!("Your account is awaiting administrator approval").into());
    }
    let manifest = api::manifest(&state.client, &access_token, &pack_id).await?;
    sync(&Ctx::new(&app, &state), &manifest).await?;
    launch::launch(
        app,
        state,
        Instance {
            id: manifest.id,
            minecraft: manifest.minecraft,
            loader: manifest.loader,
            java_major: manifest.java,
        },
        Auth {
            name: me.name,
            uuid: me.id,
            access_token,
        },
    )
    .await
    .map_err(anyhow::Error::msg)?;
    Ok(())
}

#[tauri::command]
pub async fn set_optional(
    state: State<'_, AppState>,
    pack_id: String,
    path: String,
    enabled: bool,
) -> Result<(), CmdError> {
    let dir = instance_dir(&state, &pack_id);
    let mut sync_state = load(&dir).await;
    sync_state.optional.insert(path, enabled);
    Ok(save(&dir, &sync_state).await?)
}

#[tauri::command]
pub async fn local_pack_state(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
) -> Result<LocalPackState, CmdError> {
    let (token, _) = account::signed_in(&app, &state).await?;
    let manifest = api::manifest(&state.client, &token, &pack_id).await?;
    let dir = instance_dir(&state, &pack_id);
    let sync_state = load(&dir).await;
    let plan = plan(&dir, &manifest, &sync_state).await?;
    Ok(LocalPackState {
        installed_version: sync_state.version,
        version: manifest.version.clone(),
        update_bytes: plan.downloads.iter().map(|f| f.size).sum(),
        optional: sync_state.optional,
    })
}

async fn sync(ctx: &Ctx, manifest: &Manifest) -> Result<()> {
    let dir = ctx.root.join("instances").join(&manifest.id);
    let mut sync_state = load(&dir).await;
    let plan = plan(&dir, manifest, &sync_state).await?;
    for path in &plan.remove {
        match tokio::fs::remove_file(path).await {
            Err(e) if e.kind() != ErrorKind::NotFound => return Err(e.into()),
            _ => {}
        }
    }
    let tasks = plan
        .downloads
        .iter()
        .map(|file| {
            Ok(Task {
                url: if file.url.starts_with('/') {
                    format!("{BASE}{}", file.url)
                } else {
                    file.url.clone()
                },
                path: resolve(&dir, &file.path)?,
                sha1: Some(file.sha1.clone()),
                size: file.size,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    ctx.download("sync", &manifest.name, tasks).await?;
    sync_state.version = Some(manifest.version.clone());
    sync_state.files = plan.files;
    save(&dir, &sync_state).await
}

async fn plan<'a>(dir: &Path, manifest: &'a Manifest, state: &SyncState) -> Result<Plan<'a>> {
    let mut plan = Plan {
        downloads: Vec::new(),
        remove: Vec::new(),
        files: HashMap::new(),
    };
    for file in manifest.files.iter().filter(|f| f.side != Side::Server) {
        let target = resolve(dir, &file.path)?;
        let last = state.files.get(&file.path);
        let enabled = !file.optional
            || state
                .optional
                .get(&file.path)
                .copied()
                .unwrap_or(file.default_enabled);
        if !enabled {
            if last.is_some() {
                plan.remove.push(target);
            }
            continue;
        }
        let installed = Installed {
            sha1: file.sha1.clone(),
            policy: file.policy,
        };
        match file.policy {
            Policy::Managed => {
                let valid = if last.is_some_and(|l| l.sha1 == file.sha1) {
                    target.exists()
                } else {
                    let disk = file_sha1(&target).await;
                    let valid = disk.as_deref() == Some(file.sha1.as_str());
                    if disk.is_some() && !valid {
                        plan.remove.push(target);
                    }
                    valid
                };
                if !valid {
                    plan.downloads.push(file);
                }
                plan.files.insert(file.path.clone(), installed);
            }
            Policy::Once => {
                let disk = file_sha1(&target).await;
                let write = match (&disk, last) {
                    (None, _) => true,
                    (Some(disk), Some(last)) => *disk == last.sha1 && last.sha1 != file.sha1,
                    (Some(_), None) => false,
                };
                if write {
                    if disk.is_some() {
                        plan.remove.push(target);
                    }
                    plan.downloads.push(file);
                    plan.files.insert(file.path.clone(), installed);
                } else if let Some(last) = last {
                    plan.files.insert(file.path.clone(), last.clone());
                }
            }
        }
    }
    let listed: HashSet<&str> = manifest.files.iter().map(|f| f.path.as_str()).collect();
    for (path, installed) in &state.files {
        if installed.policy == Policy::Managed && !listed.contains(path.as_str()) {
            plan.remove.push(resolve(dir, path)?);
        }
    }
    Ok(plan)
}

fn instance_dir(state: &AppState, pack_id: &str) -> PathBuf {
    state
        .settings
        .lock()
        .unwrap()
        .game_dir
        .join("instances")
        .join(pack_id)
}

fn resolve(dir: &Path, path: &str) -> Result<PathBuf> {
    if !Path::new(path)
        .components()
        .all(|c| matches!(c, Component::Normal(_)))
    {
        bail!("invalid file path {path}");
    }
    Ok(dir.join(path))
}

async fn load(dir: &Path) -> SyncState {
    tokio::fs::read(dir.join(STATE_FILE))
        .await
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

async fn save(dir: &Path, state: &SyncState) -> Result<()> {
    tokio::fs::create_dir_all(dir).await?;
    tokio::fs::write(dir.join(STATE_FILE), serde_json::to_vec_pretty(state)?).await?;
    Ok(())
}

async fn file_sha1(path: &Path) -> Option<String> {
    let bytes = tokio::fs::read(path).await.ok()?;
    Some(format!("{:x}", Sha1::digest(&bytes)))
}
