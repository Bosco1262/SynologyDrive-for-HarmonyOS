const QUICK_CONNECT_BASE_URL = "https://quickconnect.cn";

export interface QuickConnectHttpResponse {
  status: number;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface QuickConnectHttpClient {
  get(url: string): Promise<QuickConnectHttpResponse>;
}

type FetchFn = (input: string, init?: { method?: string; redirect?: "follow" | "error" | "manual" }) => Promise<{
  status: number;
  url: string;
  headers: { forEach: (cb: (value: string, key: string) => void) => void };
  text: () => Promise<string>;
}>;

export class FetchQuickConnectHttpClient implements QuickConnectHttpClient {
  async get(url: string): Promise<QuickConnectHttpResponse> {
    const fetchFn = (globalThis as { fetch?: FetchFn }).fetch;
    if (!fetchFn) {
      throw new Error("fetch is not available in current runtime");
    }

    const response = await fetchFn(url, { method: "GET", redirect: "follow" });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const body = await response.text();
    return {
      status: response.status,
      url: response.url,
      headers,
      body,
    };
  }
}

export interface QuickConnectResolver {
  resolveServerAddress(quickConnectId: string): Promise<string>;
}

export class QuickConnectResolverClient implements QuickConnectResolver {
  constructor(private readonly httpClient: QuickConnectHttpClient = new FetchQuickConnectHttpClient()) {}

  async resolveServerAddress(quickConnectId: string): Promise<string> {
    const safeId = encodeURIComponent(quickConnectId.trim());
    const target = `${QUICK_CONNECT_BASE_URL}/${safeId}`;
    const response = await this.httpClient.get(target);
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`quickconnect request failed with status ${response.status}`);
    }

    const fromJson = this.parseServerFromJson(response.body, response.headers["content-type"] ?? "");
    if (fromJson) {
      return fromJson;
    }

    const fromBody = this.parseServerFromText(response.body);
    if (fromBody) {
      return fromBody;
    }

    const redirected = this.parseRedirectedServer(response.url);
    if (redirected) {
      return redirected;
    }

    throw new Error("quickconnect server address not found");
  }

  private parseServerFromJson(body: string, contentType: string): string | undefined {
    if (!contentType.includes("json")) {
      return undefined;
    }
    try {
      const payload = JSON.parse(body) as unknown;
      return this.pickAddressFromPayload(payload);
    } catch {
      return undefined;
    }
  }

  private pickAddressFromPayload(payload: unknown): string | undefined {
    if (!payload || typeof payload !== "object") {
      return undefined;
    }
    const source = payload as Record<string, unknown>;
    const candidates = ["serverAddress", "server", "url", "host"];
    for (const key of candidates) {
      const value = source[key];
      if (typeof value === "string") {
        const normalized = normalizeServerAddress(value);
        if (normalized) {
          return normalized;
        }
      }
    }
    for (const value of Object.values(source)) {
      const nested = this.pickAddressFromPayload(value);
      if (nested) {
        return nested;
      }
    }
    return undefined;
  }

  private parseServerFromText(body: string): string | undefined {
    const matches = body.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
    for (const candidate of matches) {
      const normalized = normalizeServerAddress(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return undefined;
  }

  private parseRedirectedServer(responseUrl: string): string | undefined {
    try {
      const parsed = new URL(responseUrl);
      if (parsed.host.includes("quickconnect.cn")) {
        return undefined;
      }
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return undefined;
    }
  }
}

export interface ReconnectableQuickConnectOptions {
  maxRetry?: number;
}

export class ReconnectableQuickConnectClient {
  private readonly maxRetry: number;
  private serverAddress: string | undefined;
  private quickConnectId: string | undefined;

  constructor(
    private readonly resolver: QuickConnectResolver,
    options: ReconnectableQuickConnectOptions = {},
  ) {
    this.maxRetry = Math.max(1, options.maxRetry ?? 2);
  }

  async connect(quickConnectId: string): Promise<string> {
    this.quickConnectId = quickConnectId;
    this.serverAddress = await this.resolver.resolveServerAddress(quickConnectId);
    return this.serverAddress;
  }

  currentAddress(): string | undefined {
    return this.serverAddress;
  }

  markDisconnected(): void {
    this.serverAddress = undefined;
  }

  async runWithReconnect<T>(operation: (serverAddress: string) => Promise<T>): Promise<T> {
    if (!this.quickConnectId) {
      throw new Error("quickconnect not connected");
    }

    for (let attempt = 0; attempt <= this.maxRetry; attempt += 1) {
      try {
        if (!this.serverAddress) {
          this.serverAddress = await this.resolver.resolveServerAddress(this.quickConnectId);
        }
        return await operation(this.serverAddress);
      } catch (error) {
        if (!isDisconnectError(error) || attempt === this.maxRetry) {
          throw error;
        }
        this.serverAddress = await this.resolver.resolveServerAddress(this.quickConnectId);
      }
    }
    throw new Error("quickconnect reconnect failed");
  }
}

const normalizeServerAddress = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (parsed.host.includes("quickconnect.cn")) {
      return undefined;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
};

const isDisconnectError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const keywords = ["disconnect", "econnreset", "econnrefused", "timeout", "network"];
  return keywords.some((keyword) => message.includes(keyword));
};
