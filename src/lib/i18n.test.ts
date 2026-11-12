import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("t", () => {
  it("returns the string in the requested language", () => {
    expect(t("en", "next")).toBe("Next");
    expect(t("de", "next")).toBe("Weiter");
  });

  it("fills placeholders", () => {
    expect(t("de", "progress.question", { n: 2, total: 5 })).toBe("Frage 2 von 5");
  });

  it("leaves unknown placeholders visible instead of printing 'undefined'", () => {
    expect(t("en", "turn")).toBe("{team}, your turn!");
  });
});
