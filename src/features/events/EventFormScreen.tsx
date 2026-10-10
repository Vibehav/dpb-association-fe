import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { errorMessage, type EventRequest } from "../../api";
import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  DateField,
  ErrorState,
  Field,
  LoadingScreen,
  Screen
} from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { todayIso } from "../../utils/format";
import { useCreateEvent, useEvent, useUpdateEvent } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "EventForm">;

/**
 * Create an event, or edit one that isn't closed (spec §10.1) — admin only.
 *
 * The important choice is the money: an **own fund** collects donations kept apart from the
 * general fund; **spend from general fund** collects nothing, and every bill comes out of the
 * general fund. Once anything has been recorded against an event its type is fixed — the
 * server refuses the switch, and the choice is locked here too.
 */
export function EventFormScreen({ navigation, route }: Props) {
  const eventId = route.params?.eventId;
  const editing = eventId !== undefined;
  const existing = useEvent(eventId);
  const create = useCreateEvent();
  const update = useUpdateEvent(eventId ?? -1);

  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState<string | null>(editing ? null : todayIso());
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [ownFund, setOwnFund] = useState(true);
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: editing ? "Edit event" : "Create event" });
  }, [navigation, editing]);

  useEffect(() => {
    if (loaded || !existing.data) return;
    const e = existing.data;
    setName(e.name);
    setStartsOn(e.startsOn);
    setEndsOn(e.endsOn);
    setOwnFund(e.ownFund);
    setLoaded(true);
  }, [loaded, existing.data]);

  if (editing && existing.isPending) return <LoadingScreen />;
  if (editing && (existing.error || !existing.data)) {
    return (
      <Screen>
        <ErrorState error={existing.error} title="Couldn't load the event" onRetry={existing.refetch} />
      </Screen>
    );
  }

  const typeLocked = editing && existing.data?.hasEntries === true;
  const busy = create.isPending || update.isPending;

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Enter the event name.");
      return;
    }
    if (!startsOn) {
      setError("Choose the start date.");
      return;
    }
    if (endsOn && endsOn < startsOn) {
      setError("The end date is before the start date.");
      return;
    }
    const body: EventRequest = { name: name.trim(), startsOn, ownFund, ...(endsOn ? { endsOn } : {}) };
    try {
      if (editing) {
        await update.mutateAsync(body);
        navigation.goBack();
      } else {
        const created = await create.mutateAsync(body);
        navigation.replace("Event", { eventId: created.id });
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen>
      <Text style={typography.bodySmall}>Ganeshotsav, Shiv Jayanti, Navratri, a market function…</Text>
      <Field label="Event name" value={name} onChangeText={setName} placeholder="Ganeshotsav 2026" />
      <DateField label="Starts" value={startsOn} onChange={setStartsOn} />
      <DateField
        label="Ends (optional)"
        value={endsOn}
        onChange={setEndsOn}
        minimumDate={startsOn ?? undefined}
        placeholder="No end date"
        clearable
      />

      <Card>
        <Text style={typography.eyebrow}>Money for this event</Text>
        <ChipRow>
          <Chip label="Own fund" selected={ownFund} disabled={typeLocked} onPress={() => setOwnFund(true)} />
          <Chip
            label="Spend from general fund"
            selected={!ownFund}
            disabled={typeLocked}
            onPress={() => setOwnFund(false)}
          />
        </ChipRow>
        <Text style={typography.bodySmall}>
          {ownFund
            ? "Donations tagged to this event are held separately. Individual bills can still be paid from the general fund."
            : "No separate collection — every spending for this event is paid out of the general fund."}
        </Text>
        {typeLocked ? (
          <Text style={typography.bodySmall}>Entries are already recorded against this event, so its type can't change.</Text>
        ) : null}
      </Card>

      {error ? <Banner message={error} /> : null}
      <Button label={editing ? "Save changes" : "Create event"} loading={busy} onPress={save} />
      <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => navigation.goBack()} />
    </Screen>
  );
}
