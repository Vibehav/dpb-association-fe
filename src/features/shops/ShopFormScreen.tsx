import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage, isCode, type NewPersonPayload, type PersonListItem, type Tenancy } from "../../api";
import { PersonPicker } from "../../components/search/PersonPicker";
import { Banner, Button, Card, Chip, ChipRow, ErrorState, Field, LoadingScreen, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { formatPhone } from "../../utils/phone";
import { firstError, validateBusinessName, validateLane, validateShopNumber } from "../../utils/validators";
import { MemberForm } from "../people/MemberForm";
import { useRegisterShop, useShop, useUpdateShop } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "ShopForm">;

/** Prototype `rentedOptions`. */
const TENANCIES: { value: Tenancy; label: string }[] = [
  { value: "OWNER_RUN", label: "Run by owner" },
  { value: "RENTED_OUT", label: "Rented out" }
];

/** Prototype `holderModes`. */
type HolderMode = "existing" | "new";

/**
 * Register a shop, or edit one. Follows the prototype's `isAddShop` screen.
 *
 * The licence holder is a **two-mode choice**, not a hidden one: "Pick an existing member"
 * reveals an inline search in place, "Add a new person" continues to the member form as
 * step 2. An earlier version had a single button that opened the pick sheet, which made
 * onboarding a brand-new owner hard to find.
 *
 * The new-person branch does **not** call `POST /people`. Its payload is embedded in
 * `POST /shops` as `owner.newPerson`, so the shop and its OWNER link are created in one
 * transaction and the person is never momentarily shopless (integration doc §5.4).
 *
 * **Not implemented, deliberately:** the design's *Floor* chip row. The v1 API has no
 * `floor` column (api slice 1: "No wings, no floors"), and the decision was to leave the API
 * as it is. *Wing or lane* is a free-text field rather than the design's chips for the same
 * reason — `lane` is free text with no master list.
 */
export function ShopFormScreen({ navigation, route }: Props) {
  const shopId = route.params?.shopId;
  const editing = Boolean(shopId);

  const existing = useShop(shopId ?? "");
  const register = useRegisterShop();
  const update = useUpdateShop(shopId ?? "");

  const [step, setStep] = useState<"shop" | "owner">("shop");
  const [shopNumber, setShopNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [lane, setLane] = useState("");
  const [tenancy, setTenancy] = useState<Tenancy>("OWNER_RUN");
  const [holderMode, setHolderMode] = useState<HolderMode | null>(null);
  const [owner, setOwner] = useState<PersonListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: editing ? "Edit shop" : "Register shop" });
  }, [editing, navigation]);

  useEffect(() => {
    const shop = existing.data;
    if (!editing || !shop) return;
    setShopNumber(shop.shopNumber);
    setBusinessName(shop.businessName);
    setLane(shop.lane);
    setTenancy(shop.tenancy);
  }, [editing, existing.data]);

  if (editing && existing.isPending) return <LoadingScreen />;
  if (editing && existing.error) {
    return (
      <Screen>
        <ErrorState error={existing.error} title="Couldn't load the shop" onRetry={existing.refetch} />
      </Screen>
    );
  }

  const shopFields = {
    shopNumber: shopNumber.trim(),
    businessName: businessName.trim(),
    lane: lane.trim(),
    tenancy
  };

  function validateShopFields() {
    const message = firstError(
      validateShopNumber(shopNumber),
      validateBusinessName(businessName),
      validateLane(lane)
    );
    setFormError(message);
    return message === null;
  }

  function handleFailure(caught: unknown) {
    // A taken shop number belongs on the field, not in a generic banner — and step 1 has to
    // be visible for the user to fix it.
    if (isCode(caught, "duplicate_shop_number")) {
      setFieldError("A shop with this number already exists.");
      setFormError(null);
      setStep("shop");
      return;
    }
    setFieldError(null);
    setFormError(errorMessage(caught));
  }

  async function saveEdit() {
    if (!validateShopFields()) return;
    setFieldError(null);
    try {
      // All four fields go on every edit (integration doc §5.3).
      await update.mutateAsync(shopFields);
      navigation.goBack();
    } catch (caught) {
      handleFailure(caught);
    }
  }

  /** "Save shop & continue" — either registers now, or moves to step 2. */
  async function saveAndContinue() {
    if (!validateShopFields()) return;

    if (!holderMode) {
      setFormError("Choose the licence holder — pick an existing member, or add a new person.");
      return;
    }
    if (holderMode === "new") {
      setFormError(null);
      setStep("owner");
      return;
    }
    if (!owner) {
      setFormError("Search for the licence holder, or switch to adding a new person.");
      return;
    }

    setFieldError(null);
    try {
      const shop = await register.mutateAsync({
        ...shopFields,
        owner: { existingPersonId: owner.id }
      });
      navigation.replace("ShopDetail", { shopId: shop.id });
    } catch (caught) {
      handleFailure(caught);
    }
  }

  async function registerWithNewOwner(person: NewPersonPayload) {
    try {
      const shop = await register.mutateAsync({ ...shopFields, owner: { newPerson: person } });
      navigation.replace("ShopDetail", { shopId: shop.id });
    } catch (caught) {
      handleFailure(caught);
    }
  }

  // --- step 2 of 2: capture a brand-new licence holder -------------------------
  if (step === "owner") {
    return (
      <Screen>
        <Text style={typography.eyebrow}>Step 2 of 2 · licence holder</Text>
        <Card>
          <Text style={typography.cardTitle}>
            {shopFields.shopNumber} · {shopFields.businessName}
          </Text>
          <Text style={typography.body}>
            This person becomes the licence holder. Changing them later needs a licence transfer.
          </Text>
        </Card>
        <MemberForm
          submitLabel="Save shop & owner"
          submitting={register.isPending}
          error={formError}
          onSubmit={registerWithNewOwner}
          onBack={() => {
            setFormError(null);
            setStep("shop");
          }}
        />
      </Screen>
    );
  }

  // --- step 1: the shop itself -------------------------------------------------
  return (
    <Screen>
      {!editing ? <Text style={typography.eyebrow}>Step 1 of 2 · the shop</Text> : null}

      <Card>
        <Field
          label="Shop number"
          placeholder="A-31"
          value={shopNumber}
          onChangeText={(next) => {
            setShopNumber(next);
            setFieldError(null);
          }}
          error={fieldError}
          autoCapitalize="characters"
        />
        <Field
          label="Business name on the board"
          placeholder="e.g. Shree Ganesh Flowers"
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
        />
        <Field
          label="Wing or lane"
          placeholder="e.g. A Wing, Lane 3"
          value={lane}
          onChangeText={setLane}
          autoCapitalize="words"
        />

        <Text style={typography.eyebrow}>How it is run</Text>
        <ChipRow>
          {TENANCIES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={tenancy === option.value}
              onPress={() => setTenancy(option.value)}
            />
          ))}
        </ChipRow>
      </Card>

      {!editing ? (
        <Card>
          <Text style={typography.eyebrow}>Licence holder</Text>
          <ChipRow>
            <Chip
              label="Pick an existing member"
              selected={holderMode === "existing"}
              onPress={() => {
                setHolderMode("existing");
                setFormError(null);
              }}
            />
            <Chip
              label="Add a new person"
              selected={holderMode === "new"}
              onPress={() => {
                setHolderMode("new");
                setOwner(null);
                setFormError(null);
              }}
            />
          </ChipRow>

          {/* Revealed in place, so the shop fields stay visible above it. */}
          {holderMode === "existing" && !owner ? (
            <PersonPicker
              onPick={(person) => {
                setOwner(person);
                setFormError(null);
              }}
            />
          ) : null}

          {holderMode === "existing" && owner ? (
            <View style={styles.picked}>
              <Text style={typography.cardTitle}>{owner.name}</Text>
              <Text style={styles.mono}>{formatPhone(owner.phone)}</Text>
              <Button label="Change" variant="ghost" onPress={() => setOwner(null)} />
            </View>
          ) : null}

          <Text style={typography.bodySmall}>{nextStepNote(holderMode, owner)}</Text>
        </Card>
      ) : null}

      {formError ? <Banner message={formError} /> : null}

      {editing ? (
        <Button label="Save changes" icon="checkmark" loading={update.isPending} onPress={saveEdit} />
      ) : (
        <Button
          label="Save shop & continue"
          icon="arrow-forward"
          loading={register.isPending}
          onPress={saveAndContinue}
        />
      )}
    </Screen>
  );
}

/** Prototype `nextStepNote` — tells the user what "continue" is about to do. */
function nextStepNote(mode: HolderMode | null, owner: PersonListItem | null) {
  if (!mode) return "A shop always has exactly one licence holder.";
  if (mode === "new") return "Next: their name, photo, phone, address and Aadhaar.";
  if (!owner) return "Search an existing member by name or phone number.";
  return `${owner.name} will hold the licence for this shop.`;
}

const styles = StyleSheet.create({
  picked: { gap: spacing.xs },
  mono: { ...typography.mono, fontSize: 12 }
});
