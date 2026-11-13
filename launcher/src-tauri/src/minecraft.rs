use anyhow::{Context, Result};
use serde::{de::DeserializeOwned, Deserialize};
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
};

use crate::download::{get_json, Ctx, Task};

const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const ASSETS_URL: &str = "https://resources.download.minecraft.net";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionJson {
    pub id: String,
    pub main_class: String,
    pub arguments: Option<Arguments>,
    pub minecraft_arguments: Option<String>,
    #[serde(default)]
    pub libraries: Vec<Library>,
    pub asset_index: Option<AssetIndex>,
    pub downloads: Option<VersionDownloads>,
    pub java_version: Option<JavaVersion>,
    pub data: Option<HashMap<String, SidedData>>,
    pub processors: Option<Vec<Processor>>,
}

#[derive(Deserialize)]
pub struct Arguments {
    #[serde(default)]
    pub game: Vec<Argument>,
    #[serde(default)]
    pub jvm: Vec<Argument>,
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum Argument {
    Plain(String),
    Ruled { rules: Vec<Rule>, value: ArgumentValue },
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum ArgumentValue {
    One(String),
    Many(Vec<String>),
}

#[derive(Deserialize)]
pub struct Rule {
    action: String,
    os: Option<RuleOs>,
    features: Option<HashMap<String, bool>>,
}

#[derive(Deserialize)]
struct RuleOs {
    name: Option<String>,
    arch: Option<String>,
}

#[derive(Deserialize)]
pub struct Library {
    pub name: String,
    downloads: Option<LibraryDownloads>,
    url: Option<String>,
    rules: Option<Vec<Rule>>,
    natives: Option<HashMap<String, String>>,
    extract: Option<Extract>,
    #[serde(default = "yes", alias = "include_in_classpath")]
    include_in_classpath: bool,
    #[serde(default = "yes")]
    downloadable: bool,
}

#[derive(Deserialize)]
struct LibraryDownloads {
    artifact: Option<Artifact>,
    classifiers: Option<HashMap<String, Artifact>>,
}

#[derive(Deserialize)]
struct Artifact {
    path: Option<String>,
    #[serde(default)]
    url: String,
    sha1: Option<String>,
    size: Option<u64>,
}

#[derive(Deserialize)]
struct Extract {
    #[serde(default)]
    exclude: Vec<String>,
}

#[derive(Deserialize)]
pub struct AssetIndex {
    id: String,
    sha1: String,
    size: u64,
    url: String,
}

#[derive(Deserialize)]
pub struct VersionDownloads {
    client: Option<FileDownload>,
}

#[derive(Deserialize)]
struct FileDownload {
    sha1: String,
    size: u64,
    url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersion {
    pub major_version: u32,
}

#[derive(Deserialize)]
pub struct SidedData {
    pub client: String,
}

#[derive(Deserialize)]
pub struct Processor {
    pub jar: String,
    #[serde(default)]
    pub classpath: Vec<String>,
    #[serde(default)]
    pub args: Vec<String>,
    pub sides: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct Manifest {
    versions: Vec<ManifestEntry>,
}

#[derive(Deserialize)]
struct ManifestEntry {
    id: String,
    url: String,
    sha1: String,
}

#[derive(Deserialize)]
struct AssetIndexFile {
    objects: HashMap<String, AssetObject>,
}

#[derive(Deserialize)]
struct AssetObject {
    hash: String,
    size: u64,
}

struct Item {
    rel: String,
    url: String,
    sha1: Option<String>,
    size: u64,
}

pub async fn vanilla(ctx: &Ctx, minecraft: &str) -> Result<VersionJson> {
    let path = ctx
        .root
        .join("versions")
        .join(minecraft)
        .join(format!("{minecraft}.json"));
    if !path.exists() {
        ctx.progress("version", "Version manifest", 0, 1);
        let manifest: Manifest = get_json(&ctx.client, MANIFEST_URL).await?;
        let entry = manifest
            .versions
            .into_iter()
            .find(|v| v.id == minecraft)
            .with_context(|| format!("unknown minecraft version {minecraft}"))?;
        let task = Task {
            url: entry.url,
            path: path.clone(),
            sha1: Some(entry.sha1),
            size: 0,
        };
        ctx.download("version", minecraft, vec![task]).await?;
    }
    read_json(&path).await
}

pub fn merge(base: VersionJson, loader: VersionJson) -> VersionJson {
    let mut seen = HashSet::new();
    let libraries = loader
        .libraries
        .into_iter()
        .chain(base.libraries)
        .filter(|l| seen.insert(l.key()))
        .collect();
    let arguments = match (base.arguments, loader.arguments) {
        (Some(b), Some(l)) => Some(Arguments {
            game: b.game.into_iter().chain(l.game).collect(),
            jvm: b.jvm.into_iter().chain(l.jvm).collect(),
        }),
        (b, l) => l.or(b),
    };
    VersionJson {
        id: loader.id,
        main_class: loader.main_class,
        arguments,
        minecraft_arguments: loader.minecraft_arguments.or(base.minecraft_arguments),
        libraries,
        data: loader.data,
        processors: loader.processors,
        ..base
    }
}

pub async fn install(ctx: &Ctx, version: &VersionJson) -> Result<()> {
    let libs = ctx.root.join("libraries");
    let tasks = version
        .libraries
        .iter()
        .filter(|l| l.applies() && l.downloadable)
        .flat_map(|l| l.download_item().into_iter().chain(l.native_item()))
        .map(|i| Task {
            url: i.url,
            path: libs.join(i.rel),
            sha1: i.sha1,
            size: i.size,
        })
        .collect();
    ctx.download("libraries", "Libraries", tasks).await?;
    let client = version
        .downloads
        .as_ref()
        .and_then(|d| d.client.as_ref())
        .context("version has no client download")?;
    let task = Task {
        url: client.url.clone(),
        path: jar_path(ctx, version),
        sha1: Some(client.sha1.clone()),
        size: client.size,
    };
    ctx.download("client", "Minecraft client", vec![task]).await?;
    extract_natives(ctx, version).await
}

pub async fn install_assets(ctx: &Ctx, version: &VersionJson) -> Result<String> {
    let index = version
        .asset_index
        .as_ref()
        .context("version has no asset index")?;
    let assets = ctx.root.join("assets");
    let index_path = assets.join("indexes").join(format!("{}.json", index.id));
    let task = Task {
        url: index.url.clone(),
        path: index_path.clone(),
        sha1: Some(index.sha1.clone()),
        size: index.size,
    };
    ctx.download("assets", "Asset index", vec![task]).await?;
    let file: AssetIndexFile = read_json(&index_path).await?;
    let tasks: HashMap<String, Task> = file
        .objects
        .into_values()
        .map(|o| {
            let prefix = &o.hash[..2];
            let task = Task {
                url: format!("{ASSETS_URL}/{prefix}/{}", o.hash),
                path: assets.join("objects").join(prefix).join(&o.hash),
                sha1: Some(o.hash.clone()),
                size: o.size,
            };
            (o.hash, task)
        })
        .collect();
    ctx.download("assets", "Assets", tasks.into_values().collect())
        .await?;
    Ok(index.id.clone())
}

pub fn classpath(ctx: &Ctx, version: &VersionJson) -> Vec<PathBuf> {
    let libs = ctx.root.join("libraries");
    version
        .libraries
        .iter()
        .filter(|l| l.applies() && l.include_in_classpath && !l.native_only())
        .map(|l| libs.join(l.rel()))
        .chain([jar_path(ctx, version)])
        .collect()
}

pub fn natives_dir(ctx: &Ctx, version: &VersionJson) -> PathBuf {
    ctx.root.join("versions").join(&version.id).join("natives")
}

pub fn jar_path(ctx: &Ctx, version: &VersionJson) -> PathBuf {
    ctx.root
        .join("versions")
        .join(&version.id)
        .join(format!("{}.jar", version.id))
}

pub fn expand(list: &[Argument]) -> Vec<String> {
    list.iter()
        .flat_map(|a| match a {
            Argument::Plain(s) => vec![s.clone()],
            Argument::Ruled { rules, value } if allowed(rules) => match value {
                ArgumentValue::One(s) => vec![s.clone()],
                ArgumentValue::Many(v) => v.clone(),
            },
            Argument::Ruled { .. } => Vec::new(),
        })
        .collect()
}

pub fn maven_path(name: &str) -> String {
    let (coords, ext) = name.split_once('@').unwrap_or((name, "jar"));
    let parts: Vec<&str> = coords.split(':').collect();
    let [group, artifact, version, rest @ ..] = parts.as_slice() else {
        return coords.to_owned();
    };
    let classifier = rest.first().map(|c| format!("-{c}")).unwrap_or_default();
    format!(
        "{}/{artifact}/{version}/{artifact}-{version}{classifier}.{ext}",
        group.replace('.', "/")
    )
}

pub async fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let bytes = tokio::fs::read(path)
        .await
        .with_context(|| format!("read {}", path.display()))?;
    serde_json::from_slice(&bytes).with_context(|| format!("parse {}", path.display()))
}

impl Library {
    fn key(&self) -> String {
        let parts: Vec<&str> = self.name.split(':').collect();
        format!(
            "{}:{}:{}",
            parts[0],
            parts.get(1).unwrap_or(&""),
            parts.get(3).unwrap_or(&"")
        )
    }

    fn applies(&self) -> bool {
        self.rules.as_deref().is_none_or(allowed)
    }

    fn native_only(&self) -> bool {
        self.natives.is_some() && self.artifact().is_none()
    }

    fn artifact(&self) -> Option<&Artifact> {
        self.downloads.as_ref()?.artifact.as_ref()
    }

    fn rel(&self) -> String {
        self.artifact()
            .and_then(|a| a.path.clone())
            .unwrap_or_else(|| maven_path(&self.name))
    }

    fn download_item(&self) -> Option<Item> {
        if let Some(a) = self.artifact().filter(|a| !a.url.is_empty()) {
            return Some(Item {
                rel: self.rel(),
                url: a.url.clone(),
                sha1: a.sha1.clone(),
                size: a.size.unwrap_or(0),
            });
        }
        let base = self.url.as_deref().filter(|u| !u.is_empty())?;
        let rel = self.rel();
        Some(Item {
            url: format!("{}/{rel}", base.trim_end_matches('/')),
            rel,
            sha1: None,
            size: 0,
        })
    }

    fn native_item(&self) -> Option<Item> {
        let classifier = self.natives.as_ref()?.get("windows")?.replace("${arch}", "64");
        let artifact = self.downloads.as_ref()?.classifiers.as_ref()?.get(&classifier)?;
        Some(Item {
            rel: artifact
                .path
                .clone()
                .unwrap_or_else(|| maven_path(&format!("{}:{classifier}", self.name))),
            url: artifact.url.clone(),
            sha1: artifact.sha1.clone(),
            size: artifact.size.unwrap_or(0),
        })
    }
}

impl Rule {
    fn matches(&self) -> bool {
        let os = self.os.as_ref().is_none_or(|os| {
            os.name.as_deref().is_none_or(|n| n == "windows")
                && os.arch.as_deref().is_none_or(|a| a == "x64" || a == "x86_64")
        });
        os && self.features.as_ref().is_none_or(|f| f.values().all(|v| !v))
    }
}

fn allowed(rules: &[Rule]) -> bool {
    rules.is_empty()
        || rules
            .iter()
            .rfind(|r| r.matches())
            .is_some_and(|r| r.action == "allow")
}

fn yes() -> bool {
    true
}

async fn extract_natives(ctx: &Ctx, version: &VersionJson) -> Result<()> {
    let dir = natives_dir(ctx, version);
    tokio::fs::create_dir_all(&dir).await?;
    let libs = ctx.root.join("libraries");
    let jars: Vec<(PathBuf, Vec<String>)> = version
        .libraries
        .iter()
        .filter(|l| l.applies())
        .filter_map(|l| {
            let exclude = l.extract.as_ref().map(|e| e.exclude.clone()).unwrap_or_default();
            Some((libs.join(l.native_item()?.rel), exclude))
        })
        .collect();
    tokio::task::spawn_blocking(move || {
        jars.iter()
            .try_for_each(|(jar, exclude)| unzip(jar, &dir, exclude))
    })
    .await?
}

fn unzip(jar: &Path, dir: &Path, exclude: &[String]) -> Result<()> {
    let mut zip = zip::ZipArchive::new(std::fs::File::open(jar)?)?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let Some(name) = entry.enclosed_name() else {
            continue;
        };
        let target = dir.join(name);
        if entry.is_dir()
            || target.exists()
            || exclude.iter().any(|e| entry.name().starts_with(e.as_str()))
        {
            continue;
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::io::copy(&mut entry, &mut std::fs::File::create(&target)?)?;
    }
    Ok(())
}
