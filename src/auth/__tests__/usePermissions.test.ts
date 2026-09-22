/**
 * The single source of gating truth. Every screen hides its controls from this, so if these
 * flags are right and screens read them, gating is right (integration doc §3).
 *
 * The server enforces the same rules and answers 403 regardless — this only stops a control
 * being offered.
 */

import { renderHook } from "@testing-library/react-native";
import type { Me } from "../../api";
import { useMe } from "../useMe";
import { usePermissions } from "../usePermissions";

jest.mock("../useMe");
const mockUseMe = useMe as jest.MockedFunction<typeof useMe>;

async function asRole(role: Me["role"] | null, isPending = false) {
  mockUseMe.mockReturnValue({
    data: role ? { id: "u1", name: "Test", role } : undefined,
    isPending
  } as ReturnType<typeof useMe>);
  const { result } = await renderHook(() => usePermissions());
  return result.current;
}

describe("usePermissions", () => {
  it("gives an admin everything", async () => {
    const p = await asRole("ADMIN");
    expect(p).toMatchObject({
      role: "ADMIN",
      canRead: true,
      canWrite: true,
      isAdmin: true,
      canViewIdProof: true,
      canManageCommittee: true
    });
  });

  it("lets a collector write but never view an ID proof or manage the committee", async () => {
    const p = await asRole("COLLECTOR");
    expect(p).toMatchObject({
      role: "COLLECTOR",
      canRead: true,
      canWrite: true,
      isAdmin: false,
      // The strictest rule in the app: capture yes, view never (spec §4.3).
      canViewIdProof: false,
      canManageCommittee: false
    });
  });

  it("gives a viewer read access only", async () => {
    const p = await asRole("VIEWER");
    expect(p).toMatchObject({
      role: "VIEWER",
      canRead: true,
      canWrite: false,
      isAdmin: false,
      canViewIdProof: false,
      canManageCommittee: false
    });
  });

  it("denies everything while /me is still loading", async () => {
    // Otherwise a write button flashes into view for a viewer on every cold start.
    const p = await asRole(null, true);
    expect(p.loading).toBe(true);
    expect(p.canRead).toBe(false);
    expect(p.canWrite).toBe(false);
    expect(p.isAdmin).toBe(false);
    expect(p.canViewIdProof).toBe(false);
    expect(p.canManageCommittee).toBe(false);
  });

  it("denies everything when there is no role at all", async () => {
    const p = await asRole(null);
    expect(p.role).toBeNull();
    expect(p.canWrite).toBe(false);
    expect(p.canViewIdProof).toBe(false);
  });
});
