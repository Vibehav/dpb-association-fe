/**
 * A shop must never be left without a licence holder it cannot get back.
 *
 * The API used to let an admin delete a member and silently take their OWNER links with
 * them, stranding those shops: registration was past, add-link rejects OWNER, and Transfer
 * refused with `no_owner` because it had no holder to move. The API now guards the delete
 * (409 `person_is_owner`) and lets Transfer *install* into a vacancy.
 *
 * Two things are asserted here. **The delete is stopped in the UI**, not merely handled —
 * an admin should read why before tapping, not after. And **the ownerless state is
 * legible**: the shop says it has no holder and points at the one action that fixes it,
 * rather than rendering a people list that is quietly one row short.
 */

import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { peopleApi, shopsApi, type PersonProfile, type ShopDetail } from "../../../api";
import { usePermissions } from "../../../auth/usePermissions";
import { testQueryClient, withQueryClient } from "../../../testing/render";
import { PersonProfileScreen } from "../../people/PersonProfileScreen";
import { ShopDetailScreen } from "../ShopDetailScreen";
import { ShopTransferScreen } from "../ShopTransferScreen";

jest.mock("../../../auth/usePermissions");

// Both detail screens refresh on focus, which needs a real NavigationContainer. These
// render a screen in isolation, so the focus hook is stubbed rather than staged.
jest.mock("../../../hooks/useRefreshOnFocus", () => ({ useRefreshOnFocus: () => undefined }));

// MemberPhoto / IdProofPanel pull in the camera stack; neither is under test here.
jest.mock("../../../media", () => ({
  useImageCapture: () => ({
    state: { status: "empty" },
    key: null,
    previewUri: null,
    busy: false,
    captureFromCamera: jest.fn(),
    pickFromLibrary: jest.fn(),
    retry: jest.fn(),
    clear: jest.fn()
  })
}));

const mockPermissions = usePermissions as jest.MockedFunction<typeof usePermissions>;

function asRole(isAdmin: boolean) {
  mockPermissions.mockReturnValue({
    role: isAdmin ? "ADMIN" : "COLLECTOR",
    loading: false,
    canRead: true,
    canWrite: true,
    isAdmin,
    canViewIdProof: isAdmin,
    canChangeIdProofType: isAdmin,
    canCaptureIdProof: true,
    canRemoveIdProof: isAdmin,
    canManageCommittee: isAdmin
  });
}

const owner = { linkId: 11, personId: 1, name: "Ramesh Patil", phone: "9820020001", role: "OWNER" as const };
const renter = { linkId: 12, personId: 2, name: "Sunil Rane", phone: "9820020002", role: "RENTER" as const };

const shop: ShopDetail = {
  id: 101,
  shopNumber: "A-31",
  businessName: "Shree Traders",
  lane: "Lane 2",
  tenancy: "OWNER_RUN",
  formerHolderName: null,
  formerHolderTill: null,
  people: [owner, renter]
};

const person: PersonProfile = {
  id: 1,
  name: "Ramesh Patil",
  phone: "9820020001",
  whatsappPhone: "9820020001",
  address: "Lane 2",
  idProofType: "AADHAAR",
  idProofLast4: "1234",
  consent: true,
  addedByName: "Ishwar",
  addedOn: "2026-08-22T10:00:00Z",
  photoUrl: null,
  shops: []
};

const holdsLicence = {
  linkId: 11, shopId: 101, shopNumber: "A-31", businessName: "Shree Traders", role: "OWNER" as const
};
const rents = {
  linkId: 12, shopId: 102, shopNumber: "A-32", businessName: null, role: "RENTER" as const
};

let client: QueryClient;
const navigate = jest.fn();
const goBack = jest.fn();
const nav = { navigate, goBack, setOptions: jest.fn() } as never;

beforeEach(() => {
  client = testQueryClient();
  asRole(true);
});

afterEach(() => {
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
  navigate.mockReset();
  goBack.mockReset();
});

async function renderShop(overrides: Partial<ShopDetail> = {}) {
  jest.spyOn(shopsApi, "detail").mockResolvedValue({ ...shop, ...overrides });
  const view = await render(
    <ShopDetailScreen
      navigation={nav}
      route={{ key: "k", name: "ShopDetail", params: { shopId: 101 } } as never}
    />,
    { wrapper: withQueryClient(client) }
  );
  await waitFor(() => expect(view.getByText("A-31")).toBeTruthy());
  return view;
}

async function renderTransfer(overrides: Partial<ShopDetail> = {}) {
  jest.spyOn(shopsApi, "detail").mockResolvedValue({ ...shop, ...overrides });
  const view = await render(
    <ShopTransferScreen
      navigation={nav}
      route={{ key: "k", name: "ShopTransfer", params: { shopId: 101 } } as never}
    />,
    { wrapper: withQueryClient(client) }
  );
  await waitFor(() => expect(view.getByText("Current licence holder")).toBeTruthy());
  return view;
}

async function renderPerson(shops: PersonProfile["shops"]) {
  jest.spyOn(peopleApi, "detail").mockResolvedValue({ ...person, shops });
  const view = await render(
    <PersonProfileScreen
      navigation={nav}
      route={{ key: "k", name: "PersonProfile", params: { personId: 1 } } as never}
    />,
    { wrapper: withQueryClient(client) }
  );
  await waitFor(() => expect(view.getByText("Details")).toBeTruthy());
  return view;
}

// ---- the delete is stopped before it is attempted --------------------------

describe("deleting a member who holds a licence", () => {
  it("is refused on screen, naming the shop, and nothing is sent", async () => {
    const remove = jest.spyOn(peopleApi, "remove");
    const view = await renderPerson([holdsLicence]);

    expect(view.getByText(/holds the licence on A-31/)).toBeTruthy();
    expect(view.getByLabelText("Delete member")).toBeDisabled();

    // Pressing a disabled Button must not open the confirm sheet, let alone call the API.
    fireEvent.press(view.getByLabelText("Delete member"));
    expect(view.queryByText("Delete Ramesh Patil?")).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("offers a way through — straight to that shop's transfer", async () => {
    const view = await renderPerson([holdsLicence]);

    fireEvent.press(view.getByLabelText("Transfer licence for A-31"));

    expect(navigate).toHaveBeenCalledWith("ShopTransfer", { shopId: 101 });
  });

  it("names every shop when the member holds more than one licence", async () => {
    const view = await renderPerson([
      holdsLicence,
      { linkId: 13, shopId: 103, shopNumber: "A-30", businessName: null, role: "OWNER" }
    ]);

    expect(view.getByText(/A-31, A-30/)).toBeTruthy();
    expect(view.getByLabelText("Transfer licence for A-30")).toBeTruthy();
  });

  it("leaves the delete alone for a member who only rents", async () => {
    const view = await renderPerson([rents]);

    expect(view.queryByText(/holds the licence/)).toBeNull();
    expect(view.getByLabelText("Delete member")).not.toBeDisabled();
  });

  it("leaves the delete alone for a member linked to nothing", async () => {
    const view = await renderPerson([]);

    expect(view.getByLabelText("Delete member")).not.toBeDisabled();
  });
});

// ---- the ownerless state is legible ----------------------------------------

describe("a shop with no licence holder", () => {
  it("says so, and points an admin at the action that fixes it", async () => {
    const view = await renderShop({ people: [renter] });

    expect(view.getByText(/No licence holder on record/)).toBeTruthy();
    expect(view.getByLabelText("Assign licence holder")).toBeTruthy();
    // "Transfer licence" would read as moving something that isn't there.
    expect(view.queryByLabelText("Transfer licence")).toBeNull();
  });

  it("tells a non-admin who to ask rather than showing a button they can't use", async () => {
    asRole(false);
    const view = await renderShop({ people: [renter] });

    expect(view.getByText(/An admin can assign one/)).toBeTruthy();
    expect(view.queryByLabelText("Assign licence holder")).toBeNull();
  });

  it("renders at all with nobody linked — an empty people list is a valid shape", async () => {
    const view = await renderShop({ people: [] });

    expect(view.getByText(/No licence holder on record/)).toBeTruthy();
  });

  it("says nothing when the shop has a holder", async () => {
    const view = await renderShop();

    expect(view.queryByText(/No licence holder on record/)).toBeNull();
    expect(view.getByLabelText("Transfer licence")).toBeTruthy();
  });
});

// ---- the transfer screen does not claim a predecessor ----------------------

describe("the transfer screen on an ownerless shop", () => {
  it("describes assigning, not replacing — nobody is being succeeded", async () => {
    const view = await renderTransfer({ people: [renter] });

    expect(view.getByText("None on record.")).toBeTruthy();
    expect(view.getByText("What assigning does")).toBeTruthy();
    expect(view.queryByText("What a transfer does")).toBeNull();
    expect(view.getByLabelText("Choose licence holder")).toBeTruthy();
  });

  it("promises the former-holder record is left alone", async () => {
    // Installing into a vacancy must not overwrite the last real handover with a null.
    const view = await renderTransfer({
      people: [renter],
      formerHolderName: "Ramesh Patil",
      formerHolderTill: "2026-09-01"
    });

    expect(view.getByText(/stays as it is/)).toBeTruthy();
  });

  it("still describes a real handover as a replacement", async () => {
    const view = await renderTransfer();

    expect(view.getByText("What a transfer does")).toBeTruthy();
    expect(view.getByText(/is replaced as licence holder/)).toBeTruthy();
    expect(view.getByLabelText("Choose new licence holder")).toBeTruthy();
  });
});
