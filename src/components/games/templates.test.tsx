import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { matchingGame, quizGame, trueFalseGame } from "@/test/fixtures";
import { MatchingTemplate } from "./MatchingTemplate";
import { QuizTemplate } from "./QuizTemplate";
import { TrueFalseTemplate } from "./TrueFalseTemplate";

describe("QuizTemplate", () => {
  const item = quizGame.items[0]; // "What is 2 + 3?" -> "5" (index 1)

  it("shows the question and reports the tapped option index", async () => {
    const onAnswer = vi.fn();
    render(<QuizTemplate item={item} phase="answering" choice={null} onAnswer={onAnswer} />);
    expect(screen.getByRole("heading", { name: "What is 2 + 3?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /5/ }));
    expect(onAnswer).toHaveBeenCalledWith(1);
  });

  it("locks the options and marks right and wrong during feedback", () => {
    render(<QuizTemplate item={item} phase="feedback" choice={0} onAnswer={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: /5/ })).toHaveTextContent("✓");
    expect(screen.getByRole("button", { name: /4/ })).toHaveTextContent("✗");
  });
});

describe("TrueFalseTemplate", () => {
  const item = trueFalseGame.items[1]; // "Fish can fly." -> false, with explanation

  it("reports true/false and uses the game's language", async () => {
    const onAnswer = vi.fn();
    render(<TrueFalseTemplate item={item} phase="answering" choice={null} language="de" onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: /Falsch/ }));
    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(screen.queryByText(/Fish swim in water/)).not.toBeInTheDocument();
  });

  it("shows the explanation only after answering", () => {
    render(<TrueFalseTemplate item={item} phase="feedback" choice={true} language="en" onAnswer={vi.fn()} />);
    expect(screen.getByText(/Fish swim in water/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /True/ })).toBeDisabled();
  });
});

describe("MatchingTemplate", () => {
  const props = {
    pairs: matchingGame.pairs,
    rightOrder: ["p3", "p1", "p2"],
    lastResult: null,
    language: "en" as const,
  };

  it("reports a match once one card on each side is picked", async () => {
    const onMatch = vi.fn();
    render(<MatchingTemplate {...props} matchedIds={[]} onMatch={onMatch} />);
    await userEvent.click(screen.getByRole("button", { name: "hot" }));
    expect(onMatch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "hot" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "cold" }));
    expect(onMatch).toHaveBeenCalledWith("p2", "p2");
    // Selection resets after each attempt.
    expect(screen.getByRole("button", { name: "hot" })).toHaveAttribute("aria-pressed", "false");
  });

  it("also works right card first, and a second tap deselects", async () => {
    const onMatch = vi.fn();
    render(<MatchingTemplate {...props} matchedIds={[]} onMatch={onMatch} />);
    await userEvent.click(screen.getByRole("button", { name: "down" }));
    await userEvent.click(screen.getByRole("button", { name: "down" }));
    expect(screen.getByRole("button", { name: "down" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "down" }));
    await userEvent.click(screen.getByRole("button", { name: "big" }));
    expect(onMatch).toHaveBeenCalledWith("p1", "p3");
  });

  it("renders the right column in the shuffled order and locks matched cards", () => {
    render(<MatchingTemplate {...props} matchedIds={["p1"]} onMatch={vi.fn()} />);
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["✓big", "hot", "up", "down", "✓small", "cold"]);
    expect(screen.getByRole("button", { name: /big/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /small/ })).toBeDisabled();
  });
});
