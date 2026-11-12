import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { germanQuizGame, matchingGame, quizGame, trueFalseGame } from "@/test/fixtures";
import { ClassroomPlayer } from "./ClassroomPlayer";
import { resetReadAloudForTests } from "./useReadAloud";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const fetchMock = vi.fn<typeof fetch>();
const played: string[] = [];

class FakeAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly src: string) {}
  play = vi.fn(async () => {
    played.push(this.src);
  });
  pause = vi.fn();
}

/** GET /api/tts -> { enabled }, POST -> a tiny MP3. */
function serve({ enabled = true, postStatus = 200 } = {}) {
  fetchMock.mockImplementation(async (_url, init) => {
    if (!init?.method || init.method === "GET") return Response.json({ enabled });
    if (postStatus !== 200) return Response.json({ error: "x" }, { status: postStatus });
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
  });
}

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
const postedBody = (n = 0) => JSON.parse(posts()[n][1]?.body as string);

beforeEach(() => {
  resetReadAloudForTests();
  played.length = 0;
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Audio", FakeAudio);
  let n = 0;
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => `blob:clip-${++n}`), revokeObjectURL: vi.fn() }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("read aloud", () => {
  it("is hidden when the server has no ElevenLabs key", async () => {
    serve({ enabled: false });
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith("/api/tts");
    expect(screen.queryByRole("button", { name: "Read aloud" })).not.toBeInTheDocument();
  });

  it("is hidden when the check fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Read aloud" })).not.toBeInTheDocument();
  });

  it("reads the question and the options with their shapes", async () => {
    serve();
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));

    expect(postedBody()).toEqual({ text: "What is 2 + 3? Triangle: 4. Diamond: 5. Circle: 6.", language: "en" });
    await vi.waitFor(() => expect(played).toEqual(["blob:clip-1"]));
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });

  it("uses the game's language for the text, the request and the label", async () => {
    serve();
    const user = userEvent.setup();
    render(<ClassroomPlayer game={germanQuizGame} teamCount={2} />);
    await user.click(await screen.findByRole("button", { name: "Vorlesen" }));
    expect(postedBody()).toMatchObject({ language: "de", text: expect.stringContaining("Dreieck: 4.") });
  });

  it("replays the same question from the browser cache without a new request", async () => {
    serve();
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));
    await vi.waitFor(() => expect(played).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Stop" }));
    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    await vi.waitFor(() => expect(played).toHaveLength(2));
    expect(posts()).toHaveLength(1);
  });

  it("reads the next question after Next, and stops the previous audio", async () => {
    serve();
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));
    await vi.waitFor(() => expect(played).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /5/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));
    expect(postedBody(1).text).toMatch(/^What is 10 - 4\?/);
  });

  it("reads with the R key", async () => {
    serve();
    const user = userEvent.setup();
    render(<ClassroomPlayer game={trueFalseGame} teamCount={1} />);
    await screen.findByRole("button", { name: "Read aloud" });
    await user.keyboard("r");
    expect(postedBody()).toEqual({ text: "Ice is frozen water.", language: "en" });
  });

  it("has no button in matching games", async () => {
    serve();
    render(<ClassroomPlayer game={matchingGame} teamCount={2} />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Read aloud" })).not.toBeInTheDocument();
  });

  it("hides the button if the server reports it's no longer configured", async () => {
    serve({ postStatus: 503 });
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: /Read aloud|Loading/ })).not.toBeInTheDocument());
  });

  it("stays usable after an ElevenLabs error, without breaking the game", async () => {
    serve({ postStatus: 502 });
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    await user.click(await screen.findByRole("button", { name: "Read aloud" }));
    expect(await screen.findByRole("button", { name: "Read aloud" })).toBeEnabled();
    expect(played).toEqual([]);
    await user.click(screen.getByRole("button", { name: /5/ }));
    expect(screen.getByTestId("score-fox")).toHaveTextContent("1");
  });
});
