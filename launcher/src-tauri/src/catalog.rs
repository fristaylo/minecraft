use anyhow::{bail, Result};
use futures_util::{future::try_join, stream, StreamExt, TryStreamExt};
use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, path::Path};
use tauri::{AppHandle, State};

use crate::api::{api, fetch, CmdError, Kind, ManifestFile, Source};
use crate::loader::LoaderKind;
use crate::{admin, download, AppState};

const MODRINTH: &str = "https://api.modrinth.com/v2";

pub struct Http<'a> {
    pub client: &'a Client,
    pub token: &'a str,
}

#[derive(Clone, Copy)]
pub struct Target<'a> {
    pub minecraft: &'a str,
    pub loader: LoaderKind,
}

#[derive(Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Modrinth,
    Curseforge,
    Both,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    source: Source,
    id: String,
    title: String,
    author: String,
    description: String,
    icon_url: String,
    downloads: u64,
    compatible: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    source: Source,
    pub id: String,
    pub title: String,
    pub author: String,
    pub description: String,
    pub icon_url: String,
    pub gallery: Vec<String>,
    pub page_url: String,
    body: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Version {
    pub id: String,
    name: String,
    pub file_name: String,
    pub sha1: String,
    pub size: u64,
    pub url: Option<String>,
    date: String,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    pub dependencies: Vec<Dependency>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dependency {
    pub project_id: String,
    pub required: bool,
}

#[derive(Serialize)]
pub struct Details {
    project: Project,
    versions: Vec<Version>,
}

#[derive(Serialize)]
pub struct Update {
    path: String,
    latest: Version,
}

#[tauri::command]
pub async fn search(
    app: AppHandle,
    state: State<'_, AppState>,
    query: String,
    source: Scope,
    kind: Kind,
    minecraft: String,
    loader: LoaderKind,
) -> Result<Vec<Item>, CmdError> {
    let token = admin::guard(&app, &state).await?;
    let http = Http {
        client: &state.client,
        token: &token,
    };
    let target = Target {
        minecraft: &minecraft,
        loader,
    };
    let (modrinth, curseforge) = try_join(
        async {
            if source == Scope::Curseforge {
                return Ok(vec![]);
            }
            modrinth_search(&http, &query, kind, target).await
        },
        async {
            if source == Scope::Modrinth {
                return Ok(vec![]);
            }
            curseforge_search(&http, &query, kind, target).await
        },
    )
    .await?;
    let mut items = modrinth;
    items.extend(curseforge);
    if source == Scope::Both {
        items.sort_by_key(|item| std::cmp::Reverse(item.downloads));
    }
    Ok(items)
}

#[tauri::command]
pub async fn project_details(
    app: AppHandle,
    state: State<'_, AppState>,
    source: Source,
    id: String,
) -> Result<Details, CmdError> {
    let token = admin::guard(&app, &state).await?;
    let http = Http {
        client: &state.client,
        token: &token,
    };
    let (mut project, versions) =
        try_join(project(&http, source, &id), versions(&http, source, &id, None)).await?;
    if source == Source::Curseforge {
        let description: Data<String> = fetch(http.curseforge(&format!("/mods/{id}/description"))).await?;
        project.body = description.data;
    }
    Ok(Details { project, versions })
}

pub async fn project(http: &Http<'_>, source: Source, id: &str) -> Result<Project> {
    match source {
        Source::Modrinth => {
            let (project, members): (MrProject, Vec<MrMember>) = try_join(
                fetch(http.client.get(format!("{MODRINTH}/project/{id}"))),
                fetch(http.client.get(format!("{MODRINTH}/project/{id}/members"))),
            )
            .await?;
            let author = members
                .iter()
                .find(|member| member.role == "Owner")
                .or(members.first())
                .map(|member| member.user.username.clone())
                .unwrap_or_default();
            Ok(Project {
                source,
                id: project.id,
                title: project.title,
                author,
                description: project.description,
                icon_url: project.icon_url.unwrap_or_default(),
                gallery: project.gallery.into_iter().map(|image| image.url).collect(),
                page_url: format!("https://modrinth.com/{}/{}", project.project_type, project.slug),
                body: project.body,
            })
        }
        Source::Curseforge => {
            let project: Data<CfMod> = fetch(http.curseforge(&format!("/mods/{id}"))).await?;
            let project = project.data;
            Ok(Project {
                source,
                id: project.id.to_string(),
                title: project.name,
                author: first_author(&project.authors),
                description: project.summary,
                icon_url: project.logo.map(|logo| logo.url).unwrap_or_default(),
                gallery: project.screenshots.into_iter().map(|image| image.url).collect(),
                page_url: project.links.website_url.unwrap_or_default(),
                body: String::new(),
            })
        }
        Source::Manual => bail!("Manual files have no catalog project"),
    }
}

pub async fn versions(
    http: &Http<'_>,
    source: Source,
    id: &str,
    filter: Option<(Target<'_>, Kind)>,
) -> Result<Vec<Version>> {
    match source {
        Source::Modrinth => {
            let mut request = http.client.get(format!("{MODRINTH}/project/{id}/version"));
            if let Some((target, kind)) = filter {
                request = request.query(&[
                    ("loaders", json!(modrinth_loaders(kind, target.loader)).to_string()),
                    ("game_versions", json!([target.minecraft]).to_string()),
                ]);
            }
            let versions: Vec<MrVersion> = fetch(request).await?;
            Ok(versions.into_iter().filter_map(modrinth_version).collect())
        }
        Source::Curseforge => {
            let mut request = http.curseforge(&format!("/mods/{id}/files")).query(&[("pageSize", "50")]);
            if let Some((target, kind)) = filter {
                request = request.query(&[("gameVersion", target.minecraft)]);
                if kind == Kind::Mod {
                    request = request.query(&[("modLoaderType", curseforge_loader(target.loader).to_string())]);
                }
            }
            let files: Data<Vec<CfFile>> = fetch(request).await?;
            let mut versions: Vec<Version> = files.data.into_iter().filter_map(curseforge_version).collect();
            versions.sort_by(|a, b| b.date.cmp(&a.date));
            Ok(versions)
        }
        Source::Manual => bail!("Manual files have no catalog versions"),
    }
}

pub async fn updates(
    http: &Http<'_>,
    store: &Path,
    files: &[ManifestFile],
    target: Target<'_>,
) -> Result<Vec<Update>> {
    let (modrinth, curseforge) = try_join(
        modrinth_updates(http, files, target),
        curseforge_updates(http, store, files, target),
    )
    .await?;
    Ok(modrinth.into_iter().chain(curseforge).collect())
}

impl Http<'_> {
    fn curseforge(&self, path: &str) -> RequestBuilder {
        self.client.get(api(&format!("/cf{path}"))).bearer_auth(self.token)
    }
}

async fn modrinth_search(http: &Http<'_>, query: &str, kind: Kind, target: Target<'_>) -> Result<Vec<Item>> {
    let project_type = match kind {
        Kind::Mod => "mod",
        Kind::Resourcepack => "resourcepack",
        Kind::Shader => "shader",
        Kind::Config => bail!("Configs are not searchable"),
    };
    let facets = json!([[format!("project_type:{project_type}")], [format!("versions:{}", target.minecraft)]]).to_string();
    let response: MrSearch = fetch(http.client.get(format!("{MODRINTH}/search")).query(&[
        ("query", query),
        ("facets", facets.as_str()),
        ("limit", "30"),
    ]))
    .await?;
    Ok(response
        .hits
        .into_iter()
        .map(|hit| Item {
            source: Source::Modrinth,
            compatible: kind != Kind::Mod || hit.categories.iter().any(|category| category == target.loader.name()),
            id: hit.project_id,
            title: hit.title,
            author: hit.author,
            description: hit.description,
            icon_url: hit.icon_url.unwrap_or_default(),
            downloads: hit.downloads,
        })
        .collect())
}

async fn curseforge_search(http: &Http<'_>, query: &str, kind: Kind, target: Target<'_>) -> Result<Vec<Item>> {
    let class_id = match kind {
        Kind::Mod => "6",
        Kind::Resourcepack => "12",
        Kind::Shader => "6552",
        Kind::Config => bail!("Configs are not searchable"),
    };
    let response: Data<Vec<CfMod>> = fetch(http.curseforge("/mods/search").query(&[
        ("gameId", "432"),
        ("classId", class_id),
        ("searchFilter", query),
        ("gameVersion", target.minecraft),
        ("pageSize", "30"),
    ]))
    .await?;
    let loader = curseforge_loader(target.loader);
    Ok(response
        .data
        .into_iter()
        .map(|item| Item {
            source: Source::Curseforge,
            compatible: kind != Kind::Mod
                || item
                    .latest_files_indexes
                    .iter()
                    .any(|index| index.game_version == target.minecraft && index.mod_loader == Some(loader)),
            id: item.id.to_string(),
            author: first_author(&item.authors),
            title: item.name,
            description: item.summary,
            icon_url: item.logo.map(|logo| logo.url).unwrap_or_default(),
            downloads: item.download_count as u64,
        })
        .collect())
}

async fn modrinth_updates(http: &Http<'_>, files: &[ManifestFile], target: Target<'_>) -> Result<Vec<Update>> {
    let mut updates = vec![];
    for kind in [Kind::Mod, Kind::Resourcepack, Kind::Shader] {
        let group: Vec<&ManifestFile> = files
            .iter()
            .filter(|file| file.kind == kind && is_source(file, Source::Modrinth))
            .collect();
        if group.is_empty() {
            continue;
        }
        let mut latest: HashMap<String, MrVersion> = fetch(
            http.client
                .post(format!("{MODRINTH}/version_files/update"))
                .json(&json!({
                    "hashes": group.iter().map(|file| &file.sha1).collect::<Vec<_>>(),
                    "algorithm": "sha1",
                    "loaders": modrinth_loaders(kind, target.loader),
                    "game_versions": [target.minecraft],
                })),
        )
        .await?;
        for file in group {
            if let Some(version) = latest.remove(&file.sha1).and_then(modrinth_version) {
                if file.meta.as_ref().is_some_and(|meta| meta.version_id != version.id) {
                    updates.push(Update {
                        path: file.path.clone(),
                        latest: version,
                    });
                }
            }
        }
    }
    Ok(updates)
}

async fn curseforge_updates(
    http: &Http<'_>,
    store: &Path,
    files: &[ManifestFile],
    target: Target<'_>,
) -> Result<Vec<Update>> {
    let group: Vec<&ManifestFile> = files.iter().filter(|file| is_source(file, Source::Curseforge)).collect();
    if group.is_empty() {
        return Ok(vec![]);
    }
    let prints: Vec<(ManifestFile, u32)> = stream::iter(group.into_iter().cloned())
        .map(|file| async move {
            let print = fingerprint(http.client, store, &file).await?;
            Ok::<_, anyhow::Error>((file, print))
        })
        .buffer_unordered(4)
        .try_collect()
        .await?;
    let response: Data<CfMatches> = fetch(
        http.client
            .post(api("/cf/fingerprints"))
            .bearer_auth(http.token)
            .json(&json!({ "fingerprints": prints.iter().map(|(_, print)| print).collect::<Vec<_>>() })),
    )
    .await?;
    let mut updates = vec![];
    for (file, print) in prints {
        let Some(found) = response
            .data
            .exact_matches
            .iter()
            .find(|found| found.file.file_fingerprint == print)
        else {
            continue;
        };
        let newest = found
            .latest_files
            .iter()
            .filter(|latest| {
                latest.game_versions.iter().any(|version| version == target.minecraft)
                    && (file.kind != Kind::Mod
                        || latest
                            .game_versions
                            .iter()
                            .any(|version| version.eq_ignore_ascii_case(target.loader.name())))
            })
            .max_by(|a, b| a.file_date.cmp(&b.file_date))
            .filter(|latest| latest.file_date > found.file.file_date)
            .and_then(|latest| curseforge_version(latest.clone()));
        if let Some(latest) = newest {
            updates.push(Update {
                path: file.path.clone(),
                latest,
            });
        }
    }
    Ok(updates)
}

async fn fingerprint(client: &Client, store: &Path, file: &ManifestFile) -> Result<u32> {
    let bytes = match tokio::fs::read(store.join(&file.sha1)).await {
        Ok(bytes) => bytes,
        Err(_) => download::get(client, &file.url).await?.bytes().await?.to_vec(),
    };
    Ok(murmur2(&bytes))
}

fn murmur2(data: &[u8]) -> u32 {
    const M: u32 = 0x5bd1_e995;
    let data: Vec<u8> = data.iter().copied().filter(|byte| !matches!(byte, 9 | 10 | 13 | 32)).collect();
    let mut hash = 1 ^ data.len() as u32;
    let (chunks, tail) = data.as_chunks::<4>();
    for chunk in chunks {
        let mut k = u32::from_le_bytes(*chunk).wrapping_mul(M);
        k ^= k >> 24;
        hash = hash.wrapping_mul(M) ^ k.wrapping_mul(M);
    }
    if !tail.is_empty() {
        for (index, byte) in tail.iter().enumerate() {
            hash ^= (*byte as u32) << (8 * index);
        }
        hash = hash.wrapping_mul(M);
    }
    hash ^= hash >> 13;
    hash = hash.wrapping_mul(M);
    hash ^ (hash >> 15)
}

fn is_source(file: &ManifestFile, source: Source) -> bool {
    file.meta.as_ref().is_some_and(|meta| meta.source == source)
}

fn first_author(authors: &[CfAuthor]) -> String {
    authors.first().map(|author| author.name.clone()).unwrap_or_default()
}

fn modrinth_loaders(kind: Kind, loader: LoaderKind) -> Vec<&'static str> {
    match kind {
        Kind::Mod => vec![loader.name()],
        Kind::Resourcepack => vec!["minecraft"],
        Kind::Shader => vec!["iris", "optifine", "canvas", "vanilla"],
        Kind::Config => vec![],
    }
}

fn curseforge_loader(loader: LoaderKind) -> u8 {
    match loader {
        LoaderKind::Vanilla => 0,
        LoaderKind::Forge => 1,
        LoaderKind::Fabric => 4,
        LoaderKind::NeoForge => 6,
    }
}

fn modrinth_version(version: MrVersion) -> Option<Version> {
    let index = version.files.iter().position(|file| file.primary).unwrap_or(0);
    let file = version.files.into_iter().nth(index)?;
    Some(Version {
        id: version.id,
        name: version.name,
        file_name: file.filename,
        sha1: file.hashes.sha1,
        size: file.size,
        url: Some(file.url),
        date: version.date_published,
        game_versions: version.game_versions,
        loaders: version.loaders,
        dependencies: version
            .dependencies
            .into_iter()
            .filter_map(|dependency| {
                let required = match dependency.dependency_type.as_str() {
                    "required" => true,
                    "optional" => false,
                    _ => return None,
                };
                Some(Dependency {
                    project_id: dependency.project_id?,
                    required,
                })
            })
            .collect(),
    })
}

fn curseforge_version(file: CfFile) -> Option<Version> {
    let sha1 = file.hashes.iter().find(|hash| hash.algo == 1)?.value.clone();
    let (loaders, game_versions): (Vec<String>, Vec<String>) = file
        .game_versions
        .into_iter()
        .partition(|version| !version.starts_with(|c: char| c.is_ascii_digit()));
    Some(Version {
        id: file.id.to_string(),
        name: file.display_name,
        file_name: file.file_name,
        sha1,
        size: file.file_length,
        url: file.download_url.filter(|url| !url.is_empty()),
        date: file.file_date,
        game_versions,
        loaders,
        dependencies: file
            .dependencies
            .into_iter()
            .filter(|dependency| matches!(dependency.relation_type, 2 | 3))
            .map(|dependency| Dependency {
                project_id: dependency.mod_id.to_string(),
                required: dependency.relation_type == 3,
            })
            .collect(),
    })
}

#[derive(Deserialize)]
struct Data<T> {
    data: T,
}

#[derive(Deserialize)]
struct MrSearch {
    hits: Vec<MrHit>,
}

#[derive(Deserialize)]
struct MrHit {
    project_id: String,
    title: String,
    description: String,
    author: String,
    icon_url: Option<String>,
    downloads: u64,
    categories: Vec<String>,
}

#[derive(Deserialize)]
struct MrProject {
    id: String,
    slug: String,
    title: String,
    description: String,
    body: String,
    icon_url: Option<String>,
    #[serde(default)]
    gallery: Vec<MrImage>,
    project_type: String,
}

#[derive(Deserialize)]
struct MrImage {
    url: String,
}

#[derive(Deserialize)]
struct MrMember {
    role: String,
    user: MrUser,
}

#[derive(Deserialize)]
struct MrUser {
    username: String,
}

#[derive(Deserialize)]
struct MrVersion {
    id: String,
    name: String,
    date_published: String,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    files: Vec<MrFile>,
    dependencies: Vec<MrDependency>,
}

#[derive(Deserialize)]
struct MrFile {
    hashes: MrHashes,
    url: String,
    filename: String,
    primary: bool,
    size: u64,
}

#[derive(Deserialize)]
struct MrHashes {
    sha1: String,
}

#[derive(Deserialize)]
struct MrDependency {
    project_id: Option<String>,
    dependency_type: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CfMod {
    id: u64,
    name: String,
    summary: String,
    #[serde(default)]
    authors: Vec<CfAuthor>,
    #[serde(default)]
    download_count: f64,
    logo: Option<CfImage>,
    #[serde(default)]
    screenshots: Vec<CfImage>,
    #[serde(default)]
    links: CfLinks,
    #[serde(default)]
    latest_files_indexes: Vec<CfIndex>,
}

#[derive(Deserialize)]
struct CfAuthor {
    name: String,
}

#[derive(Deserialize)]
struct CfImage {
    url: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CfLinks {
    website_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CfIndex {
    game_version: String,
    mod_loader: Option<u8>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CfFile {
    id: u64,
    display_name: String,
    file_name: String,
    file_date: String,
    file_length: u64,
    download_url: Option<String>,
    #[serde(default)]
    file_fingerprint: u32,
    #[serde(default)]
    hashes: Vec<CfHash>,
    #[serde(default)]
    game_versions: Vec<String>,
    #[serde(default)]
    dependencies: Vec<CfDependency>,
}

#[derive(Deserialize, Clone)]
struct CfHash {
    value: String,
    algo: u8,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CfDependency {
    mod_id: u64,
    relation_type: u8,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CfMatches {
    exact_matches: Vec<CfMatch>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CfMatch {
    file: CfFile,
    latest_files: Vec<CfFile>,
}
