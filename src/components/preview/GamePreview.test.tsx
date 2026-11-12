import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Game } from "@/lib/schemas";
import { matchingGame, quizGame, trueFalseGame } from "@/test/fixtures";
import { GamePreview } from "./GamePreview";

/** Wraps the controlled preview with real state, like GameFlow does. */
function Harness({ game, onPlay = vi.fn() }: { game: Game; onPlay?: (g: Game) => void }) {
  const [draft, setDraft] = useState(game);
  return (
    <GamePreview game={draft} dirty={draft !== game} onChange={setDraft} onReset={() => setDraft(game)} onPlay={onPlay} />
  );
}

const play = () => screen.getByRole("button", { name: "▶ Play" });

describe("GamePreview", () => {
  it("shows every question with its options and the correct one selected", () => {
    render(<Harness game={quizGame} />);
    expect(screen.getAllByRole("listitem", { name: /^Question \d$/ })).toHaveLength(3);
    expect(screen.getByLabelText("Question 1 text")).toHaveValue("What is 2 + 3?");
    expect(screen.getByLabelText("Option 2 of question 1 is correct")).toBeChecked();
    expect(play()).toBeEnabled();
  });

  it("plays the edited, trimmed game", async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<Harness game={quizGame} onPlay={onPlay} />);
    const question = screen.getByLabelText("Question 1 text");
    await user.clear(question);
    await user.type(question, "  What is 1 + 4?  ");
    await user.click(screen.getByRole("button", { name: "Delete question 3" }));
    await user.click(play());
    const played = onPlay.mock.calls[0][0] as typeof quizGame;
    expect(played.items.map((i) => i.question)).toEqual(["What is 1 + 4?", "What is 10 - 4?"]);
  });

  it("keeps questions on one line: Enter and pasted line breaks become spaces", async () => {
    const user = userEvent.setup();
    render(<Harness game={quizGame} />);
    const question = screen.getByLabelText("Question 1 text");
    await user.type(question, "{Enter}");
    expect(question).toHaveValue("What is 2 + 3?");
    await user.clear(question);
    await user.click(question);
    await user.paste("What is\n2 + 3?");
    expect(question).toHaveValue("What is 2 + 3?");
  });

  it("blocks Play and points at the problem while an option is empty", async () => {
    const user = userEvent.setup();
    render(<Harness game={quizGame} />);
    await user.click(within(screen.getByRole("listitem", { name: "Question 2" })).getByRole("button", { name: "+ Add option" }));
    expect(play()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Fix 1 problem before playing.");
    const empty = screen.getByLabelText("Question 2, option 3");
    expect(empty).toHaveAttribute("aria-invalid", "true");
    await user.type(empty, "8");
    expect(play()).toBeEnabled();
  });

  it("changes the correct answer and can't remove the correct option", async () => {
    const user = userEvent.setup();
    render(<Harness game={quizGame} />);
    expect(screen.getByRole("button", { name: "Remove option 2 of question 1" })).toBeDisabled();
    await user.click(screen.getByLabelText("Option 3 of question 1 is correct"));
    expect(screen.getByRole("button", { name: "Remove option 2 of question 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove option 3 of question 1" })).toBeDisabled();
  });

  it("shows a general problem when too few pairs are left, and undo restores them", async () => {
    const user = userEvent.setup();
    render(<Harness game={matchingGame} />);
    await user.click(screen.getByRole("button", { name: "Delete pair 1" }));
    expect(screen.getByRole("alert")).toHaveTextContent("A matching game needs at least 3 pairs");
    expect(play()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Undo all changes" }));
    expect(screen.getAllByRole("listitem", { name: /^Pair \d$/ })).toHaveLength(3);
    expect(play()).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Undo all changes" })).not.toBeInTheDocument();
  });

  it("flags a duplicate matching card on the pair that causes it", async () => {
    const user = userEvent.setup();
    render(<Harness game={matchingGame} />);
    const right = screen.getByLabelText("Pair 3 right card");
    await user.clear(right);
    await user.type(right, "cold");
    expect(within(screen.getByRole("listitem", { name: "Pair 3" })).getByText("Each right card must be different")).toBeInTheDocument();
  });

  it("edits true/false answers and removes an explanation when cleared", async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<Harness game={trueFalseGame} onPlay={onPlay} />);
    const statement2 = within(screen.getByRole("listitem", { name: "Statement 2" }));
    await user.click(statement2.getByRole("radio", { name: "True" }));
    await user.clear(screen.getByLabelText("Statement 2 explanation"));
    expect(play()).toBeEnabled();
    await user.click(play());
    const played = onPlay.mock.calls[0][0] as typeof trueFalseGame;
    expect(played.items[1]).toMatchObject({ answer: true });
    expect(played.items[1].explanation).toBeUndefined();
  });
});
