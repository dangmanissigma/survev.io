import { GameConfig } from "../../shared/gameConfig.ts";
import * as net from "../../shared/net/net.ts";
import type { FindGameBody, FindGameMatchData, FindGameResponse } from "../../shared/types/api.ts";
import { v2 } from "../../shared/utils/v2.ts";

// ── CONFIG ────────────────────────────────────────────────────
const SERVER = "localhost:8000"; // your dev API server (see server/src/config.ts -> apiServerUrl)
const USE_HTTPS = false;
const MAP_MODE = 0; // gameModeIdx — the only mode in local development
const SWAP_EVERY = 2.0; // seconds between left↔right switch
const TICK_MS = 33; // input send rate (~30hz)
// ─────────────────────────────────────────────────────────────

// ── Find game + get join token ──────────────────────────────
// NOTE: upstream renamed this endpoint from /api/find_game to /api/find_game_v2
// and changed the response shape to { type: "success" | "error" | "banned", res }.
async function findGame(): Promise<FindGameMatchData> {
    const url = `${USE_HTTPS ? "https" : "http"}://${SERVER}/api/find_game_v2`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
            {
                region: "local",
                autoFill: true,
                gameModeIdx: MAP_MODE,
                playerCount: 1,
                version: GameConfig.protocolVersion,
                zones: ["local"],
            } satisfies FindGameBody,
        ),
    });

    const json = (await res.json()) as FindGameResponse;
    if (json.type !== "success") {
        throw new Error(`find_game failed: ${JSON.stringify(json)}`);
    }

    return json.res;
}

// ── Bot ───────────────────────────────────────────────────────
class DummyBot {
    ws: WebSocket;
    connected = false;
    movingRight = true;
    timer = 0; // seconds since last swap
    stream = new net.MsgStream(new ArrayBuffer(512));
    joinToken: string;

    constructor(match: FindGameMatchData) {
        // NOTE: upstream now returns full connection URLs directly (res.urls),
        // instead of an addr you had to build a /play?gameId=... path from.
        const returnedUrl = match.urls[0];
        const wsUrl = returnedUrl.startsWith("/")
            ? (() => {
                const localUrl = new URL(returnedUrl, "http://localhost");
                const port = localUrl.searchParams.get("port");
                return `ws://localhost:${port ?? "80"}${localUrl.pathname}`;
            })()
            : returnedUrl.replace(/^http/, "ws");
        this.joinToken = match.joinToken;

        console.log("[DummyBot] connecting to", wsUrl);

        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = "arraybuffer";

        this.ws.addEventListener("open", () => this.join());
        this.ws.addEventListener("close", () => {
            console.log("[DummyBot] disconnected");
            process.exit(0);
        });
        this.ws.addEventListener("error", (e) => console.error("[DummyBot] ws error", e));
        this.ws.addEventListener("message", () => {}); // ignore server messages
    }

    join(): void {
        this.connected = true;
        console.log("[DummyBot] joined — moving left↔right every", SWAP_EVERY, "seconds");

        const msg = new net.JoinMsg();
        msg.bot = true;
        msg.name = "DummyBot";
        msg.isMobile = false;
        msg.protocol = GameConfig.protocolVersion;
        // NOTE: upstream renamed JoinMsg.matchPriv -> JoinMsg.joinToken
        msg.joinToken = this.joinToken;
        msg.loadout = {
            melee: "fists",
            outfit: "outfitBase",
            heal: "heal_basic",
            boost: "boost_basic",
            emotes: [],
        };

        this.sendMsg(net.MsgType.Join, msg);
    }

    sendMsg(type: net.MsgType, msg: net.Msg): void {
        this.stream.stream.index = 0;
        this.stream.serializeMsg(type, msg);
        this.ws.send(this.stream.getBuffer());
    }

    tick(dt: number): void {
        if (!this.connected) return;

        // Flip direction every SWAP_EVERY seconds
        this.timer += dt;
        if (this.timer >= SWAP_EVERY) {
            this.timer = 0;
            this.movingRight = !this.movingRight;
            console.log(`[DummyBot] now moving ${this.movingRight ? "RIGHT →" : "← LEFT"}`);
        }

        // Send input
        const input = new net.InputMsg();
        input.moveLeft = !this.movingRight;
        input.moveRight = this.movingRight;
        input.moveUp = false;
        input.moveDown = false;
        input.shootStart = false;

        // Always face right so the aimbot has a clear direction to read
        input.toMouseDir = v2.create(1, 0);
        input.toMouseLen = 50;

        this.sendMsg(net.MsgType.Input, input);
    }
}

// ── Main ──────────────────────────────────────────────────────
(async () => {
    let match: FindGameMatchData;
    try {
        match = await findGame();
    } catch (e) {
        console.error("[DummyBot] could not find game:", e);
        console.error("  → Make sure your server is running and someone has already joined");
        process.exit(1);
    }

    const bot = new DummyBot(match);
    const dtSec = TICK_MS / 1000;

    setInterval(() => bot.tick(dtSec), TICK_MS);
})();
