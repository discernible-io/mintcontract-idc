// Copyright (c) 2026 Discernible IO
// SPDX-License-Identifier: AGPL-3.0-only

use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=account.env");

    let env_contents = fs::read_to_string("account.env")
        .expect("account.env must exist in the project root");

    for line in env_contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim();
            if key == "CONTRACT_NAME" {
                let account_name = value.strip_suffix(".near").unwrap_or(value);
                println!("cargo:rustc-env=CONTRACT_ACCOUNT_NAME={account_name}");
            }
        }
    }
}
