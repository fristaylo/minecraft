use anyhow::Result;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;

use crate::download::{get, get_json, Ctx, Task};

const LATEST_URL: &str = "https://authlib-injector.yushi.moe/artifact/latest.json";
const YGGDRASIL_URL: &str = concat!(env!("API_URL"), "/api/yggdrasil");

#[derive(Deserialize)]
struct Latest {
    version: String,
    download_url: String,
}

pub async fn jvm_args(ctx: &Ctx) -> Result<Vec<String>> {
    ctx.progress("authlib", "authlib-injector", 0, 1);
    let latest: Latest = get_json(&ctx.client, LATEST_URL).await?;
    let jar = ctx
        .root
        .join(format!("authlib-injector-{}.jar", latest.version));
    let task = Task {
        url: latest.download_url,
        path: jar.clone(),
        sha1: None,
        size: 0,
    };
    ctx.download("authlib", "authlib-injector", vec![task]).await?;
    let metadata = get(&ctx.client, YGGDRASIL_URL).await?.text().await?;
    Ok(vec![
        format!("-javaagent:{}={YGGDRASIL_URL}", jar.display()),
        format!(
            "-Dauthlibinjector.yggdrasil.prefetched={}",
            STANDARD.encode(metadata)
        ),
    ])
}
