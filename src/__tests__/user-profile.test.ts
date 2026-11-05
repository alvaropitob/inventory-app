import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/user";

const createClientMock = vi.mocked(createClient);

function mockSupabaseProfile({ authUser, profile, error = null }: {
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;
  profile: unknown;
  error?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: authUser } }) },
    from: vi.fn(() => ({ select })),
  };
  createClientMock.mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);
  return { client, maybeSingle };
}

describe("getCurrentUserProfile access checks", () => {
  beforeEach(() => createClientMock.mockReset());

  it("does not create an application profile for an unauthenticated session", async () => {
    const { client } = mockSupabaseProfile({ authUser: null, profile: null });
    expect(await getCurrentUserProfile()).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("denies access when the profile lookup fails", async () => {
    mockSupabaseProfile({ authUser: { id: "u-1" }, profile: null, error: new Error("lookup failed") });
    expect(await getCurrentUserProfile()).toBeNull();
  });

  it("does not promote a missing application profile using auth metadata", async () => {
    mockSupabaseProfile({
      authUser: { id: "u-1", email: "new@example.test", user_metadata: { full_name: "New user", role: "admin" } },
      profile: null,
    });
    expect(await getCurrentUserProfile()).toBeNull();
  });

  it("denies inactive users and inactive roles", async () => {
    mockSupabaseProfile({ authUser: { id: "u-1" }, profile: { is_active: false, roles: { name: "operator", is_active: true } } });
    expect(await getCurrentUserProfile()).toBeNull();

    mockSupabaseProfile({ authUser: { id: "u-1" }, profile: { is_active: true, roles: { name: "operator", is_active: false } } });
    expect(await getCurrentUserProfile()).toBeNull();
  });

  it("denies users with missing or unsupported roles", async () => {
    mockSupabaseProfile({ authUser: { id: "u-1" }, profile: { is_active: true, roles: null } });
    expect(await getCurrentUserProfile()).toBeNull();

    mockSupabaseProfile({ authUser: { id: "u-1" }, profile: { is_active: true, roles: { name: "custom-admin", is_active: true } } });
    expect(await getCurrentUserProfile()).toBeNull();
  });

  it("returns the database role for an active user", async () => {
    mockSupabaseProfile({
      authUser: { id: "u-1", email: "worker@example.test", user_metadata: { full_name: "Worker" } },
      profile: {
        id: "u-1",
        email: "worker@example.test",
        username: "worker",
        full_name: "Worker",
        is_active: true,
        roles: { id: "role-1", name: "operator", is_active: true },
      },
    });
    expect(await getCurrentUserProfile()).toMatchObject({
      id: "u-1",
      email: "worker@example.test",
      username: "worker",
      fullName: "Worker",
      role: "operator",
    });
  });
});
