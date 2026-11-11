use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::Instant,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

const MAX_FRAME_BYTES: usize = 4 * 1024 * 1024;
const MAX_EVENTS: usize = 2000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEvent {
    seq: u64,
    at: String,
    kind: String,
    method: String,
    params: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    request_id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    supported: Option<bool>,
}

#[derive(Serialize)]
struct WorkspaceInfo {
    name: String,
    path: String,
    branch: Option<String>,
    changes: usize,
}

struct RpcClient {
    child: Mutex<Child>,
    stdin: Mutex<ChildStdin>,
    next_id: Mutex<u64>,
    pending: Arc<Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>>,
    closed: Arc<Mutex<Option<String>>>,
}

impl RpcClient {
    fn spawn(
        binary: &str,
        args: &[&str],
        on_message: Arc<dyn Fn(Value) + Send + Sync>,
    ) -> Result<Arc<Self>, String> {
        let mut child = Command::new(binary)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| format!("Codex app-server error: {error}"))?;
        let stdin = child.stdin.take().ok_or("Codex stdin unavailable")?;
        let stdout = child.stdout.take().ok_or("Codex stdout unavailable")?;
        let stderr = child.stderr.take().ok_or("Codex stderr unavailable")?;
        let pending: Arc<Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let closed = Arc::new(Mutex::new(None));
        let client = Arc::new(Self {
            child: Mutex::new(child),
            stdin: Mutex::new(stdin),
            next_id: Mutex::new(1),
            pending: pending.clone(),
            closed: closed.clone(),
        });

        let message_callback = on_message.clone();
        let protocol_callback = on_message.clone();
        let close_callback = on_message.clone();
        let stdout_pending = pending.clone();
        let stdout_closed = closed.clone();
        thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let mut line = String::new();
                match reader.read_line(&mut line) {
                    Ok(0) => {
                        close_pending(
                            &stdout_pending,
                            &stdout_closed,
                            "Codex app-server closed (EOF)",
                        );
                        close_callback(
                            json!({"method":"transport/closed","params":{"message":"Codex app-server closed (EOF); pending mutations were not retried"},"_transport":true}),
                        );
                        break;
                    }
                    Ok(_) if line.len() > MAX_FRAME_BYTES => {
                        close_pending(
                            &stdout_pending,
                            &stdout_closed,
                            "Codex app-server sent an oversized frame",
                        );
                        break;
                    }
                    Ok(_) => match serde_json::from_str::<Value>(&line) {
                        Ok(message) => {
                            let response_id = message.get("id").and_then(Value::as_u64);
                            let is_response = message.get("method").is_none()
                                && (message.get("result").is_some()
                                    || message.get("error").is_some());
                            if is_response {
                                if let Some(id) = response_id {
                                    if let Some(sender) = stdout_pending.lock().unwrap().remove(&id)
                                    {
                                        let result = if let Some(error) = message.get("error") {
                                            Err(error.to_string())
                                        } else {
                                            Ok(message
                                                .get("result")
                                                .cloned()
                                                .unwrap_or(Value::Null))
                                        };
                                        let _ = sender.send(result);
                                    }
                                }
                            } else if message.get("method").and_then(Value::as_str).is_some() {
                                message_callback(message);
                            }
                        }
                        Err(_) => protocol_callback(
                            json!({"method":"transport/error","params":{"message":"Codex app-server sent invalid JSON"},"_transport":true}),
                        ),
                    },
                    Err(error) => {
                        close_pending(
                            &stdout_pending,
                            &stdout_closed,
                            &format!("Codex app-server read error: {error}"),
                        );
                        close_callback(
                            json!({"method":"transport/closed","params":{"message":format!("Codex app-server read error: {error}; pending mutations were not retried")},"_transport":true}),
                        );
                        break;
                    }
                }
            }
        });
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                on_message(
                    json!({"method":"transport/stderr","params":{"text":line},"_transport":true}),
                );
            }
        });
        Ok(client)
    }

    fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        if let Some(reason) = self.closed.lock().unwrap().clone() {
            return Err(reason);
        }
        let id = {
            let mut id = self.next_id.lock().unwrap();
            let value = *id;
            *id += 1;
            value
        };
        let (sender, receiver) = mpsc::channel();
        self.pending.lock().unwrap().insert(id, sender);
        if let Err(error) =
            self.write(json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}))
        {
            self.pending.lock().unwrap().remove(&id);
            return Err(error);
        }
        receiver.recv().map_err(|_| {
            "Codex response channel closed; pending mutations were not retried".to_string()
        })?
    }

    fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        self.write(json!({"jsonrpc":"2.0","method":method,"params":params}))
    }
    fn respond(&self, id: Value, result: Value) -> Result<(), String> {
        self.write(json!({"jsonrpc":"2.0","id":id,"result":result}))
    }
    fn write(&self, value: Value) -> Result<(), String> {
        let mut stdin = self.stdin.lock().unwrap();
        serde_json::to_writer(&mut *stdin, &value).map_err(|error| error.to_string())?;
        stdin
            .write_all(b"\n")
            .and_then(|_| stdin.flush())
            .map_err(|error| {
                format!("Codex write error: {error}; pending mutations were not retried")
            })
    }

    fn is_closed(&self) -> bool {
        self.closed.lock().unwrap().is_some()
    }
}

impl Drop for RpcClient {
    fn drop(&mut self) {
        let _ = self.child.lock().unwrap().kill();
    }
}

fn close_pending(
    pending: &Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>,
    closed: &Mutex<Option<String>>,
    reason: &str,
) {
    let uncertain = !pending.lock().unwrap().is_empty();
    let message = format!(
        "{reason}; pending mutations were not retried{}",
        if uncertain {
            " (outcome uncertain)"
        } else {
            ""
        }
    );
    *closed.lock().unwrap() = Some(message.clone());
    for (_, sender) in pending.lock().unwrap().drain() {
        let _ = sender.send(Err(message.clone()));
    }
}

struct Backend {
    app: AppHandle,
    workspace: PathBuf,
    rpc: Option<Arc<RpcClient>>,
    thread_started: bool,
    seq: u64,
    events: Vec<AppEvent>,
    approvals: HashSet<String>,
    approval_attempts: HashSet<String>,
    native_entry: Instant,
}

type BackendState = Mutex<Backend>;

fn id_key(id: &Value) -> Result<String, String> {
    match id {
        Value::String(value) => Ok(format!("s:{value}")),
        Value::Number(value) => Ok(format!("n:{value}")),
        _ => Err("Invalid request ID".into()),
    }
}

fn publish(
    backend: &mut Backend,
    kind: &str,
    method: String,
    params: Value,
    request_id: Option<Value>,
    supported: Option<bool>,
) {
    backend.seq += 1;
    let event = AppEvent {
        seq: backend.seq,
        at: now_iso8601(),
        kind: kind.into(),
        method,
        params,
        request_id,
        supported,
    };
    backend.events.push(event.clone());
    if backend.events.len() > MAX_EVENTS {
        backend.events.remove(0);
    }
    let _ = backend.app.emit("app:event", event);
}

fn connect(state: &BackendState) -> Result<Arc<RpcClient>, String> {
    if let Some(rpc) = state.lock().unwrap().rpc.clone() {
        if !rpc.is_closed() {
            return Ok(rpc);
        }
        state.lock().unwrap().rpc = None;
    }
    let app = state.lock().unwrap().app.clone();
    let callback = Arc::new(move |message: Value| {
        let state = app.state::<BackendState>();
        let mut backend = state.lock().unwrap();
        let method = message
            .get("method")
            .and_then(Value::as_str)
            .unwrap_or("transport/error")
            .to_string();
        let params = message.get("params").cloned().unwrap_or(Value::Null);
        if message.get("_transport").is_some() {
            publish(&mut backend, "transport", method, params, None, None);
            return;
        }
        let request_id = message
            .get("id")
            .cloned()
            .filter(|id| id.is_string() || id.is_number());
        if let Some(id) = request_id {
            let mut supported = matches!(
                method.as_str(),
                "item/commandExecution/requestApproval" | "item/fileChange/requestApproval"
            );
            if supported {
                let key = id_key(&id).unwrap();
                supported =
                    !backend.approval_attempts.contains(&key) && backend.approvals.insert(key);
            }
            publish(
                &mut backend,
                "request",
                method,
                params,
                Some(id),
                Some(supported),
            );
        } else {
            publish(&mut backend, "notification", method, params, None, None);
        }
    });
    let binary = std::env::var("WWW_CODEX_BIN").unwrap_or_else(|_| "codex".into());
    let rpc = RpcClient::spawn(&binary, &["app-server"], callback)?;
    rpc.request("initialize", json!({"clientInfo":{"name":"www","title":"WWW","version":"0.1.0"},"capabilities":{"experimentalApi":false}}))?;
    rpc.notify("initialized", json!({}))?;
    let mut backend = state.lock().unwrap();
    backend.rpc = Some(rpc.clone());
    publish(
        &mut backend,
        "transport",
        "transport/connected".into(),
        json!({}),
        None,
        None,
    );
    Ok(rpc)
}

#[tauri::command]
fn workspace(state: State<BackendState>) -> WorkspaceInfo {
    workspace_info(&state.lock().unwrap().workspace)
}

#[tauri::command]
fn choose_workspace(
    app: AppHandle,
    state: State<BackendState>,
) -> Result<Option<WorkspaceInfo>, String> {
    if state.lock().unwrap().thread_started {
        return Err("작업 폴더는 첫 스레드 전에만 변경할 수 있습니다.".into());
    }
    let selected = app.dialog().file().blocking_pick_folder();
    let Some(path) = selected.and_then(|path| path.into_path().ok()) else {
        return Ok(None);
    };
    state.lock().unwrap().workspace = path.clone();
    Ok(Some(workspace_info(&path)))
}

#[tauri::command]
fn start_thread(state: State<BackendState>) -> Result<Value, String> {
    let rpc = connect(&state)?;
    let cwd = state
        .lock()
        .unwrap()
        .workspace
        .to_string_lossy()
        .into_owned();
    let result = rpc.request(
        "thread/start",
        json!({"cwd":cwd,"approvalPolicy":"on-request","sandbox":"workspace-write"}),
    )?;
    let id = result
        .pointer("/thread/id")
        .and_then(Value::as_str)
        .ok_or("Invalid thread ID")?;
    state.lock().unwrap().thread_started = true;
    Ok(json!({"threadId":id}))
}

#[tauri::command]
fn start_turn(
    thread_id: String,
    text: String,
    state: State<BackendState>,
) -> Result<Value, String> {
    let text = text.trim().to_string();
    if thread_id.is_empty() {
        return Err("Invalid thread ID".into());
    }
    if text.is_empty() || text.len() > 100_000 {
        return Err("Invalid prompt".into());
    }
    let client_request_id = {
        let mut backend = state.lock().unwrap();
        let id = format!("tauri-request-{}", backend.seq + 1);
        publish(
            &mut backend,
            "notification",
            "turn/userPrompt".into(),
            json!({"clientRequestId":id,"threadId":thread_id,"text":text}),
            None,
            None,
        );
        id
    };
    let result = connect(&state).and_then(|rpc| {
        rpc.request(
            "turn/start",
            json!({"threadId":thread_id,"input":[{"type":"text","text":text,"text_elements":[]}]}),
        )
    });
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            publish(
                &mut state.lock().unwrap(),
                "notification",
                "turn/startFailed".into(),
                json!({"clientRequestId":client_request_id,"threadId":thread_id,"message":error}),
                None,
                None,
            );
            return Err(error);
        }
    };
    let id = result
        .pointer("/turn/id")
        .and_then(Value::as_str)
        .ok_or("Invalid turn ID")?;
    publish(
        &mut state.lock().unwrap(),
        "notification",
        "turn/startAccepted".into(),
        json!({"clientRequestId":client_request_id,"threadId":thread_id,"turnId":id}),
        None,
        None,
    );
    Ok(json!({"turnId":id}))
}

#[tauri::command]
fn interrupt(thread_id: String, turn_id: String, state: State<BackendState>) -> Result<(), String> {
    if thread_id.is_empty() || turn_id.is_empty() {
        return Err("Invalid turn ID".into());
    }
    publish(
        &mut state.lock().unwrap(),
        "notification",
        "turn/interruptRequested".into(),
        json!({"threadId":thread_id,"turnId":turn_id}),
        None,
        None,
    );
    let result = connect(&state).and_then(|rpc| {
        rpc.request(
            "turn/interrupt",
            json!({"threadId":thread_id,"turnId":turn_id}),
        )
    });
    match result {
        Ok(_) => {
            publish(
                &mut state.lock().unwrap(),
                "notification",
                "turn/interruptAcknowledged".into(),
                json!({"threadId":thread_id,"turnId":turn_id}),
                None,
                None,
            );
            Ok(())
        }
        Err(error) => {
            publish(
                &mut state.lock().unwrap(),
                "notification",
                "turn/interruptUncertain".into(),
                json!({"threadId":thread_id,"turnId":turn_id,"message":error}),
                None,
                None,
            );
            Err(error)
        }
    }
}

#[tauri::command]
fn respond(request_id: Value, decision: String, state: State<BackendState>) -> Result<(), String> {
    if !matches!(
        decision.as_str(),
        "accept" | "acceptForSession" | "decline" | "cancel"
    ) {
        return Err("Unsupported approval decision".into());
    }
    let key = id_key(&request_id)?;
    {
        let mut backend = state.lock().unwrap();
        if !backend.approvals.remove(&key) || !backend.approval_attempts.insert(key) {
            return Err("Unknown or unsupported approval request".into());
        }
    }
    publish(
        &mut state.lock().unwrap(),
        "notification",
        "approval/responding".into(),
        json!({"decision":decision}),
        Some(request_id.clone()),
        None,
    );
    let result = connect(&state)
        .and_then(|rpc| rpc.respond(request_id.clone(), json!({"decision":decision})));
    match result {
        Ok(()) => {
            publish(
                &mut state.lock().unwrap(),
                "notification",
                "approval/responded".into(),
                json!({"decision":decision}),
                Some(request_id),
                None,
            );
            Ok(())
        }
        Err(error) => {
            publish(
                &mut state.lock().unwrap(),
                "notification",
                "approval/uncertain".into(),
                json!({"decision":decision,"message":error}),
                Some(request_id),
                None,
            );
            Err(error)
        }
    }
}

#[tauri::command]
fn events(state: State<BackendState>) -> Vec<AppEvent> {
    state.lock().unwrap().events.clone()
}

#[tauri::command]
fn probe_ready(state: State<BackendState>) -> Value {
    let backend = state.lock().unwrap();
    let enabled = std::env::var_os("WWW_PROBE_PATH").is_some();
    if enabled {
        json!({"enabled":true,"readinessMs":backend.native_entry.elapsed().as_secs_f64() * 1000.0})
    } else {
        json!({"enabled":false})
    }
}

#[tauri::command]
fn probe_finish(result: Value, app: AppHandle) -> Result<(), String> {
    let path = std::env::var("WWW_PROBE_PATH").map_err(|_| "Probe mode is disabled")?;
    let mut evidence = result.as_object().cloned().ok_or("Invalid probe result")?;
    evidence.insert("shell".into(), json!("tauri"));
    let path = PathBuf::from(path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(
        &path,
        format!("{}\n", serde_json::to_string_pretty(&evidence).unwrap()),
    )
    .map_err(|error| error.to_string())?;
    app.exit(0);
    Ok(())
}

fn workspace_info(path: &std::path::Path) -> WorkspaceInfo {
    let git = |args: &[&str]| {
        Command::new("git")
            .args(args)
            .current_dir(path)
            .output()
            .ok()
            .filter(|out| out.status.success())
            .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
            .unwrap_or_default()
    };
    let status = git(&["status", "--porcelain"]);
    WorkspaceInfo {
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .into(),
        path: path.to_string_lossy().into_owned(),
        branch: {
            let value = git(&["branch", "--show-current"]);
            (!value.is_empty()).then_some(value)
        },
        changes: status.lines().filter(|line| !line.is_empty()).count(),
    }
}

fn now_iso8601() -> String {
    let output = Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output();
    output
        .ok()
        .map(|value| String::from_utf8_lossy(&value.stdout).trim().to_string())
        .unwrap_or_default()
}

pub fn run() {
    let native_entry = Instant::now();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let workspace = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/"));
            app.manage(Mutex::new(Backend {
                app: app.handle().clone(),
                workspace,
                rpc: None,
                thread_started: false,
                seq: 0,
                events: vec![],
                approvals: HashSet::new(),
                approval_attempts: HashSet::new(),
                native_entry,
            }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            workspace,
            choose_workspace,
            start_thread,
            start_turn,
            interrupt,
            respond,
            events,
            probe_ready,
            probe_finish
        ])
        .run(tauri::generate_context!())
        .expect("error while running WWW Tauri comparison");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn shared_fixture_covers_stdio_streams_numeric_approval_interrupt_and_eof() {
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../test/fixtures/fake-app-server.mjs");
        let messages = Arc::new(Mutex::new(Vec::new()));
        let captured = messages.clone();
        let script = fixture.to_string_lossy().into_owned();
        let rpc = RpcClient::spawn(
            "node",
            &[&script],
            Arc::new(move |message| captured.lock().unwrap().push(message)),
        )
        .unwrap();
        rpc.request("initialize", json!({})).unwrap();
        rpc.notify("initialized", json!({})).unwrap();
        assert_eq!(
            rpc.request("thread/start", json!({})).unwrap()["thread"]["id"],
            "thread-fixture"
        );
        assert_eq!(
            rpc.request("turn/start", json!({})).unwrap()["turn"]["id"],
            "turn-fixture"
        );
        thread::sleep(Duration::from_millis(30));
        rpc.respond(json!(42), json!({"decision":"decline"}))
            .unwrap();
        rpc.request("turn/interrupt", json!({})).unwrap();
        thread::sleep(Duration::from_millis(30));
        let values = messages.lock().unwrap();
        assert!(values
            .iter()
            .any(|value| value["method"] == "item/agentMessage/delta"));
        assert!(values
            .iter()
            .any(|value| value["method"] == "item/completed"));
        assert!(values
            .iter()
            .any(|value| value["method"] == "fixture/approvalResponse"
                && value["params"]["idType"] == "number"));
    }

    #[test]
    fn missing_binary_and_eof_are_errors_without_retry() {
        assert!(RpcClient::spawn(
            "/definitely/missing/www-codex",
            &["app-server"],
            Arc::new(|_| {})
        )
        .is_err());
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../test/fixtures/fake-app-server.mjs");
        let script = fixture.to_string_lossy().into_owned();
        let rpc = RpcClient::spawn("node", &[&script, "eof"], Arc::new(|_| {})).unwrap();
        let error = rpc.request("initialize", json!({})).unwrap_err();
        assert!(error.contains("not retried"));
    }
}
