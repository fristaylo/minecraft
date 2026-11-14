use anyhow::{anyhow, Result};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};

use crate::api::{self, CmdError, Me, Tokens};
use crate::AppState;

const FILE: &str = "accounts.json";

pub fn load(app: &AppHandle) -> Option<Tokens> {
    app.path()
        .app_data_dir()
        .ok()
        .and_then(|dir| std::fs::read(dir.join(FILE)).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
}

#[tauri::command]
pub async fn login(
    app: AppHandle,
    state: State<'_, AppState>,
    username: String,
    password: String,
) -> Result<Me, CmdError> {
    let tokens = api::authenticate(&state.client, &username, &password).await?;
    sign_in(&app, &state, tokens).await
}

#[tauri::command]
pub async fn register(
    app: AppHandle,
    state: State<'_, AppState>,
    username: String,
    password: String,
) -> Result<Me, CmdError> {
    let tokens = api::register(&state.client, &username, &password).await?;
    sign_in(&app, &state, tokens).await
}

#[tauri::command]
pub async fn logout(app: AppHandle, state: State<'_, AppState>) -> Result<(), CmdError> {
    let tokens = state.account.lock().unwrap().clone();
    if let Some(tokens) = tokens {
        let _ = api::invalidate(&state.client, &tokens).await;
    }
    save(&app, &state, None)?;
    Ok(())
}

#[tauri::command]
pub async fn current_account(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<Me>, CmdError> {
    Ok(session(&app, &state).await?.map(|(_, me)| me))
}

#[tauri::command]
pub async fn upload_skin(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    model: String,
) -> Result<Me, CmdError> {
    let (token, _) = signed_in(&app, &state).await?;
    api::upload_skin(&state.client, &token, tokio::fs::read(path).await?, model).await?;
    Ok(api::me(&state.client, &token).await?)
}

#[tauri::command]
pub async fn reset_skin(app: AppHandle, state: State<'_, AppState>) -> Result<Me, CmdError> {
    let (token, _) = signed_in(&app, &state).await?;
    api::reset_skin(&state.client, &token).await?;
    Ok(api::me(&state.client, &token).await?)
}

#[tauri::command]
pub async fn list_skins(app: AppHandle, state: State<'_, AppState>) -> Result<Value, CmdError> {
    let (token, _) = signed_in(&app, &state).await?;
    Ok(api::fetch(state.client.get(api::api("/skins")).bearer_auth(token)).await?)
}

#[tauri::command]
pub async fn set_catalog_skin(app: AppHandle, state: State<'_, AppState>, id: u32) -> Result<Me, CmdError> {
    let (token, _) = signed_in(&app, &state).await?;
    api::set_catalog_skin(&state.client, &token, id).await?;
    Ok(api::me(&state.client, &token).await?)
}

pub async fn signed_in(app: &AppHandle, state: &AppState) -> Result<(String, Me)> {
    session(app, state)
        .await?
        .ok_or_else(|| anyhow!("Sign in to your account first"))
}

async fn session(app: &AppHandle, state: &AppState) -> Result<Option<(String, Me)>> {
    let guard = state.refresh.lock().await;
    let stored = state.account.lock().unwrap().clone();
    let Some(mut tokens) = stored else {
        return Ok(None);
    };
    if !api::validate(&state.client, &tokens).await? {
        match api::refresh(&state.client, &tokens).await {
            Ok(fresh) => {
                tokens = fresh;
                save(app, state, Some(tokens.clone()))?;
            }
            Err(_) => {
                save(app, state, None)?;
                return Ok(None);
            }
        }
    }
    drop(guard);
    let me = api::me(&state.client, &tokens.access_token).await?;
    Ok(Some((tokens.access_token, me)))
}

async fn sign_in(app: &AppHandle, state: &AppState, tokens: Tokens) -> Result<Me, CmdError> {
    let me = api::me(&state.client, &tokens.access_token).await?;
    save(app, state, Some(tokens))?;
    Ok(me)
}

fn save(app: &AppHandle, state: &AppState, tokens: Option<Tokens>) -> Result<()> {
    let path = app.path().app_data_dir()?.join(FILE);
    match &tokens {
        Some(tokens) => {
            std::fs::create_dir_all(path.parent().unwrap())?;
            std::fs::write(path, serde_json::to_vec_pretty(tokens)?)?;
        }
        None => {
            let _ = std::fs::remove_file(path);
        }
    }
    *state.account.lock().unwrap() = tokens;
    Ok(())
}
