# Deepgram Flux: Real-Time STT Configuration with LiveKit

Deepgram now supports control messages mid-stream, so you can update things like keyterms in real time as conversational context evolves — without disconnecting and reconnecting.

This demo shows how to add STT keyterms on the fly during a live voice session, using LiveKit's RPC mechanism to send terms from a Next.js frontend to a Python agent that calls Deepgram's `update_options` API.

## How it works

1. A user joins a voice session powered by LiveKit
2. The agent uses **Deepgram Flux** (`deepgram/flux-general`) for speech-to-text
3. During the conversation, the user types a keyterm into the side panel (e.g., a name that STT always gets wrong)
4. The frontend sends the term to the agent via [LiveKit RPC](https://docs.livekit.io/home/client/data/rpc/)
5. The agent calls `stt.update_options(extra={"keyterm": [...]})` to update Deepgram mid-stream
6. Deepgram immediately starts using the new keyterm for improved transcription accuracy

## Project structure

```
deepgram-configure/          # Python agent (backend)
├── src/agent.py             # LiveKit agent with Deepgram Flux STT + RPC handler
├── pyproject.toml
└── frontend/                # Next.js app (frontend)
    ├── hooks/useKeytermRpc.ts          # RPC hook to send keyterms to agent
    ├── components/app/keyterm-panel.tsx # UI for adding keyterms
    └── components/app/view-controller.tsx
```

## Prerequisites

- Python 3.12+
- Node.js 18+
- [pnpm](https://pnpm.io/)
- A [LiveKit Cloud](https://cloud.livekit.io) project (or self-hosted LiveKit server)
- A Deepgram API key (configured via [LiveKit Inference](https://docs.livekit.io/agents/integrations/stt/deepgram/))

## Setup

### Agent

```bash
cd deepgram-configure
cp .env.example .env.local
# Fill in LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
```

```bash
uv sync
uv run src/agent.py dev
```

### Frontend

```bash
cd deepgram-configure/frontend
cp .env.example .env.local
# Fill in LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
```

```bash
pnpm install
pnpm dev
```

## Key code

### Agent: handling the RPC and updating Deepgram

```python
# Register an RPC method that the frontend can call
@ctx.room.local_participant.register_rpc_method("stt.add_keyterm")
async def handle_add_keyterm(data: rtc.rpc.RpcInvocationData):
    payload = json.loads(data.payload)
    term = payload.get("term", "")
    if term:
        assistant._update_keyterms(term)
        return json.dumps({"ok": True, "keyterms": list(assistant._keyterms)})

# Inside the Agent class
def _update_keyterms(self, term: str) -> None:
    if term not in self._keyterms:
        self._keyterms.append(term)
    # This is the key call — updates Deepgram mid-stream without reconnecting
    self.session.stt.update_options(extra={"keyterm": list(self._keyterms)})
```

### Frontend: sending keyterms via RPC

```typescript
const response = await room.localParticipant.performRpc({
  destinationIdentity: agent.identity,
  method: "stt.add_keyterm",
  payload: JSON.stringify({ term: "Shayne" }),
});
```
