use anyhow::{bail, Result};
use reqwest::{
    multipart::{Form, Part},
    Client, RequestBuilder, Response, StatusCode,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize, Serializer};
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::{account, launch::Loader, AppState};

pub const BASE: &str = env!("API_URL");

pub struct CmdError(anyhow::Error);

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tokens {
    pub access_token: String,
    pub client_token: String,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Pending,
    User,
    Admin,
}

#[derive(Serialize, Deserialize)]
pub struct Skin {
    url: String,
    model: String,
}

#[derive(Serialize, Deserialize)]
pub struct Me {
    pub id: String,
    pub name: String,
    pub role: Role,
    skin: Option<Skin>,
}

#[derive(Serialize, Deserialize)]
pub struct Pack {
    id: String,
    name: String,
    theme: Value,
    minecraft: String,
    loader: Value,
    version: String,
    size: u64,
    server: Value,
}

#[derive(Serialize, Deserialize)]
pub struct Manifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub minecraft: String,
    pub loader: Loader,
    pub java: Option<u32>,
    #[serde(default)]
    pub server: Option<String>,
    #[serde(default)]
    pub theme: Value,
    pub files: Vec<ManifestFile>,
    #[serde(default)]
    changelog: Vec<ChangelogEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
    pub side: Side,
    pub kind: Kind,
    #[serde(default)]
    pub optional: bool,
    #[serde(default)]
    pub default_enabled: bool,
    pub policy: Policy,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<Meta>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub title: String,
    pub author: String,
    pub description: String,
    pub icon_url: String,
    pub gallery: Vec<String>,
    pub page_url: String,
    pub source: Source,
    pub project_id: String,
    pub version_id: String,
    pub dependencies: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Mod,
    Resourcepack,
    Shader,
    Config,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Modrinth,
    Curseforge,
    Manual,
    Local,
    Custom,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Client,
    Server,
    Both,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Policy {
    Managed,
    Once,
}

#[derive(Serialize, Deserialize)]
struct ChangelogEntry {
    kind: String,
    text: String,
}

#[derive(Serialize, Deserialize)]
pub struct ServerStatus {
    online: bool,
    #[serde(default)]
    players: Players,
    ping: Option<f64>,
}

#[derive(Serialize, Deserialize, Default)]
struct Players {
    online: u32,
    max: u32,
    sample: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApiError {
    error_message: Option<String>,
}

impl<E: Into<anyhow::Error>> From<E> for CmdError {
    fn from(error: E) -> Self {
        Self(error.into())
    }
}

impl Serialize for CmdError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&format!("{:#}", self.0))
    }
}

#[tauri::command]
pub async fn list_packs(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<Pack>, CmdError> {
    let (token, _) = account::signed_in(&app, &state).await?;
    Ok(fetch(state.client.get(api("/packs")).bearer_auth(token)).await?)
}

#[tauri::command]
pub async fn pack_manifest(
    app: AppHandle,
    state: State<'_, AppState>,
    pack_id: String,
) -> Result<Manifest, CmdError> {
    let (token, _) = account::signed_in(&app, &state).await?;
    Ok(manifest(&state.client, &token, &pack_id).await?)
}

#[tauri::command]
pub async fn server_status(state: State<'_, AppState>) -> Result<ServerStatus, CmdError> {
    Ok(fetch(state.client.get(api("/server/status"))).await?)
}

pub async fn manifest(client: &Client, token: &str, pack_id: &str) -> Result<Manifest> {
    fetch(
        client
            .get(api(&format!("/packs/{pack_id}/manifest")))
            .bearer_auth(token),
    )
    .await
}

pub async fn authenticate(client: &Client, username: &str, password: &str) -> Result<Tokens> {
    fetch(client.post(yggdrasil("/authserver/authenticate")).json(&json!({
        "agent": { "name": "Minecraft", "version": 1 },
        "username": username,
        "password": password,
        "requestUser": true,
    })))
    .await
}

pub async fn register(client: &Client, username: &str, password: &str) -> Result<Tokens> {
    fetch(
        client
            .post(api("/auth/register"))
            .json(&json!({ "username": username, "password": password })),
    )
    .await
}

pub async fn refresh(client: &Client, tokens: &Tokens) -> Result<Tokens> {
    fetch(client.post(yggdrasil("/authserver/refresh")).json(tokens)).await
}

pub async fn validate(client: &Client, tokens: &Tokens) -> Result<bool> {
    let status = client
        .post(yggdrasil("/authserver/validate"))
        .json(tokens)
        .send()
        .await?
        .status();
    match status {
        s if s.is_success() => Ok(true),
        StatusCode::FORBIDDEN | StatusCode::UNAUTHORIZED => Ok(false),
        s => bail!("token validation failed: {s}"),
    }
}

pub async fn invalidate(client: &Client, tokens: &Tokens) -> Result<()> {
    send(client.post(yggdrasil("/authserver/invalidate")).json(tokens)).await?;
    Ok(())
}

pub async fn me(client: &Client, token: &str) -> Result<Me> {
    fetch(client.get(api("/me")).bearer_auth(token)).await
}

pub async fn upload_skin(
    client: &Client,
    token: &str,
    bytes: Vec<u8>,
    model: String,
) -> Result<()> {
    let file = Part::bytes(bytes)
        .file_name("skin.png")
        .mime_str("image/png")?;
    send(
        client
            .put(api("/me/skin"))
            .bearer_auth(token)
            .multipart(Form::new().part("file", file).text("model", model)),
    )
    .await?;
    Ok(())
}

pub async fn reset_skin(client: &Client, token: &str) -> Result<()> {
    send(client.delete(api("/me/skin")).bearer_auth(token)).await?;
    Ok(())
}

pub fn api(path: &str) -> String {
    format!("{BASE}/api{path}")
}

fn yggdrasil(path: &str) -> String {
    api(&format!("/yggdrasil{path}"))
}

pub async fn fetch<T: DeserializeOwned>(request: RequestBuilder) -> Result<T> {
    Ok(send(request).await?.json().await?)
}

pub async fn send(request: RequestBuilder) -> Result<Response> {
    let response = request.send().await?;
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let message = response
        .json::<ApiError>()
        .await
        .ok()
        .and_then(|e| e.error_message);
    bail!(message.unwrap_or_else(|| status.to_string()))
}
