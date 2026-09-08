import { describe, expect, it } from "vitest";
import { getConfig } from "../../config.ts";

describe("config defaults", () => {
    it("uses loopback URLs for local bind hosts", () => {
        const config = getConfig(false, "");

        expect(config.apiServer.host).toBe("0.0.0.0");
        expect(config.gameServer.apiServerUrl).toBe("http://127.0.0.1:8000");
        expect(config.regions.local?.address).toContain("127.0.0.1:8001");
    });
});
