import json
import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    inference,
    room_io,
)
from livekit.plugins import deepgram, noise_cancellation, silero

logger = logging.getLogger("agent")

load_dotenv(".env.local")

class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant. The user is interacting with you via voice, even if you perceive the conversation as text.
            You eagerly assist users with their questions by providing information from your extensive knowledge. Speak naturally! Use "uhms" and "hmms"
            where appropriate!
            """,
        )
        self._keyterms: list[str] = []

    def _update_keyterms(self, term: str) -> None:
        if term not in self._keyterms:
            self._keyterms.append(term)
        if self.session.stt is not None:
            logger.info(
                "Calling update_options with keyterms: %s, stt type: %s",
                self._keyterms,
                type(self.session.stt).__name__,
            )
            self.session.stt.update_options(extra={"keyterm": list(self._keyterms)})
            logger.info("update_options call completed, current extra_kwargs: %s", getattr(self.session.stt, '_opts', 'N/A'))

server = AgentServer()

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

server.setup_fnc = prewarm

@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    session = AgentSession(
        stt=inference.STT(model="deepgram/flux-general"),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=inference.TTS(
            model="deepgram/aura-2",
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    assistant = Assistant()

    await session.start(
        agent=assistant,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    @ctx.room.local_participant.register_rpc_method("stt.add_keyterm")
    async def handle_add_keyterm(data: rtc.rpc.RpcInvocationData):
        payload = json.loads(data.payload)
        term = payload.get("term", "")
        if term:
            assistant._update_keyterms(term)
            logger.info(f"Added keyterm via RPC: {term}")
            return json.dumps(
                {"ok": True, "keyterms": list(assistant._keyterms)}
            )
        return json.dumps({"ok": False, "error": "No term provided"})

    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(server)
