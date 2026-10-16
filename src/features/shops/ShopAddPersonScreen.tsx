import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Text } from "react-native";
import {
  errorMessage,
  LINKABLE_ROLES,
  type AddShopLinkRequest,
  type LinkableRole,
  type PersonListItem
} from "../../api";
import { PersonSearchSheet } from "../../components/search/PersonSearchSheet";
import {
  Banner,
  BusinessName,
  Button,
  Card,
  Chip,
  ChipRow,
  ErrorState,
  LoadingScreen,
  Screen
} from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { roleLabel } from "../../utils/format";
import { MemberForm } from "../people/MemberForm";
import { useAddShopLink, useShop } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "ShopAddPerson">;

/**
 * Link a renter or a worker to a shop (integration doc §5.7).
 *
 * Role choices are **RENTER and STAFF only** — an OWNER link here is a 400
 * `owner_not_addable`, because owners exist solely through registration or transfer.
 *
 * A screen rather than a bottom sheet: the "create new" branch renders the full member
 * form with two image captures, which a sheet can't hold usefully.
 */
export function ShopAddPersonScreen({ navigation, route }: Props) {
  const { shopId } = route.params;
  const shop = useShop(shopId);
  const addLink = useAddShopLink(shopId);

  const [role, setRole] = useState<LinkableRole>("STAFF");
  const [searchOpen, setSearchOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  /** The name typed in the search that found nobody — the new person's form starts with it. */
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (shop.isPending) return <LoadingScreen />;
  if (shop.error || !shop.data) {
    return (
      <Screen>
        <ErrorState error={shop.error} title="Couldn't load the shop" onRetry={shop.refetch} />
      </Screen>
    );
  }

  const data = shop.data;
  const hasRenter = data.people.some((link) => link.role === "RENTER");
  const linkedIds = data.people.map((link) => link.personId);

  async function link(body: AddShopLinkRequest) {
    setError(null);
    try {
      await addLink.mutateAsync(body);
      navigation.goBack();
    } catch (caught) {
      setCreating(false);
      setError(errorMessage(caught));
    }
  }

  if (creating) {
    return (
      <Screen>
        <Text style={typography.eyebrow}>
          New {roleLabel(role).toLowerCase()} at {data.shopNumber}
        </Text>
        <MemberForm
          initialName={newName}
          submitLabel={`Add as ${roleLabel(role).toLowerCase()}`}
          submitting={addLink.isPending}
          error={error}
          onSubmit={(person) => link({ role, newPerson: person })}
          onBack={() => {
            setError(null);
            setCreating(false);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Text style={typography.cardTitle}>{data.shopNumber}</Text>
        <BusinessName businessName={data.businessName} style={typography.cardTitle} />
        <Text style={typography.body}>
          The licence holder is set through registration or a transfer, so only a renter or a
          worker can be added here.
        </Text>
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Their role at this shop</Text>
        <ChipRow>
          {LINKABLE_ROLES.map((value) => (
            <Chip
              key={value}
              label={roleLabel(value)}
              selected={role === value}
              onPress={() => setRole(value)}
            />
          ))}
        </ChipRow>
        {/* Surfaced before the attempt; the server also answers 409 `renter_exists`. */}
        {role === "RENTER" && hasRenter ? (
          <Banner
            tone="notice"
            message="This shop already has a renter. Remove the current one first, or add this person as a worker."
          />
        ) : null}
      </Card>

      {error ? <Banner message={error} /> : null}

      <Button
        label="Choose member"
        icon="search"
        disabled={role === "RENTER" && hasRenter}
        onPress={() => setSearchOpen(true)}
      />

      <PersonSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={`Add a ${roleLabel(role).toLowerCase()}`}
        hint="Search first — a duplicate profile splits someone's record in two."
        excludeIds={linkedIds}
        onPickExisting={(person: PersonListItem) => {
          setSearchOpen(false);
          link({ role, existingPersonId: person.id });
        }}
        onCreateNew={(typedName) => {
          setSearchOpen(false);
          setNewName(typedName);
          setCreating(true);
        }}
      />
    </Screen>
  );
}
