import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithOAuth } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  signInWithOAuth.mockResolvedValue({ error: null });
});

it("makes sign-in available after the redirect request finishes so returning users can retry", async () => {
  render(<LoginPage />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(2));
  expect(signInWithOAuth).toHaveBeenLastCalledWith({
    provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
});

it("disables duplicate submissions while the OAuth request is pending", async () => {
  let resolve!: (result: { error: null }) => void;
  signInWithOAuth.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<LoginPage />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  const connecting = screen.getByRole("button", { name: "Connecting…" });
  expect(connecting).toBeDisabled();
  fireEvent.click(connecting);
  expect(signInWithOAuth).toHaveBeenCalledOnce();
  await act(async () => resolve({ error: null }));
});

it.each(["pageshow", "popstate"])("clears the restored connecting state on %s", async (eventName) => {
  let resolve!: (result: { error: null }) => void;
  signInWithOAuth.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<LoginPage />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(screen.getByRole("button", { name: "Connecting…" })).toBeDisabled();
  const event = new Event(eventName);
  if (eventName === "pageshow") Object.defineProperty(event, "persisted", { value: true });
  fireEvent(window, event);
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await act(async () => resolve({ error: null }));
});

it("keeps sign-in retryable and displays an error when OAuth fails", async () => {
  signInWithOAuth.mockResolvedValueOnce({ error: new Error("Sign-in unavailable") });
  render(<LoginPage />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in unavailable");
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
