/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatPage from "./ChatPage.jsx";
import { api } from "../services/api.js";

vi.mock("../services/api.js", () => ({
  api: vi.fn()
}));

describe("ChatPage", () => {
  it("sends a message and renders the assistant response", async () => {
    api.mockResolvedValue({
      answer: "Demo answer",
      creditsUsed: 1,
      remainingCredits: 24,
      usedAgents: ["router"],
      sources: []
    });
    const refreshMe = vi.fn();

    render(<ChatPage refreshMe={refreshMe} />);
    fireEvent.change(screen.getByPlaceholderText("Ask anything"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Demo answer")).toBeInTheDocument());
    expect(api).toHaveBeenCalledWith("/api/agent/chat", { method: "POST", body: { message: "Hello" } });
    expect(refreshMe).toHaveBeenCalled();
  });
});
