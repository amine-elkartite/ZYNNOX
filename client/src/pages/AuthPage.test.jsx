/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage.jsx";

describe("AuthPage", () => {
  it("submits registration form data", () => {
    const onSubmit = vi.fn();
    render(<AuthPage mode="register" loading={false} error="" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(onSubmit).toHaveBeenCalledWith("register", {
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "secure-password"
    });
  });
});
