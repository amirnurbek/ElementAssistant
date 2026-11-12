import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { germanQuizGame, quizGame } from "@/test/fixtures";
import { GameFlow } from "./GameFlow";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("GameFlow", () => {
  it("goes preview -> team setup -> play, using the teacher's edits", async () => {
    const user = userEvent.setup();
    render(<GameFlow game={quizGame} backHref="/demo" />);

    await user.click(screen.getByRole("button", { name: "Delete question 1" }));
    await user.click(screen.getByRole("button", { name: "▶ Play" }));

    expect(screen.getByRole("heading", { name: "How do you want to play?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /2 teams/ }));

    expect(screen.getByRole("heading", { name: "What is 10 - 4?" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
  });

  it("keeps edits when the teacher exits the game back to the preview", async () => {
    const user = userEvent.setup();
    render(<GameFlow game={quizGame} />);
    await user.click(screen.getByRole("button", { name: "Delete question 1" }));
    await user.click(screen.getByRole("button", { name: "▶ Play" }));
    await user.click(screen.getByRole("button", { name: /Whole class/ }));
    await user.click(screen.getByRole("button", { name: "Exit" }));
    expect(screen.getAllByRole("listitem", { name: /^Question \d$/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Undo all changes" })).toBeInTheDocument();
  });

  it("can go back from team setup to the preview", async () => {
    const user = userEvent.setup();
    render(<GameFlow game={quizGame} />);
    await user.click(screen.getByRole("button", { name: "▶ Play" }));
    await user.click(screen.getByRole("button", { name: "← Back to preview" }));
    expect(screen.getByLabelText("Question 1 text")).toBeInTheDocument();
  });

  it("shows team setup in the game's language and marks the page language", async () => {
    const user = userEvent.setup();
    const { container } = render(<GameFlow game={germanQuizGame} />);
    expect(container.firstChild).toHaveAttribute("lang", "de");
    await user.click(screen.getByRole("button", { name: "▶ Play" }));
    expect(screen.getByRole("heading", { name: "Wie wollt ihr spielen?" })).toBeInTheDocument();
  });
});
