use anyhow::{bail, Context, Result};
use futures_util::{stream, StreamExt, TryStreamExt};
use reqwest::{Client, Response};
use serde::{de::DeserializeOwned, Serialize};
use sha1::{Digest, Sha1};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

use crate::AppState;

pub struct Task {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: u64,
}

pub struct Ctx {
    pub app: AppHandle,
    pub client: Client,
    pub cancel: CancellationToken,
    pub parallel: usize,
    pub root: PathBuf,
}

#[derive(Clone, Serialize)]
struct Progress<'a> {
    stage: &'a str,
    label: &'a str,
    done: u64,
    total: u64,
    bytes_done: u64,
    bytes_total: u64,
}

struct Reporter<'a> {
    app: &'a AppHandle,
    stage: &'a str,
    label: &'a str,
    total: u64,
    bytes_total: u64,
    done: AtomicU64,
    bytes_done: AtomicU64,
    last: Mutex<Instant>,
}

impl Ctx {
    pub fn new(app: &AppHandle, state: &AppState) -> Self {
        let settings = state.settings.lock().unwrap();
        let cancel = CancellationToken::new();
        *state.cancel.lock().unwrap() = cancel.clone();
        Self {
            app: app.clone(),
            client: state.client.clone(),
            cancel,
            parallel: settings.parallel_downloads.max(1).into(),
            root: settings.game_dir.clone(),
        }
    }

    pub fn progress(&self, stage: &str, label: &str, done: u64, total: u64) {
        emit(&self.app, stage, label, done, total, 0, 0);
    }

    pub async fn download(&self, stage: &str, label: &str, tasks: Vec<Task>) -> Result<()> {
        let pending: Vec<Task> = tasks.into_iter().filter(|t| !is_present(t)).collect();
        let reporter = Reporter {
            app: &self.app,
            stage,
            label,
            total: pending.len() as u64,
            bytes_total: pending.iter().map(|t| t.size).sum(),
            done: AtomicU64::new(0),
            bytes_done: AtomicU64::new(0),
            last: Mutex::new(Instant::now()),
        };
        reporter.emit(true);
        let reporter = &reporter;
        let client = &self.client;
        let cancel = &self.cancel;
        stream::iter(pending.into_iter().map(Ok::<Task, anyhow::Error>))
            .try_for_each_concurrent(self.parallel, |task| async move {
                fetch(client, &task, cancel, reporter).await?;
                reporter.done.fetch_add(1, Ordering::Relaxed);
                reporter.emit(true);
                Ok::<(), anyhow::Error>(())
            })
            .await
    }
}

impl Reporter<'_> {
    fn emit(&self, force: bool) {
        let mut last = self.last.lock().unwrap();
        if !force && last.elapsed() < Duration::from_millis(100) {
            return;
        }
        *last = Instant::now();
        emit(
            self.app,
            self.stage,
            self.label,
            self.done.load(Ordering::Relaxed),
            self.total,
            self.bytes_done.load(Ordering::Relaxed),
            self.bytes_total,
        );
    }
}

#[tauri::command]
pub fn cancel_launch(state: State<'_, AppState>) {
    state.cancel.lock().unwrap().cancel();
}

pub async fn get(client: &Client, url: &str) -> Result<Response> {
    client
        .get(url)
        .send()
        .await
        .and_then(Response::error_for_status)
        .with_context(|| format!("request {url}"))
}

pub async fn get_json<T: DeserializeOwned>(client: &Client, url: &str) -> Result<T> {
    get(client, url)
        .await?
        .json()
        .await
        .with_context(|| format!("parse {url}"))
}

fn emit(
    app: &AppHandle,
    stage: &str,
    label: &str,
    done: u64,
    total: u64,
    bytes_done: u64,
    bytes_total: u64,
) {
    let _ = app.emit(
        "launch://progress",
        Progress {
            stage,
            label,
            done,
            total,
            bytes_done,
            bytes_total,
        },
    );
}

fn is_present(task: &Task) -> bool {
    std::fs::metadata(&task.path).is_ok_and(|m| {
        if task.size == 0 {
            m.len() > 0
        } else {
            m.len() == task.size
        }
    })
}

async fn fetch(
    client: &Client,
    task: &Task,
    cancel: &CancellationToken,
    reporter: &Reporter<'_>,
) -> Result<()> {
    let mut attempt = 0;
    loop {
        attempt += 1;
        let mut got = 0;
        match fetch_once(client, task, cancel, reporter, &mut got).await {
            Ok(()) => return Ok(()),
            Err(e) => {
                reporter.bytes_done.fetch_sub(got, Ordering::Relaxed);
                if cancel.is_cancelled() || attempt >= 3 {
                    return Err(e.context(format!("download {}", task.url)));
                }
                tokio::time::sleep(Duration::from_millis(500 * attempt)).await;
            }
        }
    }
}

async fn fetch_once(
    client: &Client,
    task: &Task,
    cancel: &CancellationToken,
    reporter: &Reporter<'_>,
    got: &mut u64,
) -> Result<()> {
    if let Some(dir) = task.path.parent() {
        tokio::fs::create_dir_all(dir).await?;
    }
    let mut tmp = task.path.clone().into_os_string();
    tmp.push(".part");
    let tmp = PathBuf::from(tmp);
    let mut file = tokio::fs::File::create(&tmp).await?;
    let mut hasher = Sha1::new();
    let mut body = get(client, &task.url).await?.bytes_stream();
    while let Some(chunk) = body.next().await {
        if cancel.is_cancelled() {
            bail!("cancelled");
        }
        let chunk = chunk?;
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
        *got += chunk.len() as u64;
        reporter
            .bytes_done
            .fetch_add(chunk.len() as u64, Ordering::Relaxed);
        reporter.emit(false);
    }
    file.flush().await?;
    drop(file);
    if let Some(expected) = &task.sha1 {
        if !format!("{:x}", hasher.finalize()).eq_ignore_ascii_case(expected) {
            bail!("sha1 mismatch");
        }
    }
    tokio::fs::rename(&tmp, &task.path).await?;
    Ok(())
}
