use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::{collections::HashMap, path::PathBuf};

use crate::download::{get_json, Ctx, Task};
use crate::settings::{JavaMode, Settings};

const PLATFORMS: &[&str] = if cfg!(windows) {
    &["windows-x64"]
} else if cfg!(target_arch = "aarch64") {
    &["mac-os-arm64", "mac-os"]
} else {
    &["mac-os"]
};
const RUNTIMES_URL: &str = "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";

#[derive(Deserialize)]
struct RuntimeEntry {
    manifest: RuntimeFileRef,
}

#[derive(Deserialize)]
struct RuntimeFileRef {
    url: String,
}

#[derive(Deserialize)]
struct RuntimeManifest {
    files: HashMap<String, RuntimeFile>,
}

#[derive(Deserialize)]
struct RuntimeFile {
    #[serde(rename = "type")]
    kind: String,
    downloads: Option<RuntimeDownloads>,
    #[cfg(unix)]
    #[serde(default)]
    executable: bool,
    #[cfg(unix)]
    target: Option<String>,
}

#[derive(Deserialize)]
struct RuntimeDownloads {
    raw: Option<RawDownload>,
}

#[derive(Deserialize)]
struct RawDownload {
    sha1: String,
    size: u64,
    url: String,
}

pub async fn resolve(ctx: &Ctx, settings: &Settings, major: u32) -> Result<PathBuf> {
    if settings.java.mode == JavaMode::Custom {
        return Ok(settings.java.path.with_file_name(if cfg!(windows) { "java.exe" } else { "java" }));
    }
    let component = component(major)?;
    let dir = ctx.root.join("runtimes").join(component);
    let java = if cfg!(windows) {
        dir.join("bin").join("java.exe")
    } else {
        dir.join("jre.bundle/Contents/Home/bin/java")
    };
    let marker = dir.join(".installed");
    if marker.exists() {
        return Ok(java);
    }
    ctx.progress("java", &format!("Java {major}"), 0, 1);
    let all: HashMap<String, HashMap<String, Vec<RuntimeEntry>>> =
        get_json(&ctx.client, RUNTIMES_URL).await?;
    let entry = PLATFORMS
        .iter()
        .find_map(|platform| all.get(*platform)?.get(component)?.first())
        .with_context(|| format!("no Java runtime {component}"))?;
    let manifest: RuntimeManifest = get_json(&ctx.client, &entry.manifest.url).await?;
    let tasks = manifest
        .files
        .iter()
        .filter(|(_, f)| f.kind == "file")
        .filter_map(|(path, f)| {
            let raw = f.downloads.as_ref()?.raw.as_ref()?;
            Some(Task {
                url: raw.url.clone(),
                path: dir.join(path),
                sha1: Some(raw.sha1.clone()),
                size: raw.size,
            })
        })
        .collect();
    ctx.download("java", &format!("Java {major}"), tasks).await?;
    #[cfg(unix)]
    finalize(&dir, &manifest.files).await?;
    tokio::fs::write(marker, "").await?;
    Ok(java)
}

fn component(major: u32) -> Result<&'static str> {
    match major {
        8 => Ok("jre-legacy"),
        16 => Ok("java-runtime-alpha"),
        17 => Ok("java-runtime-gamma"),
        21 => Ok("java-runtime-delta"),
        25 => Ok("java-runtime-epsilon"),
        _ => bail!("no bundled Java runtime for major version {major}"),
    }
}

#[cfg(unix)]
async fn finalize(dir: &std::path::Path, files: &HashMap<String, RuntimeFile>) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    for (path, file) in files {
        let path = dir.join(path);
        match (file.kind.as_str(), &file.target) {
            ("link", Some(target)) => {
                if let Some(parent) = path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }
                let _ = tokio::fs::remove_file(&path).await;
                tokio::fs::symlink(target, &path).await?;
            }
            ("file", _) if file.executable => {
                tokio::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).await?;
            }
            _ => {}
        }
    }
    Ok(())
}
