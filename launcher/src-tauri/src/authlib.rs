use anyhow::Result;
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::future::join;

use crate::download::{get, Ctx, Task};

const JAR_URL: &str =
    "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.8/authlib-injector-1.2.8.jar";
const JAR_SHA1: &str = "0e0e66d8a4f91a26f33b9c09f5cdffce4a11f0b8";
const JAR_SIZE: u64 = 349_681;
const YGGDRASIL_URL: &str = concat!(env!("API_URL"), "/api/yggdrasil");

pub async fn jvm_args(ctx: &Ctx) -> Result<Vec<String>> {
    let jar = ctx.root.join("authlib-injector-1.2.8.jar");
    let (jar_result, metadata) = join(ensure_jar(ctx, &jar), metadata(ctx)).await;
    jar_result?;
    let mut args = vec![format!("-javaagent:{}={YGGDRASIL_URL}", jar.display())];
    if let Some(metadata) = metadata {
        args.push(format!(
            "-Dauthlibinjector.yggdrasil.prefetched={}",
            STANDARD.encode(metadata)
        ));
    }
    Ok(args)
}

async fn ensure_jar(ctx: &Ctx, jar: &std::path::Path) -> Result<()> {
    if tokio::fs::metadata(jar)
        .await
        .is_ok_and(|m| m.len() == JAR_SIZE)
    {
        return Ok(());
    }
    let task = Task {
        url: JAR_URL.to_owned(),
        path: jar.to_owned(),
        sha1: Some(JAR_SHA1.to_owned()),
        size: JAR_SIZE,
    };
    ctx.download("authlib", "authlib-injector", vec![task])
        .await
}

async fn metadata(ctx: &Ctx) -> Option<String> {
    let cache = ctx.root.join("authlib-yggdrasil.json");
    match fetch_metadata(ctx).await {
        Ok(text) => {
            let _ = tokio::fs::write(&cache, &text).await;
            Some(text)
        }
        Err(_) => tokio::fs::read_to_string(&cache).await.ok(),
    }
}

async fn fetch_metadata(ctx: &Ctx) -> Result<String> {
    Ok(get(&ctx.client, YGGDRASIL_URL).await?.text().await?)
}
