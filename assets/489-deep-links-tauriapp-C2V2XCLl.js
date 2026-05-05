const e=`---
title: "Deep-Links and Caveats in MacOS Desktop Application"
date: 2026-04-26
id: blog0489
tag: rust, tauri, react, deep-link
toc: true
intro: "Study on deek link in macOS"
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>

### The Custom Scheme

Custom URL scheme: \`tauri-shellscript-manager://\`

Example: \`tauri-shellscript-manager://open?scriptId=87\`


### How It Works (End-to-End)

\`\`\`plantuml
@startuml
skinparam defaultFontName Helvetica
skinparam defaultFontSize 16
skinparam ArrowColor #555555
skinparam RectangleBorderColor #888888
skinparam RectangleBackgroundColor #F9F9F9
skinparam RectangleRoundCorner 20

rectangle "open \\"tauri-shellscript-manager://open?scriptId=87\\"" as CMD
rectangle "macOS LaunchServices\\nLooks up registered handler\\n→ dispatches Apple Event to the app" as LS
rectangle "NSApplicationDelegate\\napplication:openURLs:\\n(TauriAppDelegate in lib.rs)\\nReads NSURL array → extracts URL strings" as DELEGATE
rectangle "APP_HANDLE.emit(\\n  \\"deep-link://new-url\\", url_strings\\n)" as EMIT
rectangle "JS frontend (App.tsx)\\nonOpenUrl() receives URLs\\nParses pathname + query params\\nCalls invoke(\\"write_and_open_html\\", ...)" as JS

CMD -down-> LS
LS -down-> DELEGATE
DELEGATE -down-> EMIT
EMIT -down-> JS
@enduml
\`\`\`

### Setup Checklist

#### tauri.conf.json

\`\`\`json
"plugins": {
    "deep-link": {
        "desktop": {
            "schemes": ["tauri-shellscript-manager"]
        }
    }
}
\`\`\`

Permission must be present in the \`main-window\` capability:

\`\`\`json
"deep-link:default"
\`\`\`

\`deep-link:default\` is a Tauri **ACL permission bundle** defined by the plugin
itself. Tauri 2.x denies every plugin IPC command to the WebView by default;
plugins ship named permission sets that grant groups of commands per window.

\`deep-link:default\` specifically allows the WebView to call:

| Command | JS API | Purpose |
|---|---|---|
| \`get_current_url\` | \`getCurrent()\` | Read the URL that launched the app (cold-start) |
| \`is_registered\` | \`isRegistered()\` | Check whether a scheme is registered |

\`onOpenUrl\` does **not** need this permission — it subscribes to the
\`deep-link://new-url\` **event** that Rust emits, and events bypass the ACL.
But \`getCurrent()\` is a \`tauri::command\` invoke, so without \`deep-link:default\`
in the capability list it throws \`"Command get_current_url not found"\`.

#### \`getCurrent()\` vs \`onOpenUrl\` — cold-start vs already-running

There are two scenarios when a deep link fires:

- **App already running** — \`onOpenUrl\` catches it. The listener is registered
  and the event arrives normally.
- **App not yet running (cold-start)** — macOS launches the app *because of*
  the deep link. By the time React mounts and \`onOpenUrl\` registers its
  listener, the initial URL event has already been delivered at the Rust/tao
  level and is gone. The callback never fires because the listener didn't
  exist yet.

\`getCurrent()\` solves the cold-start case. Call it once on startup: if it
returns a URL, the app was opened by a deep link; if it returns \`null\`, the
app was launched normally.

Together they cover both cases:

\`\`\`tsx
useEffect(() => {
    // Cold-start: app was launched by a deep link
    getCurrent().then((url) => {
        if (url) handleDeepLink(url);
    });

    // Hot: deep link fired while app was already running
    let unlisten: (() => void) | undefined;
    onOpenUrl((urls) => {
        urls.forEach(handleDeepLink);
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
}, []);


#### Cargo.toml

\`\`\`toml
tauri-plugin-deep-link = "2"
\`\`\`

#### lib.rs — Plugin must be registered

\`\`\`rust
.plugin(tauri_plugin_deep_link::init())
\`\`\`

#### lib.rs — Custom delegate MUST implement \`application:openURLs:\`

The \`lib.rs\` Of Concern:

- https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/src-tauri/src/lib.rs#L1349

This project uses a custom \`TauriAppDelegate\` (to intercept \`Cmd+Q\` via
\`applicationShouldTerminate:\`). 

<item>

**Problem.** Replacing the default tao delegate also
removes \`application:openURLs:\`, which silently drops all deep link events.

</item>

The fix is to add \`application:openURLs:\` directly to \`TauriAppDelegate\`:

\`\`\`rust
extern "C" fn open_urls(_this: &Object, _cmd: Sel, _app: id, urls: id) {
    use cocoa::foundation::NSString;
    let mut url_strings: Vec<String> = Vec::new();
    unsafe {
        let count: usize = msg_send![urls, count];
        for i in 0..count {
            let url: id = msg_send![urls, objectAtIndex: i];
            let ns_string: id = msg_send![url, absoluteString];
            let c_str = NSString::UTF8String(ns_string);
            if let Ok(s) = std::ffi::CStr::from_ptr(c_str).to_str() {
                url_strings.push(s.to_string());
            }
        }
    }
    if let Some(app_handle) = APP_HANDLE.get() {
        let _ = app_handle.emit("deep-link://new-url", url_strings);
    }
}

decl.add_method(
    sel!(application:openURLs:),
    open_urls as extern "C" fn(&Object, Sel, id, id),
);
\`\`\`

#### App.tsx — JS listener

\`onOpenUrl\` is imported from \`@tauri-apps/plugin-deep-link\`. It subscribes to
the \`deep-link://new-url\` IPC event that the Rust side emits (either through
tao's default delegate, or — in our case — directly via \`APP_HANDLE.emit\`).

Under the hood \`onOpenUrl\`:

1. **Registers an IPC listener** in the WebView for the \`deep-link://new-url\`
   channel when the component first mounts.
2. **Receives the URL array** that Rust serialises and passes over Tauri's
   bridge. A single \`open\` command can carry more than one URL, hence the
   array.
3. **Returns an unlisten function** (similar to \`addEventListener\` returning a
   function you call to remove the listener). We should call it on unmount to
   avoid stale listeners accumulating across hot-reloads.

\`\`\`tsx
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

useEffect(() => {
    let unlisten: (() => void) | undefined;

    onOpenUrl((urls) => {
        for (const url of urls) {
            // The custom scheme ("tauri-shellscript-manager://") is not a
            // valid HTTP origin, so we swap it for a dummy http:// prefix
            // so that the standard URL constructor can parse pathname and
            // query params without throwing.
            const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\\/\\//i, "http://placeholder/");
            const parsed = new URL(withoutScheme);
            if (parsed.pathname === "/open") {
                const scriptId = parseInt(parsed.searchParams.get("scriptId") ?? "", 10);
                if (!isNaN(scriptId)) {
                    openMarkdownAsHtml(scriptId);
                }
            }
        }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
}, []);
\`\`\`

**Why the scheme-swap trick?** \`new URL("tauri-shellscript-manager://open?scriptId=87")\` throws
in most browsers because the scheme is unknown. Replacing the scheme with
\`http://placeholder/\` gives the parser a valid base URL and preserves pathname
(\`/open\`) and query string (\`?scriptId=87\`) exactly.

### Problems Encountered and Fixes

#### Problem 1 — LaunchServices database pollution

**Symptom**: \`open "tauri-shellscript-manager://..."\` does nothing. App doesn't receive the URL.

**Cause**: Every time a \`.dmg\` is opened (without ejecting), macOS registers
\`/Volumes/dmg.xxx/shell-script-manager.app\` as an additional URL handler. After
many test builds, 50+ stale entries accumulated. macOS dispatched Apple Events
to those stale, non-existent paths instead of \`/Applications/shell-script-manager.app\`.

**Fix**:

\`\`\`bash
# Rebuild the LS database
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \\
  -r -domain local -domain system -domain user

# Re-register only the correct app
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \\
  -f "/Applications/shell-script-manager.app"
\`\`\`

**Prevention**: Always eject the DMG after dragging to Applications. Or install
by copying directly from the build output:

\`\`\`bash
cp -R src-tauri/target/release/bundle/macos/shell-script-manager.app /Applications/
\`\`\`


#### Problem 2 — Custom NSApplicationDelegate swallows URL events (ROOT CAUSE)

**Symptom**: LS database is clean, app is running, \`onOpenUrl\` listener is
registered — but callback never fires.

**Cause**: \`setup_app_delegate()\` in \`lib.rs\` calls \`[NSApp setDelegate: TauriAppDelegate]\`.
This **completely replaces** tao's default delegate. tao's delegate is the one
that implements \`application:openURLs:\` to forward deep links into Tauri's
\`RunEvent::Opened\`. With only \`applicationShouldTerminate:\` on the custom
delegate, every deep link Apple Event was silently dropped.

**Fix**: Add \`application:openURLs:\` to \`TauriAppDelegate\` (see code above).
This emits \`deep-link://new-url\` directly via \`APP_HANDLE\`, which is the same
event the plugin would have emitted through tao.

> **Rule of thumb**: Any time we replace the \`NSApplicationDelegate\` in a
> Tauri app, we must re-implement every method tao relied on, or delegate
> to tao's original delegate via \`[super ...]\`.



#### Problem 3 — ACL permission missing

**Symptom**: \`getCurrent()\` / \`onOpenUrl\` throws an error like
\`"Command get_current_url not found"\`.

**Fix**: Add \`"deep-link:default"\` to the window's permissions in
\`tauri.conf.json\` under \`app.security.capabilities\`.



### Testing

\`\`\`bash
# Terminal — bypasses browser confirmation dialog
open "tauri-shellscript-manager://open?scriptId=87"

# Verify LS registration
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \\
  -dump 2>/dev/null | grep "tauri-shellscript-manager"

# Check for duplicate stale entries (should show only 1)
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \\
  -dump 2>/dev/null | grep "claimed schemes:" | grep "tauri-shellscript-manager" | wc -l
\`\`\`

When clicking a deep link in a browser (Safari/Chrome), the browser shows a
confirmation dialog — click **Allow/Open**. The terminal \`open\` command skips
this dialog, making it better for isolated testing.
`;export{e as default};
