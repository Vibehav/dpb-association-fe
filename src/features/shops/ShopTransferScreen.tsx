import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Text } from "react-native";
import { errorMessage, type PersonListItem, type TransferRequest } from "../../api";
import { PersonSearchSheet } from "../../components/search/PersonSearchSheet";
import { Banner, BusinessName, Button, Card, ErrorState, LoadingScreen, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { formatPhone } from "../../utils/phone";
import { MemberForm } from "../people/MemberForm";
import { useShop, useTransferLicence } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "ShopTransfer">;

/**
 * Transfer the licence — sale, death, or handover to a son (integration doc §5.5).
 *
 * Admin only. The screen must state the consequences *before* confirming: the old holder is
 * replaced, and their past contributions stay on their own profile because they were their
 * payments.
 *
 * `tillDate` is left to the server, which defaults it to today. A date picker for
 * backdating a transfer is worth adding if the committee asks for it.
 *
 * The screen does double duty. On a shop with **no** holder — one whose owner was deleted
 * before the API guarded that — the same endpoint installs a holder instead of replacing
 * one, and it is the only way out of that state. Nothing is being taken from anyone there,
 * so the consequence copy must not claim a predecessor, and the former-holder record on the
 * shop is left as it is.
 */
export function ShopTransferScreen({ navigation, route }: Props) {
  const { shopId } = route.params;
  const shop = useShop(shopId);
  const transfer = useTransferLicence(shopId);

  const [searchOpen, setSearchOpen] = useState(false);
  const [creating, setCreating] = useState(false);
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
  const currentOwner = data.people.find((link) => link.role === "OWNER");
  const isAssignment = !currentOwner;

  async function run(body: TransferRequest) {
    setError(null);
    try {
      await transfer.mutateAsync(body);
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
          {isAssignment ? "Licence holder for" : "New licence holder for"} {data.shopNumber}
        </Text>
        <MemberForm
          submitLabel={isAssignment ? "Assign licence holder" : "Transfer licence"}
          submitting={transfer.isPending}
          error={error}
          onSubmit={(person) => run({ newPerson: person })}
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
        <Text style={typography.eyebrow}>Current licence holder</Text>
        {currentOwner ? (
          <>
            <Text style={typography.cardTitle}>{currentOwner.name}</Text>
            <Text style={typography.body}>{formatPhone(currentOwner.phone)}</Text>
          </>
        ) : (
          <Text style={typography.body}>None on record.</Text>
        )}
      </Card>

      <Card>
        {isAssignment ? (
          <>
            <Text style={typography.eyebrow}>What assigning does</Text>
            <Text style={typography.body}>
              This shop has no licence holder on record. The member you choose becomes the
              holder — nobody is being replaced, so no former holder is recorded and anything
              already shown as &quot;Previously&quot; on the shop stays as it is.
            </Text>
          </>
        ) : (
          <>
            <Text style={typography.eyebrow}>What a transfer does</Text>
            <Text style={typography.body}>
              {currentOwner.name} is replaced as licence holder, and this shop records them as
              the former holder with today&apos;s date.
            </Text>
            <Text style={typography.body}>
              Everything they have contributed stays on their own profile — those were their
              payments. Nothing moves to the new holder.
            </Text>
          </>
        )}
      </Card>

      {error ? <Banner message={error} /> : null}

      <Button
        label={isAssignment ? "Choose licence holder" : "Choose new licence holder"}
        icon="search"
        onPress={() => setSearchOpen(true)}
      />

      <PersonSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={isAssignment ? "Licence holder" : "New licence holder"}
        hint="Search first — a duplicate profile splits someone's record in two."
        // The current owner can't be transferred to themselves (400 `already_owner`).
        excludeIds={currentOwner ? [currentOwner.personId] : []}
        onPickExisting={(person: PersonListItem) => {
          setSearchOpen(false);
          run({ existingPersonId: person.id });
        }}
        onCreateNew={() => {
          setSearchOpen(false);
          setCreating(true);
        }}
      />
    </Screen>
  );
}
