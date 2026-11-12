import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { quizGame } from "@/test/fixtures";
import { CreateFlow } from "./CreateFlow";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const fetchMock = vi.fn<typeof fetch>();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: /Science/ }));
  await user.type(screen.getByLabelText("Topic"), "Plants");
  await user.click(within(screen.getByRole("radiogroup", { name: "Grade" })).getByRole("radio", { name: "3" }));
  await user.click(screen.getByRole("radio", { name: /True or false/ }));
  await user.click(screen.getByRole("radio", { name: "Deutsch" }));
}

const createButton = () => screen.getByRole("button", { name: "✨ Create game" });

describe("CreateFlow", () => {
  it("keeps Create disabled until there is a topic", async () => {
    const user = userEvent.setup();
    render(<CreateFlow />);
    expect(createButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Topic"), " ");
    expect(createButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Topic"), "Shapes");
    expect(createButton()).toBeEnabled();
  });

  it("fills the topic from an idea chip in the game's language", async () => {
    const user = userEvent.setup();
    render(<CreateFlow />);
    await user.click(screen.getByRole("radio", { name: "Deutsch" }));
    await user.click(screen.getByRole("button", { name: "Die Uhr lesen" }));
    expect(screen.getByLabelText("Topic")).toHaveValue("Die Uhr lesen");
  });

  it("sends the teacher's choices to the route", async () => {
    fetchMock.mockImplementation(async () => json(200, { game: quizGame }));
    const user = userEvent.setup();
    render(<CreateFlow />);
    await fillForm(user);
    await user.click(createButton());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/generate");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      subject: "science",
      topic: "Plants",
      grade: 3,
      gameType: "true-false",
      language: "de",
    });
  });

  it("shows the generated game in the preview, where items can be edited and deleted before playing", async () => {
    fetchMock.mockImplementation(async () => json(200, { game: quizGame }));
    const user = userEvent.setup();
    render(<CreateFlow />);
    await user.type(screen.getByLabelText("Topic"), "Adding");
    await user.click(createButton());

    expect(await screen.findByRole("heading", { name: "Test quiz" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem", { name: /^Question \d$/ })).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Delete question 1" }));
    const question = screen.getByLabelText("Question 1 text");
    await user.clear(question);
    await user.type(question, "What is 9 - 3?");
    await user.click(screen.getByRole("button", { name: "▶ Play" }));
    await user.click(screen.getByRole("button", { name: /Whole class/ }));

    expect(screen.getByRole("heading", { name: "What is 9 - 3?" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
  });

  it("shows the friendly invalid_output message, keeps the form values and can retry", async () => {
    fetchMock
      .mockResolvedValueOnce(json(502, { error: "invalid_output", message: "We couldn't create a good game this time." }))
      .mockResolvedValueOnce(json(200, { game: quizGame }));
    const user = userEvent.setup();
    render(<CreateFlow />);
    await fillForm(user);
    await user.click(createButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't create a good game this time.");
    expect(screen.getByLabelText("Topic")).toHaveValue("Plants");
    expect(screen.getByRole("radio", { name: "Deutsch" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Test quiz" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("links to the demo games when generation isn't configured", async () => {
    fetchMock.mockResolvedValue(
      json(503, { error: "not_configured", message: "Game generation isn't set up yet. You can still play the demo games." }),
    );
    const user = userEvent.setup();
    render(<CreateFlow />);
    await user.type(screen.getByLabelText("Topic"), "Shapes");
    await user.click(createButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("isn't set up yet");
    expect(within(alert).getByRole("link", { name: "Play the demo games →" })).toHaveAttribute("href", "/demo");
    expect(within(alert).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows a network error when the server can't be reached or answers without JSON", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(new Response("<html>", { status: 500 }));
    const user = userEvent.setup();
    render(<CreateFlow />);
    await user.type(screen.getByLabelText("Topic"), "Shapes");
    await user.click(createButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });

  it("rejects a 200 response whose game is broken", async () => {
    fetchMock.mockResolvedValue(json(200, { game: { ...quizGame, items: [] } }));
    const user = userEvent.setup();
    render(<CreateFlow />);
    await user.type(screen.getByLabelText("Topic"), "Shapes");
    await user.click(createButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("was broken");
  });

  it("cancel aborts the request and returns to the form", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
      );
    });
    const user = userEvent.setup();
    render(<CreateFlow />);
    await user.type(screen.getByLabelText("Topic"), "Shapes");
    await user.click(createButton());

    expect(screen.getByRole("status")).toHaveTextContent("Creating your quiz about “Shapes”");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(signal?.aborted).toBe(true);
    expect(screen.getByLabelText("Topic")).toHaveValue("Shapes");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("goes back to the form with values kept, and can generate a new version", async () => {
    fetchMock.mockImplementation(async () => json(200, { game: quizGame }));
    const user = userEvent.setup();
    render(<CreateFlow />);
    await fillForm(user);
    await user.click(createButton());
    await screen.findByRole("heading", { name: "Test quiz" });

    await user.click(screen.getByRole("button", { name: "↻ Generate a new version" }));
    await screen.findByRole("heading", { name: "Test quiz" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "← Change settings" }));
    expect(screen.getByLabelText("Topic")).toHaveValue("Plants");
  });
});
