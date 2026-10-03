import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  errorMessage,
  isCode,
  PAYMENT_MODES,
  peopleApi,
  shopsApi,
  type CreateContributionRequest,
  type Id,
  type PaymentMode,
  type PersonShopLink,
  type Purpose
} from "../../api";
import { queryKeys } from "../../app/queryKeys";
import { useMe } from "../../auth/useMe";
import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmSheet,
  Field,
  PhoneField,
  Screen
} from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { typography } from "../../theme";
import { formatMoney, paymentModeLabel } from "../../utils/format";
import { normalisePhone } from "../../utils/phone";
import { validatePhone } from "../../utils/validators";
import { PayerPickerSheet } from "./components/PayerPickerSheet";
import { useCollect, useDonor } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "Collect">;

/** The design's quick amounts (prototype `[501,1001,2100,5100]`). */
const QUICK_AMOUNTS = [501, 1001, 2100, 5100];

type Payer =
  | { kind: "member"; id: Id; name: string; shops: Pick<PersonShopLink, "shopId" | "shopNumber" | "role">[] }
  | { kind: "donor"; id: Id; name: string; subtitle: string | null }
  | { kind: "newDonor" };

/** A fee year that can be collected for the chosen shop: this year (null) or an arrear. */
type FeeOption = { feeCycleId: Id | null; yearLabel: string; due: number };

/**
 * The collection form (spec §6.6) — the app's job number one.
 *
 * The payer is a member, a donor on record, or a new outside donor typed in here. An annual
 * fee is paid by a shop's licence holder only, for this year or for an arrear year, and may
 * be paid in parts: a short amount is confirmed before it is sent, and the server refuses it
 * anyway (409 `part_payment_unconfirmed`) if the confirmation is skipped — that answer opens
 * the same confirmation.
 *
 * Every figure shown (what is due, the year) comes from the shop's fee card; nothing about
 * the fee is computed here.
 */
export function CollectScreen({ navigation, route }: Props) {
  const params = route.params ?? {};
  const { data: me } = useMe();
  const collect = useCollect();

  const [payer, setPayer] = useState<Payer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [purpose, setPurpose] = useState<Purpose>(params.purpose ?? (params.shopId ? "ANNUAL_FEE" : "ONE_OFF"));
  const [shopId, setShopId] = useState<Id | null>(params.shopId ?? null);
  const [yearChoice, setYearChoice] = useState<Id | null | undefined>(params.feeCycleId);
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [notes, setNotes] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donorOrganisation, setDonorOrganisation] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The part-payment question, with the message to ask it in. */
  const [confirmPart, setConfirmPart] = useState<string | null>(null);

  // ---- preset payers --------------------------------------------------------
  const presetPerson = useQuery({
    queryKey: queryKeys.people.detail(params.personId ?? -1),
    queryFn: () => peopleApi.detail(params.personId as Id),
    enabled: params.personId !== undefined
  });
  const presetDonor = useDonor(params.donorId);
  const feeShop = useQuery({
    queryKey: queryKeys.shops.detail(shopId ?? -1),
    queryFn: () => shopsApi.detail(shopId as Id),
    enabled: shopId !== null && purpose === "ANNUAL_FEE"
  });

  useEffect(() => {
    if (payer) return;
    if (params.personId !== undefined && presetPerson.data) {
      const p = presetPerson.data;
      setPayer({ kind: "member", id: p.id, name: p.name, shops: p.shops });
    } else if (params.donorId !== undefined && presetDonor.data) {
      const d = presetDonor.data;
      setPayer({ kind: "donor", id: d.id, name: d.name, subtitle: d.organisation });
    } else if (params.personId === undefined && params.shopId !== undefined && feeShop.data) {
      // From a shop's Collect: the fee is paid by its licence holder, so that is the payer.
      const owner = feeShop.data.people.find((link) => link.role === "OWNER");
      if (owner) {
        setPayer({
          kind: "member",
          id: owner.personId,
          name: owner.name,
          shops: [{ shopId: feeShop.data.id, shopNumber: feeShop.data.shopNumber, role: "OWNER" }]
        });
      }
    }
  }, [payer, params.personId, params.donorId, params.shopId, presetPerson.data, presetDonor.data, feeShop.data]);

  // ---- the fee ---------------------------------------------------------------
  const ownedShops = useMemo(
    () => (payer?.kind === "member" ? payer.shops.filter((shop) => shop.role === "OWNER") : []),
    [payer]
  );
  const canPayFee = ownedShops.length > 0;

  useEffect(() => {
    // One licence: nothing to choose. Several: the collector picks.
    if (purpose === "ANNUAL_FEE" && shopId === null && ownedShops.length === 1) setShopId(ownedShops[0].shopId);
  }, [purpose, shopId, ownedShops]);

  const options = useMemo<FeeOption[]>(() => {
    const shop = feeShop.data;
    if (!shop) return [];
    const list: FeeOption[] = [];
    if (shop.fee.collectable && shop.fee.yearLabel && shop.fee.due !== null) {
      list.push({ feeCycleId: null, yearLabel: shop.fee.yearLabel, due: shop.fee.due });
    }
    // Oldest arrear last in the API's order (newest first); keep it.
    for (const year of shop.earlierYears) {
      if (year.collectable) list.push({ feeCycleId: year.feeCycleId, yearLabel: year.yearLabel, due: year.due });
    }
    return list;
  }, [feeShop.data]);

  const selected =
    options.find((option) => option.feeCycleId === (yearChoice === undefined ? null : yearChoice)) ??
    (yearChoice === undefined ? options[0] : undefined);

  useEffect(() => {
    // Default the amount to what is due, until the collector types their own.
    if (purpose === "ANNUAL_FEE" && selected && !amountTouched) setAmount(String(selected.due));
  }, [purpose, selected, amountTouched]);

  // ---- save ------------------------------------------------------------------
  function buildBody(confirmPartPayment: boolean): CreateContributionRequest | null {
    if (!payer) {
      setError("Choose who is paying.");
      return null;
    }
    const value = Number(amount);
    if (!/^\d+$/.test(amount.trim()) || value <= 0) {
      setError("Enter the amount in whole rupees.");
      return null;
    }
    const body: CreateContributionRequest = { purpose, amount: value, paymentMode: mode };
    if (notes.trim()) body.notes = notes.trim();

    if (payer.kind === "member") body.personId = payer.id;
    else if (payer.kind === "donor") body.donorId = payer.id;
    else {
      if (!donorName.trim()) {
        setError("Enter the donor's name.");
        return null;
      }
      const phoneError = donorPhone ? validatePhone(donorPhone) : null;
      if (phoneError) {
        setError(phoneError);
        return null;
      }
      body.newDonor = {
        name: donorName.trim(),
        ...(donorPhone ? { phone: normalisePhone(donorPhone) } : {}),
        ...(donorOrganisation.trim() ? { organisation: donorOrganisation.trim() } : {})
      };
    }

    if (purpose === "ANNUAL_FEE") {
      if (!shopId || !selected) {
        setError("Nothing is due on this shop.");
        return null;
      }
      if (value > selected.due) {
        setError(`Only ${formatMoney(selected.due)} is due for ${selected.yearLabel}.`);
        return null;
      }
      body.shopId = shopId;
      if (selected.feeCycleId !== null) body.feeCycleId = selected.feeCycleId;
      if (confirmPartPayment) body.confirmPartPayment = true;
    }
    return body;
  }

  async function submit(confirmPartPayment: boolean) {
    setError(null);
    const body = buildBody(confirmPartPayment);
    if (!body) return;

    // Ask before sending, when we already know the amount is short.
    if (purpose === "ANNUAL_FEE" && selected && !confirmPartPayment && body.amount < selected.due) {
      setConfirmPart(
        `${formatMoney(selected.due - body.amount)} will remain due for ${selected.yearLabel}. Record this as a part payment?`
      );
      return;
    }

    try {
      const receipt = await collect.mutateAsync(body);
      setConfirmPart(null);
      navigation.replace("Receipt", { contributionId: receipt.id });
    } catch (caught) {
      // The server asks too — e.g. someone else took a part since this screen loaded.
      if (isCode(caught, "part_payment_unconfirmed")) {
        setConfirmPart(caught.message);
        return;
      }
      setConfirmPart(null);
      setError(errorMessage(caught));
    }
  }

  // ---- render ----------------------------------------------------------------
  const fund = "Credited to the general fund";

  return (
    <Screen>
      <Card>
        <Text style={typography.eyebrow}>Received from</Text>
        {payer === null ? (
          <Text style={typography.body}>No payer chosen yet.</Text>
        ) : payer.kind === "newDonor" ? (
          <>
            <Text style={typography.bodySmall}>New outside donor — saved with this receipt.</Text>
            <Field label="Donor name" value={donorName} onChangeText={setDonorName} uppercase />
            <PhoneField
              label="Phone (optional)"
              value={donorPhone}
              onChangeText={setDonorPhone}
              hint={donorPhone ? null : "Without a number there is no WhatsApp receipt."}
            />
            <Field label="Organisation (optional)" value={donorOrganisation} onChangeText={setDonorOrganisation} uppercase />
          </>
        ) : (
          <>
            <Text style={typography.cardTitle}>{payer.name}</Text>
            <Text style={typography.bodySmall}>
              {payer.kind === "donor"
                ? payer.subtitle ?? "Outside donor"
                : payer.shops.map((shop) => shop.shopNumber).join(" · ") || "No shop linked"}
            </Text>
          </>
        )}
        <Button
          label={payer === null ? "Choose payer" : "Change"}
          variant="secondary"
          icon="search"
          onPress={() => setPickerOpen(true)}
        />
      </Card>

      <Card>
        <Text style={typography.eyebrow}>Purpose</Text>
        <ChipRow>
          <Chip
            label="Annual fee"
            selected={purpose === "ANNUAL_FEE"}
            disabled={!canPayFee}
            onPress={() => setPurpose("ANNUAL_FEE")}
          />
          <Chip label="One-off" selected={purpose === "ONE_OFF"} onPress={() => setPurpose("ONE_OFF")} />
        </ChipRow>
        {payer && !canPayFee ? (
          <Text style={typography.bodySmall}>
            The annual fee is paid by a shop&apos;s licence holder. {payer.kind === "member" ? "This member holds none." : "A donor can give a one-off."}
          </Text>
        ) : null}

        {purpose === "ANNUAL_FEE" && canPayFee ? (
          <>
            {ownedShops.length > 1 ? (
              <ChipRow>
                {ownedShops.map((shop) => (
                  <Chip
                    key={shop.shopId}
                    label={shop.shopNumber}
                    selected={shopId === shop.shopId}
                    onPress={() => {
                      setShopId(shop.shopId);
                      setYearChoice(undefined);
                      setAmountTouched(false);
                    }}
                  />
                ))}
              </ChipRow>
            ) : null}
            {feeShop.isPending && shopId !== null ? <Text style={typography.bodySmall}>Loading the fee…</Text> : null}
            {feeShop.data && options.length === 0 ? (
              <Text style={typography.body}>Nothing is due on {feeShop.data.shopNumber}.</Text>
            ) : null}
            {options.length > 1 ? (
              <ChipRow>
                {options.map((option) => (
                  <Chip
                    key={option.feeCycleId ?? "current"}
                    label={`${option.yearLabel} · ${formatMoney(option.due)}`}
                    selected={selected?.feeCycleId === option.feeCycleId}
                    onPress={() => {
                      setYearChoice(option.feeCycleId);
                      setAmountTouched(false);
                    }}
                  />
                ))}
              </ChipRow>
            ) : null}
            {selected ? (
              <Text style={typography.body}>
                {formatMoney(selected.due)} due for {selected.yearLabel}
                {selected.feeCycleId !== null ? " (arrears)" : ""}
              </Text>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card>
        <Field
          label="Amount (₹)"
          value={amount}
          onChangeText={(next) => {
            setAmountTouched(true);
            setAmount(next.replace(/\D/g, ""));
          }}
          keyboardType="number-pad"
          placeholder="0"
          style={styles.amountInput}
        />
        {purpose === "ONE_OFF" ? (
          <ChipRow>
            {QUICK_AMOUNTS.map((quick) => (
              <Chip
                key={quick}
                label={formatMoney(quick)}
                selected={amount === String(quick)}
                onPress={() => {
                  setAmountTouched(true);
                  setAmount(String(quick));
                }}
              />
            ))}
          </ChipRow>
        ) : null}

        <Text style={typography.eyebrow}>Payment mode</Text>
        <ChipRow>
          {PAYMENT_MODES.map((value) => (
            <Chip key={value} label={paymentModeLabel(value)} selected={mode === value} onPress={() => setMode(value)} />
          ))}
        </ChipRow>

        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Cheque no., remarks" />
      </Card>

      {error ? <Banner message={error} /> : null}

      <Text style={typography.bodySmall}>
        Receipt number issued on save · collected by {me?.name ?? "you"} · {fund}
      </Text>
      <Button label="Save & generate receipt" icon="receipt-outline" loading={collect.isPending} onPress={() => submit(false)} />

      <PayerPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPickMember={(person) => {
          setPickerOpen(false);
          setPayer({ kind: "member", id: person.id, name: person.name, shops: person.shops });
          setShopId(null);
          setYearChoice(undefined);
          setAmountTouched(false);
          if (!person.shops.some((shop) => shop.role === "OWNER")) setPurpose("ONE_OFF");
        }}
        onPickDonor={(donor) => {
          setPickerOpen(false);
          setPayer({ kind: "donor", id: donor.id, name: donor.name, subtitle: donor.organisation });
          setPurpose("ONE_OFF");
        }}
        onNewDonor={() => {
          setPickerOpen(false);
          setPayer({ kind: "newDonor" });
          setPurpose("ONE_OFF");
        }}
      />

      <ConfirmSheet
        visible={confirmPart !== null}
        onClose={() => setConfirmPart(null)}
        onConfirm={() => submit(true)}
        loading={collect.isPending}
        title="Part payment?"
        message={confirmPart ?? ""}
        confirmLabel="Record part payment"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountInput: { fontSize: 26, minHeight: 56 }
});
