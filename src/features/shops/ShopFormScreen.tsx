import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  errorMessage,
  isCode,
  type NewPersonPayload,
  type PersonListItem,
  type Tenancy
} from "../../api";
import { Banner, Button, Card, Chip, ChipRow, ErrorState, Field, LoadingScreen, Screen } from "../../components/ui";
import { PersonSearchSheet } from "../../components/search/PersonSearchSheet";
import type { AppStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { formatPhone } from "../../utils/phone";
import { firstError, validateBusinessName, validateLane, validateShopNumber } from "../../utils/validators";
import { MemberForm } from "../people/MemberForm";
import { useRegisterShop, useShop, useUpdateShop } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "ShopForm">;

const TENANCIES: { value: Tenancy; label: string }[] = [
  { value: "OWNER_RUN", label: "Run by owner" },
  { value: "RENTED_OUT", label: "Rented out" }
];

/**
 * Register a shop, or edit one.
 *
 * Registration is the design's two-step flow (integration doc §5.4): the shop, then its
 * licence holder — an existing member, or a new person captured inline. The new-person
 * branch does **not** call `POST /people`; the payload is embedded in `POST /shops` so the
 * shop and its OWNER link are created in one transaction and the person is never
 * momentarily shopless.
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
  const [owner, setOwner] = useState<PersonListItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: editing ? "Edit shop" : "Register shop" });
  }, [editing, navigation]);

  // Prefill once the shop being edited arrives.
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
    // A taken shop number belongs on the field, not in a generic banner.
    if (isCode(caught, "duplicate_shop_number")) {
      setFieldError("A shop with this number already exists.");
      setFormError(null);
      setStep("shop");
      return;
    }
    setFieldError(null);
    setFormError(errorMessage(caught));
  }

  const shopFields = {
    shopNumber: shopNumber.trim(),
    businessName: businessName.trim(),
    lane: lane.trim(),
    tenancy
  };

  async function saveEdit() {
    if (!validateShopFields()) return;
    setFieldError(null);
    try {
      // All four fields are sent on every edit (integration doc §5.3).
      await update.mutateAsync(shopFields);
      navigation.goBack();
    } catch (caught) {
      handleFailure(caught);
    }
  }

  async function registerWithExistingOwner(personId: string) {
    if (!validateShopFields()) return;
    setFieldError(null);
    try {
      const shop = await register.mutateAsync({ ...shopFields, owner: { existingPersonId: personId } });
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

  // --- step 2 of 2: capture a brand-new licence holder --------------------------
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

  // --- step 1: the shop itself --------------------------------------------------
  return (
    <Screen>
      {!editing ? <Text style={typography.eyebrow}>Step 1 of 2 · the shop</Text> : null}

      <Card>
        <Field
          label="Shop number"
          placeholder="A-12"
          value={shopNumber}
          onChangeText={(next) => {
            setShopNumber(next);
            setFieldError(null);
          }}
          error={fieldError}
          autoCapitalize="characters"
        />
        <Field
          label="Business name"
          placeholder="The name on the board"
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
        />
        <Field
          label="Lane or wing"
          placeholder="Lane 2"
          value={lane}
          onChangeText={setLane}
          autoCapitalize="words"
        />
        <Text style={typography.eyebrow}>How it's run</Text>
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
          {owner ? (
            <>
              <Text style={typography.cardTitle}>{owner.name}</Text>
              <Text style={styles.mono}>{formatPhone(owner.phone)}</Text>
              <Button label="Change" variant="ghost" onPress={() => setSearchOpen(true)} />
            </>
          ) : (
            <>
              <Text style={typography.body}>
                A shop always has exactly one licence holder. Pick an existing member, or add a
                new person as step 2.
              </Text>
              <Button
                label="Choose licence holder"
                variant="secondary"
                icon="search"
                onPress={() => {
                  if (validateShopFields()) setSearchOpen(true);
                }}
              />
            </>
          )}
        </Card>
      ) : null}

      {formError ? <Banner message={formError} /> : null}

      {editing ? (
        <Button label="Save changes" icon="checkmark" loading={update.isPending} onPress={saveEdit} />
      ) : (
        <Button
          label="Register shop"
          icon="checkmark"
          loading={register.isPending}
          disabled={!owner}
          onPress={() => owner && registerWithExistingOwner(owner.id)}
        />
      )}

      <PersonSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Licence holder"
        hint="Search before adding — a second profile splits a member's record in two."
        onPickExisting={(person) => {
          setOwner(person);
          setSearchOpen(false);
        }}
        onCreateNew={() => {
          setSearchOpen(false);
          setOwner(null);
          setStep("owner");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mono: { ...typography.mono, fontSize: 12, marginBottom: spacing.xs }
});
