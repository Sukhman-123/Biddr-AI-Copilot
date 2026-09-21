import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/app";

describe("Biddr application shell", () => {
  it("introduces the auction workspace and strategy room", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Auction command" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Strategy room" })
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation ready")).toBeInTheDocument();
  });

  it("keeps unfinished auction and chat actions disabled", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Place bid" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});

