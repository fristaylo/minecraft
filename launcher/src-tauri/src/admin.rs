use anyhow::{anyhow, bail, Result};
use futures_util::{future::try_join, stream, StreamExt};
use notify::{RecursiveMode, Watcher};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use std::{
    collections::BTreeSet,
    io::Read,
    path::{Component, Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::mpsc::UnboundedReceiver;

use crate::api::{api as endpoint, fetch, send, CmdError, Kind, Manifest, ManifestFile, Meta, Policy, Role, Side, Source};
use crate::catalog::{self, Http, Project, Target, Update, Version};
use crate::launch::Loader;
use crate::loader::LoaderKind;
use crate::{account, AppState};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackMeta {
    name: String,
    theme: Value,
    minecraft: String,
    loader_type: LoaderKind,
    loader_version: Option<String>,
    java: u32,
    server: Option<String>,
    game_server: bool,
}

#[derive(Serialize)]
pub struct Outcome {
    draft: Manifest,
    added: Vec<String>,
    incompatible: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Published {
    version: String,
    #[serde(default)]
    warnings: Vec<String>,
}

pub async fn guard(app: &AppHandle, state: &AppState) -> Result<String> {
    let (token, me) = account::signed_in(app, state).await?;
    if me.role != Role::Admin {
        bail!("Administrator rights required");
    }
    Ok(token)
}

#[tauri::command]
pub async fn admin_packs(app: AppHandle, state: State<'_, AppState>) -> Result<Value, CmdError> {
    let token = guard(&app, &state).await?;
    Ok(fetch(state.client.get(admin_url("/packs")).bearer_auth(token)).await?)
}

#[tauri::command]
pub async fn create_pack(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    meta: PackMeta,
) -> Result<Value, CmdError> {
    let token = guard(&app, &state).await?;
    let mut body = serde_json::to_value(&meta)?;
    body["id"] = json!(id);
    Ok(fetch(state.client.post(admin_url("/packs")).bearer_auth(token).json(&body)).await?)
}

#[tauri::command]
pub async fn set_pack_meta(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    meta: PackMeta,
) -> Result<Manifest, CmdError> {
    let token = guard(&app, &state).await?;
    let mut draft = load(&app, &state, &token, &pack_id, false).await?;
    send(
        state
            .client
            .put(admin_url(&format!("/packs/{pack_id}")))
            .bearer_auth(token)
            .json(&meta),
    )
    .await?;
    draft.name = meta.name;
    draft.theme = meta.theme;
    draft.minecraft = meta.minecraft;
    draft.loader = Loader {
        kind: meta.loader_type,
        version: meta.loader_version.unwrap_or_default(),
    };
    draft.java = Some(meta.java);
    draft.server = meta.server;
    save(&app, &draft).await?;
    Ok(draft)
}

#[tauri::command]
pub async fn delete_pack(app: AppHandle, state: State<'_, AppState>, pack_id: String) -> Result<(), CmdError> {
    let token = guard(&app, &state).await?;
    send(
        state
            .client
            .delete(admin_url(&format!("/packs/{pack_id}")))
            .bearer_auth(token),
    )
    .await?;
    let _ = tokio::fs::remove_file(draft_path(&app, &pack_id)?).await;
    Ok(())
}

#[tauri::command]
pub async fn admin_draft(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    reload: bool,
) -> Result<Manifest, CmdError> {
    let token = guard(&app, &state).await?;
    Ok(load(&app, &state, &token, &pack_id, reload).await?)
}

#[tauri::command]
pub async fn add_project(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    source: Source,
    project_id: String,
    kind: Kind,
) -> Result<Outcome, CmdError> {
    if kind == Kind::Config {
        return Err(anyhow!("Configs are added from files").into());
    }
    let token = guard(&app, &state).await?;
    let http = Http {
        client: &state.client,
        token: &token,
    };
    let mut outcome = Outcome {
        draft: load(&app, &state, &token, &pack_id, false).await?,
        added: vec![],
        incompatible: vec![],
    };
    resolve(&http, source, project_id, kind, &mut outcome).await?;
    save(&app, &outcome.draft).await?;
    Ok(outcome)
}

#[tauri::command]
pub async fn remove_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    path: String,
) -> Result<Manifest, CmdError> {
    Ok(edit(&app, &state, &pack_id, |draft| {
        find(draft, &path)?;
        draft.files.retain(|file| file.path != path);
        Ok(())
    })
    .await?)
}

#[tauri::command]
pub async fn set_side(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    path: String,
    side: Side,
) -> Result<Manifest, CmdError> {
    Ok(edit(&app, &state, &pack_id, |draft| {
        find(draft, &path)?.side = side;
        Ok(())
    })
    .await?)
}

#[tauri::command]
pub async fn admin_set_optional(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    path: String,
    optional: bool,
    default_enabled: bool,
) -> Result<Manifest, CmdError> {
    Ok(edit(&app, &state, &pack_id, |draft| {
        let file = find(draft, &path)?;
        file.optional = optional;
        file.default_enabled = default_enabled;
        Ok(())
    })
    .await?)
}

#[tauri::command]
pub async fn set_policy(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    path: String,
    policy: Policy,
) -> Result<Manifest, CmdError> {
    Ok(edit(&app, &state, &pack_id, |draft| {
        find(draft, &path)?.policy = policy;
        Ok(())
    })
    .await?)
}

#[tauri::command]
pub async fn check_updates(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
) -> Result<Vec<Update>, CmdError> {
    let token = guard(&app, &state).await?;
    let draft = load(&app, &state, &token, &pack_id, false).await?;
    let http = Http {
        client: &state.client,
        token: &token,
    };
    let target = Target {
        minecraft: &draft.minecraft,
        loader: draft.loader.kind,
    };
    Ok(catalog::updates(&http, &store_dir(&app)?, &draft.files, target).await?)
}

#[tauri::command]
pub async fn apply_update(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    path: String,
) -> Result<Outcome, CmdError> {
    let token = guard(&app, &state).await?;
    let http = Http {
        client: &state.client,
        token: &token,
    };
    let mut draft = load(&app, &state, &token, &pack_id, false).await?;
    let index = draft
        .files
        .iter()
        .position(|file| file.path == path)
        .ok_or_else(|| anyhow!("{path} is not in the draft"))?;
    let old = draft.files.remove(index);
    let (source, project_id) = old
        .meta
        .as_ref()
        .filter(|meta| !matches!(meta.source, Source::Manual | Source::Local))
        .map(|meta| (meta.source, meta.project_id.clone()))
        .ok_or_else(|| anyhow!("{path} cannot be updated automatically"))?;
    let mut outcome = Outcome {
        draft,
        added: vec![],
        incompatible: vec![],
    };
    resolve(&http, source, project_id.clone(), old.kind, &mut outcome).await?;
    if let Some(file) = outcome
        .draft
        .files
        .iter_mut()
        .find(|file| file.meta.as_ref().is_some_and(|meta| meta.project_id == project_id))
    {
        file.side = old.side;
        file.optional = old.optional;
        file.default_enabled = old.default_enabled;
        file.policy = old.policy;
    }
    save(&app, &outcome.draft).await?;
    Ok(outcome)
}

#[tauri::command]
pub async fn open_manual_download(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    path: String,
) -> Result<(), CmdError> {
    let token = guard(&app, &state).await?;
    let draft = load(&app, &state, &token, &pack_id, false).await?;
    let file = draft
        .files
        .iter()
        .find(|file| file.path == path)
        .ok_or_else(|| anyhow!("{path} is not in the draft"))?;
    let meta = file
        .meta
        .as_ref()
        .filter(|meta| meta.source == Source::Manual)
        .ok_or_else(|| anyhow!("{path} is not a manual download"))?;
    let page = format!("{}/files/{}", meta.page_url.trim_end_matches('/'), meta.version_id);
    let (sha1, size, store) = (file.sha1.clone(), file.size, store_dir(&app)?);
    let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if let Ok(event) = event {
            let _ = sender.send(event);
        }
    })?;
    watcher.watch(&app.path().download_dir()?, RecursiveMode::NonRecursive)?;
    app.opener().open_url(page, None::<&str>)?;
    tauri::async_runtime::spawn(async move {
        let _watcher = watcher;
        let Ok(Some(found)) = tokio::time::timeout(Duration::from_secs(1800), wait_for(&mut receiver, &sha1, size)).await
        else {
            return;
        };
        let stored = tokio::fs::create_dir_all(&store).await.is_ok()
            && tokio::fs::copy(&found, store.join(&sha1)).await.is_ok();
        if stored {
            let _ = app.emit("admin://manual-found", json!({ "path": path }));
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn add_config_files(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    root: String,
    paths: Vec<String>,
    policy: Policy,
) -> Result<Manifest, CmdError> {
    let token = guard(&app, &state).await?;
    let mut draft = load(&app, &state, &token, &pack_id, false).await?;
    let store = store_dir(&app)?;
    tokio::fs::create_dir_all(&store).await?;
    for relative in paths {
        let path = relative.replace('\\', "/");
        if !Path::new(&path).components().all(|part| matches!(part, Component::Normal(_))) {
            return Err(anyhow!("Invalid config path {relative}").into());
        }
        let bytes = tokio::fs::read(Path::new(&root).join(&path)).await?;
        let sha1 = sha1_hex(&bytes);
        tokio::fs::write(store.join(&sha1), &bytes).await?;
        draft.files.retain(|file| file.path != path);
        draft.files.push(ManifestFile {
            path,
            sha1,
            size: bytes.len() as u64,
            url: String::new(),
            side: Side::Both,
            kind: Kind::Config,
            optional: false,
            default_enabled: true,
            policy,
            meta: None,
        });
    }
    save(&app, &draft).await?;
    Ok(draft)
}

#[tauri::command]
pub async fn add_local_mod(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    path: String,
) -> Result<Manifest, CmdError> {
    let token = guard(&app, &state).await?;
    let mut draft = load(&app, &state, &token, &pack_id, false).await?;
    let bytes = tokio::fs::read(&path).await?;
    let stem = Path::new(&path)
        .file_stem()
        .and_then(|name| name.to_str())
        .ok_or_else(|| anyhow!("Invalid file name {path}"))?
        .to_owned();
    let info = read_fabric_info(&bytes);
    let field = |key: &str| info.get(key).and_then(Value::as_str).map(str::to_owned);
    let sha1 = sha1_hex(&bytes);
    let store = store_dir(&app)?;
    tokio::fs::create_dir_all(&store).await?;
    tokio::fs::write(store.join(&sha1), &bytes).await?;
    let project_id = field("id").unwrap_or_else(|| stem.clone());
    let path = format!("mods/{stem}.jar");
    draft.files.retain(|file| {
        file.path != path && !file.meta.as_ref().is_some_and(|meta| meta.project_id == project_id)
    });
    draft.files.push(ManifestFile {
        path,
        sha1,
        size: bytes.len() as u64,
        url: String::new(),
        side: Side::Client,
        kind: Kind::Mod,
        optional: false,
        default_enabled: true,
        policy: Policy::Managed,
        meta: Some(Meta {
            title: field("name").unwrap_or(stem),
            author: info
                .get("authors")
                .and_then(Value::as_array)
                .map(|authors| {
                    authors
                        .iter()
                        .filter_map(|author| author.as_str().or_else(|| author.get("name")?.as_str()))
                        .collect::<Vec<_>>()
                        .join(", ")
                })
                .unwrap_or_default(),
            description: field("description").unwrap_or_default(),
            icon_url: String::new(),
            gallery: vec![],
            page_url: String::new(),
            source: Source::Local,
            project_id,
            version_id: field("version").unwrap_or_default(),
            dependencies: vec![],
        }),
    });
    save(&app, &draft).await?;
    Ok(draft)
}

#[tauri::command]
pub async fn publish(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
    version: String,
    notes: String,
) -> Result<Published, CmdError> {
    let token = guard(&app, &state).await?;
    let mut draft = load(&app, &state, &token, &pack_id, false).await?;
    let client = &state.client;
    emit(&app, "check", "", 0, 1);
    let sha1s: BTreeSet<&String> = draft.files.iter().map(|file| &file.sha1).collect();
    let missing: Vec<String> = fetch(
        client
            .post(admin_url("/files/missing"))
            .bearer_auth(&token)
            .json(&json!({ "sha1s": sha1s })),
    )
    .await?;
    let uploads: Vec<&ManifestFile> = missing
        .iter()
        .filter_map(|sha1| draft.files.iter().find(|file| &file.sha1 == sha1))
        .collect();
    upload_missing(&app, client, &token, &store_dir(&app)?, uploads).await?;
    emit(&app, "publish", "", 0, 1);
    let response = client
        .post(admin_url(&format!("/packs/{pack_id}/publish")))
        .bearer_auth(&token)
        .json(&json!({ "base": draft.version, "version": version, "files": draft.files, "notes": notes }))
        .send()
        .await?;
    let status = response.status();
    if !status.is_success() {
        let body: Value = response.json().await.unwrap_or_default();
        if body["error"] == "OutdatedDraft" {
            return Err(anyhow!(
                "Сборку уже обновили до {}, а черновик собран из {}. Загрузите свежую версию.",
                body["latest"].as_str().unwrap_or_default(),
                draft.version
            )
            .into());
        }
        return Err(anyhow!(body["errorMessage"].as_str().map_or_else(|| status.to_string(), str::to_string)).into());
    }
    let published: Published = response.json().await?;
    draft.version = published.version.clone();
    save(&app, &draft).await?;
    emit(&app, "done", "", 1, 1);
    Ok(published)
}

#[tauri::command]
pub async fn list_users(app: AppHandle, state: State<'_, AppState>) -> Result<Value, CmdError> {
    let token = guard(&app, &state).await?;
    Ok(fetch(state.client.get(admin_url("/users")).bearer_auth(token)).await?)
}

#[tauri::command]
pub async fn set_role(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    role: Role,
) -> Result<Value, CmdError> {
    let token = guard(&app, &state).await?;
    Ok(fetch(
        state
            .client
            .patch(admin_url(&format!("/users/{id}")))
            .bearer_auth(token)
            .json(&json!({ "role": role })),
    )
    .await?)
}

#[tauri::command]
pub async fn delete_user(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<Value, CmdError> {
    let token = guard(&app, &state).await?;
    Ok(fetch(state.client.delete(admin_url(&format!("/users/{id}"))).bearer_auth(token)).await?)
}

async fn resolve(
    http: &Http<'_>,
    source: Source,
    root: String,
    kind: Kind,
    outcome: &mut Outcome,
) -> Result<()> {
    let Outcome {
        draft,
        added,
        incompatible,
    } = outcome;
    let minecraft = draft.minecraft.clone();
    let loader = draft.loader.kind;
    let target = Target {
        minecraft: &minecraft,
        loader,
    };
    let mut queue = vec![(root.clone(), kind)];
    while let Some((id, kind)) = queue.pop() {
        if draft
            .files
            .iter()
            .any(|file| file.meta.as_ref().is_some_and(|meta| meta.project_id == id))
        {
            if id == root {
                bail!("Already added to the pack");
            }
            continue;
        }
        let (project, versions) = try_join(
            catalog::project(http, source, &id),
            catalog::versions(http, source, &id, Some((target, kind))),
        )
        .await?;
        let Some(version) = versions.into_iter().next() else {
            if id == root {
                bail!("{} has no version for Minecraft {minecraft} on {}", project.title, loader.name());
            }
            incompatible.push(project.title);
            continue;
        };
        queue.extend(
            version
                .dependencies
                .iter()
                .filter(|dependency| dependency.required)
                .map(|dependency| (dependency.project_id.clone(), Kind::Mod)),
        );
        added.push(project.title.clone());
        let file = entry(project, version, source, kind);
        draft.files.retain(|existing| existing.path != file.path);
        draft.files.push(file);
    }
    Ok(())
}

fn entry(project: Project, version: Version, source: Source, kind: Kind) -> ManifestFile {
    let manual = version.url.is_none();
    ManifestFile {
        path: format!(
            "{}/{}",
            match kind {
                Kind::Mod => "mods",
                Kind::Resourcepack => "resourcepacks",
                Kind::Shader => "shaderpacks",
                Kind::Config => "config",
            },
            version.file_name
        ),
        sha1: version.sha1,
        size: version.size,
        url: version.url.unwrap_or_default(),
        side: version.side.unwrap_or(Side::Both),
        kind,
        optional: false,
        default_enabled: true,
        policy: Policy::Managed,
        meta: Some(Meta {
            title: project.title,
            author: project.author,
            description: project.description,
            icon_url: project.icon_url,
            gallery: project.gallery,
            page_url: project.page_url,
            source: if manual { Source::Manual } else { source },
            project_id: project.id,
            version_id: version.id,
            dependencies: version
                .dependencies
                .into_iter()
                .filter(|dependency| dependency.required)
                .map(|dependency| dependency.project_id)
                .collect(),
        }),
    }
}

async fn edit(
    app: &AppHandle,
    state: &AppState,
    pack_id: &str,
    change: impl FnOnce(&mut Manifest) -> Result<()>,
) -> Result<Manifest> {
    let token = guard(app, state).await?;
    let mut draft = load(app, state, &token, pack_id, false).await?;
    change(&mut draft)?;
    save(app, &draft).await?;
    Ok(draft)
}

fn find<'a>(draft: &'a mut Manifest, path: &str) -> Result<&'a mut ManifestFile> {
    draft
        .files
        .iter_mut()
        .find(|file| file.path == path)
        .ok_or_else(|| anyhow!("{path} is not in the draft"))
}

async fn load(app: &AppHandle, state: &AppState, token: &str, pack_id: &str, reload: bool) -> Result<Manifest> {
    if !reload {
        if let Ok(bytes) = tokio::fs::read(draft_path(app, pack_id)?).await {
            return Ok(serde_json::from_slice(&bytes)?);
        }
    }
    let draft: Manifest = fetch(
        state
            .client
            .get(admin_url(&format!("/packs/{pack_id}/draft")))
            .bearer_auth(token),
    )
    .await?;
    save(app, &draft).await?;
    Ok(draft)
}

async fn save(app: &AppHandle, draft: &Manifest) -> Result<()> {
    let path = draft_path(app, &draft.id)?;
    tokio::fs::create_dir_all(path.parent().unwrap()).await?;
    tokio::fs::write(path, serde_json::to_vec_pretty(draft)?).await?;
    Ok(())
}

async fn upload_missing(
    app: &AppHandle,
    client: &Client,
    token: &str,
    store: &Path,
    files: Vec<&ManifestFile>,
) -> Result<()> {
    let total = files.len() as u64;
    let done = AtomicU64::new(0);
    let done = &done;
    let mut pending = stream::iter(files.into_iter().cloned())
        .map(|file| async move {
            emit(app, "upload", &file.path, done.load(Ordering::Relaxed), total);
            let result = upload(client, token, store, &file).await;
            done.fetch_add(1, Ordering::Relaxed);
            result
        })
        .buffer_unordered(4);
    while let Some(result) = pending.next().await {
        result?;
    }
    emit(app, "upload", "", total, total);
    Ok(())
}

async fn upload(client: &Client, token: &str, store: &Path, file: &ManifestFile) -> Result<()> {
    match tokio::fs::read(store.join(&file.sha1)).await {
        Ok(bytes) => {
            send(
                client
                    .put(admin_url(&format!("/files/{}", file.sha1)))
                    .bearer_auth(token)
                    .body(bytes),
            )
            .await?;
        }
        Err(_) if !file.url.is_empty() => {
            send(
                client
                    .post(admin_url("/files/fetch"))
                    .timeout(Duration::from_secs(120))
                    .bearer_auth(token)
                    .json(&json!({ "url": file.url, "sha1": file.sha1 })),
            )
            .await?;
        }
        Err(_) => bail!("{} must be downloaded manually first", file.path),
    }
    Ok(())
}

async fn wait_for(events: &mut UnboundedReceiver<notify::Event>, sha1: &str, size: u64) -> Option<PathBuf> {
    while let Some(event) = events.recv().await {
        for path in event.paths {
            if tokio::fs::metadata(&path)
                .await
                .is_ok_and(|meta| meta.is_file() && meta.len() == size)
                && tokio::fs::read(&path)
                    .await
                    .is_ok_and(|bytes| sha1_hex(&bytes) == sha1)
            {
                return Some(path);
            }
        }
    }
    None
}

fn emit(app: &AppHandle, stage: &str, label: &str, done: u64, total: u64) {
    let _ = app.emit(
        "admin://publish",
        json!({ "stage": stage, "label": label, "done": done, "total": total }),
    );
}

fn read_fabric_info(jar: &[u8]) -> Value {
    let mut text = String::new();
    zip::ZipArchive::new(std::io::Cursor::new(jar))
        .ok()
        .and_then(|mut archive| archive.by_name("fabric.mod.json").ok()?.read_to_string(&mut text).ok())
        .and_then(|_| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null)
}

fn sha1_hex(bytes: &[u8]) -> String {
    Sha1::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn admin_url(path: &str) -> String {
    endpoint(&format!("/admin{path}"))
}

fn draft_path(app: &AppHandle, pack_id: &str) -> Result<PathBuf> {
    Ok(app
        .path()
        .app_data_dir()?
        .join("admin")
        .join("drafts")
        .join(format!("{pack_id}.json")))
}

fn store_dir(app: &AppHandle) -> Result<PathBuf> {
    Ok(app.path().app_data_dir()?.join("admin").join("files"))
}
