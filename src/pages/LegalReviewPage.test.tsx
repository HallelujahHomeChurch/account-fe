import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AuthProvider, type AuthApi } from "../auth/auth-context";
import { LocaleProvider } from "../i18n/locale-context";
import { LegalReviewPage } from "./LegalReviewPage";

it("does not request or show private documents without qualified status", async () => {
  document.cookie = "hhc_locale=en; Path=/";
  const challenge = vi.fn();
  const api: AuthApi = {
    login: async () => ({}),
    me: async () => ({ id: "u1", email: "user@example.com" }),
    refreshAccessToken: async () => null,
    logout: async () => ({}),
    legal: {
      status: async () => ({ required: false }),
      history: async () => [],
      challenge,
      confirm: vi.fn(),
      historyEntry: vi.fn(),
    },
  };
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}>
          <LegalReviewPage />
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Acceptance history" });
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
  expect(challenge).not.toHaveBeenCalled();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

it("requires an explicit checkbox before confirming the displayed challenge", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  document.cookie = "hhc_locale=en; Path=/";
  const legalDocument = {
    schemaVersion: 1 as const,
    template: "legal.v1" as const,
    data: {
      heroTitle: "Reviewed supplement",
      updatedAtLabel: "Updated",
      updatedAt: "2026-10-01",
      intro: "",
      sections: [],
    },
  };
  const manifest = {
    scope: "verified-member" as const,
    locale: "en" as const,
    termsVersion: "t1",
    privacyNoticeVersion: "p1",
    termsSHA256: "a".repeat(64),
    privacySHA256: "b".repeat(64),
    commonTermsVersion: "ct1",
    commonPrivacyNoticeVersion: "cp1",
  };
  const confirm = vi.fn().mockResolvedValue({});
  const api: AuthApi = {
    login: async () => ({}),
    me: async () => ({ id: "u1", email: "user@example.com" }),
    refreshAccessToken: async () => null,
    logout: async () => ({}),
    legal: {
      status: async () => ({ required: true, manifest }),
      history: async () => [],
      challenge: async () => ({
        challenge: "displayed-challenge",
        snapshot: {
          snapshotId: "9a8d70cb-e644-4cf8-8eae-eb3e19e2f4ce",
          manifest,
          documents: { terms: legalDocument, privacy: legalDocument },
        },
      }),
      confirm,
      historyEntry: vi.fn(),
    },
  };
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}>
          <LegalReviewPage />
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  );
  const checkbox = await screen.findByRole("checkbox");
  expect(checkbox).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(confirm).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(checkbox);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(confirm).toHaveBeenCalledWith("displayed-challenge", true),
  );
});
