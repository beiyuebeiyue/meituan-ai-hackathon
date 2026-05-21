#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="18798"
OPENCLAW_DIR="$PWD/.openclaw"
STATE_DIR="$OPENCLAW_DIR/state"
CONFIG_PATH="$OPENCLAW_DIR/openclaw.json"
WORKSPACE_DIR="$OPENCLAW_DIR/workspace"
CONFIG_WORKSPACE="/workspace/.openclaw/workspace"

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key {print substr($0, length(key) + 2)}' .env | tail -n 1
}

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^$key=" .env; then
    perl -0pi -e "s#^$key=.*#$key=$value#m" .env
  else
    printf '\n%s=%s\n' "$key" "$value" >> .env
  fi
}

LONGCAT_KEY="$(read_env LONGCAT_API_KEY)"
LONGCAT_BASE="$(read_env LONGCAT_BASE_URL)"
LONGCAT_CHAT_MODEL="$(read_env LONGCAT_CHAT_MODEL)"
GATEWAY_TOKEN="$(read_env OPENCLAW_GATEWAY_TOKEN)"

if [ -z "$GATEWAY_TOKEN" ]; then
  GATEWAY_TOKEN="$(openssl rand -hex 24)"
  set_env OPENCLAW_GATEWAY_TOKEN "$GATEWAY_TOKEN"
fi

set_env OPENCLAW_BASE_URL "http://openclaw:$PORT"
set_env OPENCLAW_MODEL "openclaw/default"
set_env OPS_AI_PROVIDER "openclaw"

mkdir -p "$STATE_DIR" "$WORKSPACE_DIR"
if [ ! -f "$WORKSPACE_DIR/SOUL.md" ]; then
  cp soul.md "$WORKSPACE_DIR/SOUL.md"
fi

export LONGCAT_KEY LONGCAT_BASE LONGCAT_CHAT_MODEL GATEWAY_TOKEN CONFIG_WORKSPACE PORT
jq -n '
{
  gateway: {
    mode: "local",
    bind: "lan",
    port: (env.PORT | tonumber),
    auth: {mode: "token", token: env.GATEWAY_TOKEN},
    http: {endpoints: {chatCompletions: {enabled: true}}}
  },
  agents: {
    defaults: {
      workspace: env.CONFIG_WORKSPACE,
      model: {primary: ("longcat/" + env.LONGCAT_CHAT_MODEL)},
      models: {("longcat/" + env.LONGCAT_CHAT_MODEL): {}}
    }
  },
  models: {
    mode: "merge",
    providers: {
      longcat: {
        baseUrl: env.LONGCAT_BASE,
        apiKey: env.LONGCAT_KEY,
        api: "openai-completions",
        models: [
          {
            id: env.LONGCAT_CHAT_MODEL,
            name: (env.LONGCAT_CHAT_MODEL + " (LongCat)"),
            api: "openai-completions",
            reasoning: false,
            input: ["text"],
            cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0},
            contextWindow: 128000,
            maxTokens: 8192
          }
        ]
      }
    }
  }
}
' > "$CONFIG_PATH"

OPENCLAW_STATE_DIR="$STATE_DIR" OPENCLAW_CONFIG_PATH="$CONFIG_PATH" ./node_modules/.bin/openclaw config validate >/dev/null
