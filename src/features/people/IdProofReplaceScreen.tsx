import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { errorMessage, ID_PROOF_TYPES, isCode, type IdProofType } from "../../api";
import { ImageCaptureField } from "../../components/media/ImageCaptureField";
import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  ErrorState,
  Field,
  LoadingScreen,
  Screen
} from "../../components/ui";
import { imageFieldError, useImageCapture } from "../../media";
import type { AppStackParamList } from "../../navigation/types";
import { spacing, typography } from "../../theme";
import { idProofLabel, upperCase } from "../../utils/format";
import { firstError, validateIdProofLast4 } from "../../utils/validators";
import { usePerson, useReplaceIdProof } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "IdProofReplace">;

/**
 * Swap the whole document — the only way to change its type (api slice, `PUT /id-proof`).
 *
 * **This always replaces the whole document, and it has to.** The server writes `backKey`
 * and `last4` unconditionally, so omitting either wipes it — and this client can never
 * resend the existing back key, because it only ever holds short-lived *signed URLs*, never
 * keys. A key exists here solely as the output of a fresh upload. So there is no "keep the
 * back page" path to offer, and the notice banner says so rather than letting the deletion
 * happen invisibly.
 *
 * That is also why per-side re-capture exists on the panel: without it, fixing one blurry
 * front would destroy the back image and the last four every single time.
 *
 * A modal screen rather than a Sheet because `Sheet` has no ScrollView, and two capture
 * frames plus a chip row and a field do not fit a phone viewport.
 *
 * Since client revision v2 this screen also serves the **first capture** on a pending member,
 * because it is the same request — `PUT /id-proof` carrying the type and the images. Only the
 * wording differs, and it has to: there is nothing being replaced, nothing being destroyed,
 * and a collector may do it. Splitting it into a second screen would have duplicated the
 * capture, validation and last-four handling to change six strings.
 */
export function IdProofReplaceScreen({ navigation, route }: Props) {
  const { personId } = route.params;
  const person = usePerson(personId);
  const replace = useReplaceIdProof(personId);

  const [type, setType] = useState<IdProofType>("AADHAAR");
  const [last4, setLast4] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const front = useImageCapture("ID_PROOF_FRONT");
  const back = useImageCapture("ID_PROOF_BACK");

  const loaded = person.data;

  // Adopt the stored type once, then follow the picker. A pending member has none, so the
  // default stands and the collector picks whatever the member has brought.
  useEffect(() => {
    if (loaded?.idProofType) setType(loaded.idProofType);
  }, [loaded?.idProofType]);

  /**
   * Prefill the last four **only while the document is the same one**.
   *
   * Carrying an Aadhaar's last four onto a passport would not be ignored server-side — the
   * setter runs unconditionally, so a stale prefill is *saved*. Changing the chip back
   * restores it. This only re-runs on a chip tap, so it never stomps typing.
   */
  useEffect(() => {
    if (!loaded) return;
    setLast4(type === loaded.idProofType ? upperCase(loaded.idProofLast4 ?? "") : "");
  }, [type, loaded?.idProofType, loaded?.idProofLast4]);

  // The modal's title is set on the stack as "Replace ID proof", which is wrong — and
  // alarming — when nothing is on file yet.
  useEffect(() => {
    if (!loaded) return;
    navigation.setOptions({
      title: loaded.idProofType ? "Replace ID proof" : "Capture ID proof"
    });
  }, [loaded?.idProofType, navigation]);

  if (person.isPending) return <LoadingScreen />;
  if (person.error || !loaded) {
    return (
      <Screen>
        <ErrorState error={person.error} title="Couldn't load the member" onRetry={person.refetch} />
      </Screen>
    );
  }

  // Nothing on file: this is a first capture, not a swap. Drives every string below, and the
  // permission rule too — the server opens `PUT /id-proof` to collectors in exactly this state.
  const firstCapture = loaded.idProofType === null;

  function submit() {
    const message = firstError(
      validateIdProofLast4(last4),
      imageFieldError(front, `The ${idProofLabel(type).toLowerCase()} front`),
      // An optional slot that was *attempted* is not the same as one never touched. Without
      // this, a failed back upload submits silently and the user believes a back was stored.
      back.state.status === "empty"
        ? null
        : imageFieldError(back, `The ${idProofLabel(type).toLowerCase()} back`)
    );
    setFormError(message);
    if (message) return;

    const trimmed = last4.trim();
    replace.mutate(
      {
        type,
        frontKey: front.key as string,
        // No stale key is possible — see the note at the top. No new back capture means the
        // back is cleared server-side, which the notice banner states plainly.
        ...(back.key ? { backKey: back.key } : {}),
        // Omit rather than send "": the API's @Pattern has no @NotBlank beside it.
        ...(trimmed ? { last4: trimmed } : {})
      },
      {
        onSuccess: () => navigation.goBack(),
        onError: (caught) =>
          setFormError(
            // Belt-and-braces: the entry point is admin-gated, so a collector should never
            // get here. If one does, say what to do next rather than "no permission".
            isCode(caught, "forbidden")
              ? "Only an admin can change the document type. Ask an admin to do this."
              : errorMessage(
                  caught,
                  firstCapture ? "Couldn't save the document." : "Couldn't replace the document."
                )
          )
      }
    );
  }

  const busy = replace.isPending || front.busy || back.busy;

  return (
    <Screen>
      <Banner
        tone="notice"
        message={
          firstCapture
            ? "This member has no ID proof on file yet. Capture the document they are holding — the back page too, if it has one."
            : "Replacing swaps the whole document. The images on file are removed — capture the new document's back page here if it has one."
        }
      />

      <Card>
        <Text style={typography.eyebrow}>Document type</Text>
        <ChipRow>
          {ID_PROOF_TYPES.map((option) => (
            <Chip
              key={option}
              label={idProofLabel(option)}
              selected={type === option}
              onPress={() => setType(option)}
            />
          ))}
        </ChipRow>

        <ImageCaptureField
          label={
            firstCapture
              ? `${idProofLabel(type)} front`
              : `New ${idProofLabel(type).toLowerCase()} front`
          }
          type="ID_PROOF_FRONT"
          capture={front}
          required
          note="Stored encrypted. Once saved, only the admin can open it — collectors cannot view it again."
        />
        <ImageCaptureField
          label={
            firstCapture
              ? `${idProofLabel(type)} back`
              : `New ${idProofLabel(type).toLowerCase()} back`
          }
          type="ID_PROOF_BACK"
          capture={back}
        />
        <Field
          label={`${idProofLabel(type)} — last 4 (optional)`}
          placeholder="1234"
          value={last4}
          // Letters as well as digits, and no number pad — a PAN's last four contain one.
          onChangeText={(next) => setLast4(next.replace(/[^A-Za-z0-9]/g, "").slice(0, 4))}
          autoCorrect={false}
          maxLength={4}
          uppercase
        />
      </Card>

      {formError ? <Banner message={formError} /> : null}

      <View style={styles.actions}>
        <Button
          label={firstCapture ? "Save ID proof" : "Replace document"}
          icon={firstCapture ? "camera-outline" : "swap-horizontal-outline"}
          loading={replace.isPending}
          onPress={submit}
        />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => navigation.goBack()}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm }
});
