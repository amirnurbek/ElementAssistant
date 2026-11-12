// @vitest-environment node
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const KEY = "el-secret-key-456";
const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
const elevenLabs = vi.fn<typeof fetch>();
let cacheDir: string;

/** Fresh module = fresh in-memory cache, like a server restart. */
async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function post(route: Awaited<ReturnType<typeof loadRoute>>, body: unknown) {
  return route.POST(
    new Request("http://localhost/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const question = { text: "What is 2 + 3? Triangle: 4. Diamond: 5.", language: "en" };

beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), "tts-route-"));
  vi.stubEnv("ELEVENLABS_API_KEY", KEY);
  vi.stubEnv("ELEVENLABS_VOICE_ID", "");
  vi.stubEnv("ELEVENLABS_MODEL_ID", "");
  vi.stubEnv("TTS_CACHE_DIR", cacheDir);
  vi.stubGlobal("fetch", elevenLabs);
  elevenLabs.mockImplementation(async () => new Response(MP3, { status: 200, headers: { "content-type": "audio/mpeg" } }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  elevenLabs.mockReset();
  await rm(cacheDir, { recursive: true, force: true });
});

describe("GET /api/tts", () => {
  it("reports enabled when a key is set, without revealing it", async () => {
    const response = await (await loadRoute()).GET();
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ enabled: true });
    expect(text).not.toContain(KEY);
  });

  it("reports disabled without a key", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    expect(await (await loadRoute()).GET().then((r) => r.json())).toEqual({ enabled: false });
  });
});

describe("POST /api/tts", () => {
  it("returns MP3 audio from ElevenLabs", async () => {
    const response = await post(await loadRoute(), question);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("x-tts-cache")).toBe("miss");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(MP3);
  });

  it("calls ElevenLabs with the key header, default voice and model", async () => {
    await post(await loadRoute(), question);
    const [url, init] = elevenLabs.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128");
    expect((init?.headers as Record<string, string>)["xi-api-key"]).toBe(KEY);
    // multilingual_v2 doesn't accept language_code, so it isn't sent.
    expect(JSON.parse(init?.body as string)).toEqual({ text: question.text, model_id: "eleven_multilingual_v2" });
  });

  it("sends language_code for models that support it, and uses the configured voice", async () => {
    vi.stubEnv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "my-voice");
    await post(await loadRoute(), { text: "Was ist 2 · 3?", language: "de" });
    const [url, init] = elevenLabs.mock.calls[0];
    expect(url).toContain("/text-to-speech/my-voice?");
    expect(JSON.parse(init?.body as string)).toEqual({ text: "Was ist 2 · 3?", model_id: "eleven_flash_v2_5", language_code: "de" });
  });

  it("generates identical text only once and serves it from the cache after that", async () => {
    const route = await loadRoute();
    await post(route, question);
    const second = await post(route, { ...question, text: `  ${question.text} ` });
    expect(second.headers.get("x-tts-cache")).toBe("hit");
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(MP3);
    expect(elevenLabs).toHaveBeenCalledTimes(1);
  });

  it("generates again for different text", async () => {
    const route = await loadRoute();
    await post(route, question);
    await post(route, { ...question, text: "What is 3 + 3?" });
    expect(elevenLabs).toHaveBeenCalledTimes(2);
  });

  it("keeps the cache across a server restart via the cache folder", async () => {
    await post(await loadRoute(), question);
    expect((await readdir(cacheDir)).filter((f) => f.endsWith(".mp3"))).toHaveLength(1);
    const afterRestart = await post(await loadRoute(), question);
    expect(afterRestart.headers.get("x-tts-cache")).toBe("hit");
    expect(elevenLabs).toHaveBeenCalledTimes(1);
  });

  it("shares one ElevenLabs call between simultaneous identical requests", async () => {
    const route = await loadRoute();
    const responses = await Promise.all([post(route, question), post(route, question), post(route, question)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(elevenLabs).toHaveBeenCalledTimes(1);
  });

  it.each([401, 429, 500])("returns 502 when ElevenLabs answers %i, doesn't cache it, and retries next time", async (status) => {
    elevenLabs.mockImplementationOnce(async () => new Response('{"detail":"nope"}', { status }));
    const route = await loadRoute();
    const failed = await post(route, question);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "upstream" });
    expect(console.error).toHaveBeenCalledWith(`[tts] upstream (ElevenLabsError ${status})`);

    const retry = await post(route, question);
    expect(retry.status).toBe(200);
    expect(retry.headers.get("x-tts-cache")).toBe("miss");
    expect(elevenLabs).toHaveBeenCalledTimes(2);
  });

  it("returns 502 for an empty audio body", async () => {
    elevenLabs.mockImplementationOnce(async () => new Response(new Uint8Array(0), { status: 200 }));
    expect((await post(await loadRoute(), question)).status).toBe(502);
  });

  it("returns 502 when ElevenLabs can't be reached", async () => {
    elevenLabs.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await post(await loadRoute(), question)).status).toBe(502);
  });

  it("returns 503 without a key and never calls ElevenLabs", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const response = await post(await loadRoute(), question);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not_configured" });
    expect(elevenLabs).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", "{oops"],
    ["empty text", { text: "   ", language: "en" }],
    ["text over 400 characters", { text: "a".repeat(401), language: "en" }],
    ["unsupported language", { text: "Bonjour", language: "fr" }],
    ["missing language", { text: "Hello" }],
  ])("returns 400 for %s", async (_name, body) => {
    const response = await post(await loadRoute(), body);
    expect(response.status).toBe(400);
    expect(elevenLabs).not.toHaveBeenCalled();
  });

  it("never puts the key in a response or a log", async () => {
    elevenLabs.mockImplementationOnce(async () => new Response(`bad key ${KEY}`, { status: 401 }));
    const route = await loadRoute();
    const bodies = [await post(route, question), await post(route, "x"), await route.GET()].map((r) => r.text());
    for (const body of await Promise.all(bodies)) expect(body).not.toContain(KEY);
    const logged = JSON.stringify([vi.mocked(console.error).mock.calls, vi.mocked(console.warn).mock.calls]);
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain(question.text);
  });
});
