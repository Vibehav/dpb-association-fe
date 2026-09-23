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
        <Text style={typography.eyebrow}>New licence holder for {data.shopNumber}</Text>
        <MemberForm
          submitLabel="Transfer licence"
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
          <Text style={typography.body}>Not on record.</Text>
        )}
      </Card>

      <Card>
        <Text style={typography.eyebrow}>What a transfer does</Text>
        <Text style={typography.body}>
          {currentOwner?.name ?? "The current holder"} is replaced as licence holder, and this
          shop records them as the former holder with today&apos;s date.
        </Text>
        <Text style={typography.body}>
          Everything they have contributed stays on their own profile — those were their
          payments. Nothing moves to the new holder.
        </Text>
      </Card>

      {error ? <Banner message={error} /> : null}

      <Button label="Choose new licence holder" icon="search" onPress={() => setSearchOpen(true)} />

      <PersonSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="New licence holder"
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
