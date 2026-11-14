use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    io::Read,
    path::{Path, PathBuf},
};

use crate::download::{get, get_json, Ctx};
use crate::minecraft::{maven_path, read_json, VersionJson};

const META_URL: &str = "https://launcher-meta.modrinth.com";
const GAME_VERSION_PLACEHOLDER: &str = "${modrinth.gameVersion}";
#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum LoaderKind {
    Vanilla,
    Fabric,
    Forge,
    NeoForge,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoaderManifest {
    game_versions: Vec<GameVersion>,
}

#[derive(Deserialize)]
struct GameVersion {
    id: String,
    loaders: Vec<LoaderVersion>,
}

#[derive(Deserialize)]
struct LoaderVersion {
    id: String,
    url: String,
}

impl LoaderKind {
    pub fn name(self) -> &'static str {
        match self {
            Self::Vanilla => "vanilla",
            Self::Fabric => "fabric",
            Self::Forge => "forge",
            Self::NeoForge => "neoforge",
        }
    }

    pub fn meta_dir(self) -> Option<&'static str> {
        match self {
            Self::Vanilla => None,
            Self::Fabric => Some("fabric"),
            Self::Forge => Some("forge"),
            Self::NeoForge => Some("neo"),
        }
    }
}

pub async fn profile(
    ctx: &Ctx,
    meta_dir: &str,
    minecraft: &str,
    version: &str,
) -> Result<VersionJson> {
    let path = ctx
        .root
        .join("versions")
        .join("profiles")
        .join(format!("{minecraft}-{meta_dir}-{version}.json"));
    if !path.exists() {
        ctx.progress("loader", "Loader profile", 0, 1);
        let manifest: LoaderManifest =
            get_json(&ctx.client, &format!("{META_URL}/{meta_dir}/v0/manifest.json")).await?;
        let entry = manifest
            .game_versions
            .into_iter()
            .filter(|g| g.id == minecraft || g.id == GAME_VERSION_PLACEHOLDER)
            .flat_map(|g| g.loaders)
            .find(|l| l.id == version)
            .with_context(|| format!("{meta_dir} {version} is not available for {minecraft}"))?;
        let text = get(&ctx.client, &entry.url)
            .await?
            .text()
            .await?
            .replace(GAME_VERSION_PLACEHOLDER, minecraft);
        if let Some(dir) = path.parent() {
            tokio::fs::create_dir_all(dir).await?;
        }
        tokio::fs::write(&path, text).await?;
    }
    read_json(&path).await
}

pub async fn run_processors(
    ctx: &Ctx,
    version: &VersionJson,
    minecraft: &str,
    java: &Path,
) -> Result<()> {
    let Some(processors) = &version.processors else {
        return Ok(());
    };
    let version_dir = ctx.root.join("versions").join(&version.id);
    let marker = version_dir.join(".processed");
    if marker.exists() {
        return Ok(());
    }
    let libs = ctx.root.join("libraries");
    let mut data: HashMap<String, String> = version
        .data
        .iter()
        .flatten()
        .map(|(k, d)| (k.clone(), token(&d.client, &libs, &HashMap::new())))
        .collect();
    for (key, value) in [
        ("SIDE", "client".to_owned()),
        (
            "MINECRAFT_JAR",
            version_dir.join(format!("{}.jar", version.id)).display().to_string(),
        ),
        ("MINECRAFT_VERSION", minecraft.to_owned()),
        ("ROOT", ctx.root.display().to_string()),
        ("LIBRARY_DIR", libs.display().to_string()),
    ] {
        data.insert(key.to_owned(), value);
    }
    let processors: Vec<_> = processors
        .iter()
        .filter(|p| p.sides.as_ref().is_none_or(|s| s.iter().any(|s| s == "client")))
        .collect();
    for (i, processor) in processors.iter().enumerate() {
        if ctx.cancel.is_cancelled() {
            bail!("cancelled");
        }
        ctx.progress("loader", "Installing loader", i as u64, processors.len() as u64);
        let jar = libs.join(maven_path(&processor.jar));
        let classpath: Vec<PathBuf> = processor
            .classpath
            .iter()
            .map(|c| libs.join(maven_path(c)))
            .chain([jar.clone()])
            .collect();
        let mut command = tokio::process::Command::new(java);
        command
            .arg("-cp")
            .arg(std::env::join_paths(classpath)?)
            .arg(main_class(&jar)?)
            .args(processor.args.iter().map(|a| token(a, &libs, &data)))
            .current_dir(&ctx.root);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let output = command.output().await?;
        if !output.status.success() {
            bail!(
                "loader processor {} failed: {}",
                processor.jar,
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }
    ctx.progress("loader", "Installing loader", processors.len() as u64, processors.len() as u64);
    tokio::fs::write(marker, "").await?;
    Ok(())
}

fn token(value: &str, libs: &Path, data: &HashMap<String, String>) -> String {
    if let Some(coords) = value.strip_prefix('[').and_then(|v| v.strip_suffix(']')) {
        return libs.join(maven_path(coords)).display().to_string();
    }
    if let Some(literal) = value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')) {
        return literal.to_owned();
    }
    data.iter()
        .fold(value.to_owned(), |acc, (k, v)| acc.replace(&format!("{{{k}}}"), v))
}

fn main_class(jar: &Path) -> Result<String> {
    let mut manifest = String::new();
    zip::ZipArchive::new(std::fs::File::open(jar)?)?
        .by_name("META-INF/MANIFEST.MF")?
        .read_to_string(&mut manifest)?;
    manifest
        .lines()
        .find_map(|l| l.strip_prefix("Main-Class:"))
        .map(|m| m.trim().to_owned())
        .with_context(|| format!("no Main-Class in {}", jar.display()))
}
