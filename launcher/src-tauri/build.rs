use std::{env, fs};

fn main() {
    println!("cargo:rerun-if-env-changed=API_URL");
    println!("cargo:rerun-if-changed=../../.env");
    let api_url = env::var("API_URL")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(from_env_file)
        .expect("API_URL is not set: define it in the environment or in the root .env (see .env.example in the repo root)");
    println!("cargo:rustc-env=API_URL={}", api_url.trim_end_matches('/'));
    tauri_build::build()
}

fn from_env_file() -> Option<String> {
    fs::read_to_string("../../.env").ok()?.lines().find_map(|line| {
        let (key, value) = line.split_once('=')?;
        let value = value.trim().trim_matches(['"', '\'']);
        (key.trim() == "API_URL" && !value.is_empty()).then(|| value.to_string())
    })
}
