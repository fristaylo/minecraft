mod account;
mod admin;
mod api;
mod authlib;
mod catalog;
mod download;
mod java;
mod launch;
mod loader;
mod minecraft;
mod settings;
mod sync;
mod update;

use std::{sync::Mutex, time::Duration};
use tokio::sync::Mutex as AsyncMutex;
use tauri::Manager;
use tokio_util::sync::CancellationToken;

pub struct AppState {
    pub settings: Mutex<settings::Settings>,
    pub client: reqwest::Client,
    pub cancel: Mutex<CancellationToken>,
    pub game_stop: Mutex<Option<CancellationToken>>,
    pub account: Mutex<Option<api::Tokens>>,
    pub refresh: AsyncMutex<()>,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.manage(AppState {
                settings: Mutex::new(settings::load(app.handle())),
                client: reqwest::Client::builder()
                    .user_agent(concat!("launcher/", env!("CARGO_PKG_VERSION")))
                    .connect_timeout(Duration::from_secs(15))
                    .build()?,
                cancel: Mutex::new(CancellationToken::new()),
                game_stop: Mutex::new(None),
                account: Mutex::new(account::load(app.handle())),
                refresh: AsyncMutex::new(()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            settings::get_settings,
            settings::save_settings,
            settings::system_memory,
            download::cancel_launch,
            launch::launch,
            launch::stop_game,
            api::list_packs,
            api::pack_manifest,
            api::server_status,
            account::login,
            account::register,
            account::logout,
            account::current_account,
            account::upload_skin,
            account::reset_skin,
            account::list_skins,
            account::set_catalog_skin,
            sync::play,
            sync::set_optional,
            sync::local_pack_state,
            sync::reset_configs,
            update::check_update,
            update::install_update,
            admin::admin_packs,
            admin::create_pack,
            admin::set_pack_meta,
            admin::delete_pack,
            admin::admin_draft,
            admin::add_project,
            admin::remove_entry,
            admin::set_side,
            admin::move_resourcepack,
            admin::admin_set_optional,
            admin::set_policy,
            admin::check_updates,
            admin::apply_update,
            admin::open_manual_download,
            admin::add_config_files,
            admin::add_local_mod,
            admin::publish,
            admin::list_users,
            admin::set_role,
            admin::delete_user,
            admin::mineskin_search,
            admin::mojang_skin,
            admin::import_catalog_skin,
            admin::upload_catalog_skin,
            admin::delete_catalog_skin,
            admin::set_user_skin_file,
            admin::set_user_skin_catalog,
            admin::set_user_skin_import,
            admin::reset_user_skin,
            catalog::search,
            catalog::project_details,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
