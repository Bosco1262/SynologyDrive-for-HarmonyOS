import { describe, expect, it } from "vitest";
import {
  QuickConnectHttpClient,
  QuickConnectResolverClient,
  ReconnectableQuickConnectClient,
} from "../api/quickConnect";

class MockHttpClient implements QuickConnectHttpClient {
  constructor(private readonly response: { status: number; url: string; headers?: Record<string, string>; body: string }) {}
  async get(_url: string) {
    return {
      status: this.response.status,
      url: this.response.url,
      headers: this.response.headers ?? {},
      body: this.response.body,
    };
  }
}

describe("QuickConnect integration", () => {
  it("resolves server address from redirected url", async () => {
    const resolver = new QuickConnectResolverClient(
      new MockHttpClient({
        status: 200,
        url: "https://nas.example.com/webman/index.cgi",
        body: "<html />",
      }),
    );

    const address = await resolver.resolveServerAddress("my-nas");
    expect(address).toBe("https://nas.example.com");
  });

  it("resolves server address from json payload", async () => {
    const resolver = new QuickConnectResolverClient(
      new MockHttpClient({
        status: 200,
        url: "https://quickconnect.cn/my-nas",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { serverAddress: "https://192.168.1.2:5001" } }),
      }),
    );

    const address = await resolver.resolveServerAddress("my-nas");
    expect(address).toBe("https://192.168.1.2:5001");
  });

  it("re-resolves address after disconnect and retries operation", async () => {
    let resolveCount = 0;
    const reconnectable = new ReconnectableQuickConnectClient({
      async resolveServerAddress(_quickConnectId: string): Promise<string> {
        resolveCount += 1;
        return resolveCount === 1 ? "https://nas-a.example.com" : "https://nas-b.example.com";
      },
    });

    await reconnectable.connect("my-nas");

    let call = 0;
    const result = await reconnectable.runWithReconnect(async (serverAddress: string) => {
      call += 1;
      if (call === 1) {
        throw new Error(`network disconnect on ${serverAddress}`);
      }
      return serverAddress;
    });

    expect(result).toBe("https://nas-b.example.com");
    expect(resolveCount).toBe(2);
  });
});
