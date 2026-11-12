import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { germanQuizGame, matchingGame, quizGame } from "@/test/fixtures";
import { ClassroomPlayer } from "./ClassroomPlayer";

const confetti = vi.hoisted(() => vi.fn());
vi.mock("canvas-confetti", () => ({ default: confetti }));

const score = (teamId: string) => screen.getByTestId(`score-${teamId}`).textContent;

beforeEach(() => confetti.mockClear());

describe("ClassroomPlayer (quiz, 2 teams)", () => {
  it("scores, rotates turns and shows the winner", async () => {
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);

    expect(screen.getByText("🦊 Foxes, your turn!")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();

    // Foxes answer correctly: point + confetti.
    await user.click(screen.getByRole("button", { name: /5/ }));
    expect(within(screen.getByRole("status")).getByText(/Correct!/)).toBeInTheDocument();
    expect(score("fox")).toBe("1");
    await vi.waitFor(() => expect(confetti).toHaveBeenCalledTimes(1));

    // Whales answer wrong: no point, correct answer shown.
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("🐳 Whales, your turn!")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /7/ }));
    expect(screen.getByText("The answer is: 6")).toBeInTheDocument();
    expect(score("whale")).toBe("0");

    // Back to Foxes, last question.
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("🦊 Foxes, your turn!")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "6" }));
    await user.click(screen.getByRole("button", { name: "See results" }));

    expect(screen.getByRole("heading", { name: "🦊 Foxes win!" })).toBeInTheDocument();
    expect(score("fox")).toBe("2");
  });

  it("play again resets scores", async () => {
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    await user.click(screen.getByRole("button", { name: /5/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: /6/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: "6" }));
    await user.click(screen.getByRole("button", { name: "See results" }));
    await user.click(screen.getByRole("button", { name: "Play again" }));
    expect(score("fox")).toBe("0");
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
  });
});

describe("ClassroomPlayer keyboard shortcuts", () => {
  it("answers with number keys and advances with the arrow key", async () => {
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={1} />);
    await user.keyboard("2"); // option index 1 = "5", correct
    expect(score("class")).toBe("1");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
  });

  it("doesn't skip a question when Enter is pressed on the focused Next button", async () => {
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={1} />);
    await user.click(screen.getByRole("button", { name: /5/ }));
    expect(screen.getByRole("button", { name: /Next/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
  });
});

describe("ClassroomPlayer variants", () => {
  it("hides the turn banner in solo mode and shows the class score at the end", async () => {
    const user = userEvent.setup();
    render(<ClassroomPlayer game={quizGame} teamCount={1} />);
    expect(screen.queryByText(/your turn/)).not.toBeInTheDocument();
    for (const key of ["2", "{ArrowRight}", "1", "{ArrowRight}", "1", "{ArrowRight}"]) await user.keyboard(key);
    expect(screen.getByText("You got 2 of 3 points.")).toBeInTheDocument();
  });

  it("uses German UI text for a German game", () => {
    render(<ClassroomPlayer game={germanQuizGame} teamCount={2} />);
    expect(screen.getByText("🦊 Füchse, ihr seid dran!")).toBeInTheDocument();
    expect(screen.getByText("Frage 1 von 3")).toBeInTheDocument();
  });

  it("plays a matching game to the end", async () => {
    const user = userEvent.setup();
    render(<ClassroomPlayer game={matchingGame} teamCount={1} />);
    for (const [left, right] of [["big", "small"], ["hot", "cold"], ["up", "down"]]) {
      await user.click(screen.getByRole("button", { name: left }));
      await user.click(screen.getByRole("button", { name: right }));
    }
    expect(screen.getByText("You got 3 of 3 points.")).toBeInTheDocument();
  });

  it("calls onExit from the toolbar", async () => {
    const onExit = vi.fn();
    render(<ClassroomPlayer game={quizGame} teamCount={2} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(onExit).toHaveBeenCalled();
  });
});

describe("ClassroomPlayer fullscreen", () => {
  it("hides the button when the browser has no Fullscreen API", () => {
    render(<ClassroomPlayer game={quizGame} teamCount={2} />);
    expect(screen.queryByRole("button", { name: "Full screen" })).not.toBeInTheDocument();
  });

  it("toggles fullscreen from the button and the F key", async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    const setFullscreen = (el: Element | null) => {
      fullscreenElement = el;
      document.dispatchEvent(new Event("fullscreenchange"));
    };
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    const request = vi.fn(async function (this: Element) {
      setFullscreen(this);
    });
    const exit = vi.fn(async () => setFullscreen(null));
    HTMLElement.prototype.requestFullscreen = request;
    document.exitFullscreen = exit;

    try {
      render(<ClassroomPlayer game={quizGame} teamCount={2} />);
      await user.click(screen.getByRole("button", { name: "Full screen" }));
      expect(request).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("button", { name: "Exit full screen" })).toBeInTheDocument();

      await user.keyboard("f");
      expect(exit).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("button", { name: "Full screen" })).toBeInTheDocument();
    } finally {
      // Remove the own-property overrides so later tests see jsdom's defaults again.
      Reflect.deleteProperty(document, "fullscreenEnabled");
      Reflect.deleteProperty(document, "fullscreenElement");
    }
  });
});
