import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { errorMessage } from "../../api";
import { Banner, Button, Card, ErrorState, Field, LoadingScreen, Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { formatDate, formatMoney } from "../../utils/format";
import { useSpending, useUpdateSpending } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "SpendingEdit">;

/**
 * Fix a spending's wording — what it was for, the vendor, the notes. Admin only. The money
 * (amount, date, paying fund) is not editable by design; the screen says how to fix that.
 */
export function SpendingEditScreen({ navigation, route }: Props) {
  const { spendingId } = route.params;
  const spending = useSpending(spendingId);
  const update = useUpdateSpending(spendingId);
  const [title, setTitle] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded || !spending.data) return;
    setTitle(spending.data.title);
    setVendor(spending.data.vendor ?? "");
    setNotes(spending.data.notes ?? "");
    setLoaded(true);
  }, [loaded, spending.data]);

  if (spending.isPending) return <LoadingScreen />;
  if (spending.error || !spending.data) {
    return (
      <Screen>
        <ErrorState error={spending.error} title="Couldn't load the spending" onRetry={spending.refetch} />
      </Screen>
    );
  }
  const s = spending.data;

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError("Say what it was for.");
      return;
    }
    try {
      await update.mutateAsync({
        title: title.trim(),
        ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {})
      });
      navigation.goBack();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={typography.body}>
          {formatMoney(s.amount)} · {formatDate(s.spentOn)}
        </Text>
        <Text style={typography.bodySmall}>
          The amount, date and fund can&apos;t be changed here — void the entry and add it again.
        </Text>
      </Card>
      <Field label="What was it for?" value={title} onChangeText={setTitle} />
      <Field label="Paid to (optional)" value={vendor} onChangeText={setVendor} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      {error ? <Banner message={error} /> : null}
      <Button label="Save changes" loading={update.isPending} onPress={save} />
      <Button label="Cancel" variant="secondary" disabled={update.isPending} onPress={() => navigation.goBack()} />
    </Screen>
  );
}
