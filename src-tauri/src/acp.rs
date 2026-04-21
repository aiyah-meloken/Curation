use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct AgentConfig {
    pub name: String,
    pub id: String,
    pub command: String,
    pub args: Vec<String>,
    pub detected: bool,
}

/// Returns the list of known agents with detection status.
pub fn detect_agents() -> Vec<AgentConfig> {
    let agents = vec![
        ("Claude Code", "claude-acp", "npx", vec![
            "@agentclientprotocol/claude-agent-acp@0.30.0".to_string(),
        ]),
        ("Codex CLI", "codex-acp", "npx", vec![
            "@zed-industries/codex-acp@0.11.1".to_string(),
        ]),
        ("Gemini CLI", "gemini-acp", "gemini", vec![
            "--acp".to_string(),
        ]),
    ];

    agents
        .into_iter()
        .map(|(name, id, cmd, args)| {
            let detected = is_command_available(cmd);
            AgentConfig {
                name: name.to_string(),
                id: id.to_string(),
                command: cmd.to_string(),
                args,
                detected,
            }
        })
        .collect()
}

fn is_command_available(cmd: &str) -> bool {
    let check = if cfg!(target_os = "windows") {
        Command::new("where").arg(cmd).output()
    } else {
        Command::new("which").arg(cmd).output()
    };
    match check {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}
