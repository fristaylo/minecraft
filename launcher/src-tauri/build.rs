use std::{env, fs};

fn main() {
    println!("cargo:rerun-if-changed=../../.env");
    for key in ["API_URL", "MODS_REPO"] {
        println!("cargo:rerun-if-env-changed={key}");
        let value = env::var(key)
            .ok()
            .filter(|value| !value.is_empty())
            .or_else(|| from_env_file(key))
            .unwrap_or_else(|| panic!("{key} is not set: define it in the environment or in the root .env (see .env.example in the repo root)"));
        println!("cargo:rustc-env={key}={}", value.trim_end_matches('/'));
    }
    tauri_build::build()
}

fn from_env_file(name: &str) -> Option<String> {
    fs::read_to_string("../../.env").ok()?.lines().find_map(|line| {
        let (key, value) = line.split_once('=')?;
        let value = value.trim().trim_matches(['"', '\'']);
        (key.trim() == name && !value.is_empty()).then(|| value.to_string())
    })
}
