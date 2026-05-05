const n=`---
title: "Simple Chat Server in Rust via Telnet"
date: 2023-09-19
id: blog0180
tag: rust
intro: "Study of Tokio by building a chat server."
toc: false
---

\`\`\`rust
use std::{net::SocketAddr, sync::Arc};

use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::TcpListener,
    sync::broadcast,
};

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("localhost:8080").await.unwrap();
    let (tx, _rx) = broadcast::channel::<(String, SocketAddr)>(10);
    let tx_ptr = Arc::new(tx);
    loop {
        let (mut socket, addr) = listener.accept().await.unwrap();
        let tx_ptr = tx_ptr.clone();

        tokio::spawn(async move {
            let (reader, mut writer) = socket.split();
            let tx_ptr = tx_ptr.clone();

            let mut reader = BufReader::new(reader);
            let mut line = String::new();
            let mut rx = tx_ptr.subscribe();
            loop {
                tokio::select! {
                    result = reader.read_line(&mut line) => {
                            if result.unwrap() == 0 {
                                break;
                            }
                            tx_ptr.send((line.clone(), addr)).unwrap();
                            line.clear();
                        }
                    result = (&mut rx).recv() => {
                        let (msg, other_addr) = result.unwrap();
                        if !addr.eq(&other_addr) {
                            writer.write_all(msg.as_bytes()).await.unwrap();
                        }
                    }
                };
            }
        });
    }
}

\`\`\`
`;export{n as default};
