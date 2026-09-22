import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { errorMessage, type NewPersonPayload } from "../../api";
import { Screen } from "../../components/ui";
import type { AppStackParamList } from "../../navigation/types";
import { validateLinks } from "../../utils/validators";
import { MemberForm } from "./MemberForm";
import { ShopLinksField, type PickedLink } from "./components/ShopLinksField";
import { useCreatePerson } from "./hooks";

type Props = NativeStackScreenProps<AppStackParamList, "AddMember">;

/**
 * Add a member from the People tab — `POST /people` (integration doc §5.8).
 *
 * **Opens straight on the form.** The prototype and spec §7.3 both put a blocking
 * "search first" sheet in front of this, and it was built that way; it was removed as a
 * product decision after being seen on a device.
 *
 * The duplicate guard is not gone, just quieter: `MemberForm` queries
 * `GET /people?query=<phone>` as the number is typed and warns inline ("X already has this
 * number") before the collector spends time on a photo and an ID-proof capture. The server
 * remains the backstop with `409 duplicate_phone`.
 *
 * To link a person who *is* already on record, open their profile and use
 * "Link another shop & role" — the search-first sheet still fronts the shop-side flows
 * (`ShopAddPersonScreen`, `ShopTransferScreen`), where finding an existing person is the
 * whole point of the screen.
 */
export function AddMemberScreen({ navigation }: Props) {
  const create = useCreatePerson();

  const [links, setLinks] = useState<PickedLink[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(person: NewPersonPayload) {
    setError(null);
    try {
      const created = await create.mutateAsync({
        person,
        links: links.map((link) => ({ shopId: link.shopId, role: link.role }))
      });
      // `replace`, so Back doesn't return to a spent form.
      navigation.replace("PersonProfile", { personId: created.id });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen>
      <MemberForm
        submitLabel="Save member"
        submitting={create.isPending}
        error={error}
        onSubmit={submit}
        onBack={() => navigation.goBack()}
        linksSection={<ShopLinksField links={links} onChange={setLinks} />}
        validateLinks={() => validateLinks(links)}
      />
    </Screen>
  );
}
