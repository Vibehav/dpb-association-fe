import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { errorMessage, type NewPersonPayload } from "../../api";
import { PersonSearchSheet } from "../../components/search/PersonSearchSheet";
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
 * Opens on the **pick sheet**, matching the prototype: `+ Add a member` calls `openPickAny`,
 * which shows "Search first — the person may already be on record at another shop", and only
 * "Not on record — create new" leads to this form. At ~2,300 people that guard is the
 * difference between one profile per worker and two half-profiles with a split history
 * (spec §7.3).
 *
 * The form itself carries the role chips and the shop search **inline** (`ShopLinksField`),
 * as the design has them — not behind a second sheet.
 */
export function AddMemberScreen({ navigation }: Props) {
  const create = useCreatePerson();

  const [searchOpen, setSearchOpen] = useState(true);
  const [links, setLinks] = useState<PickedLink[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(person: NewPersonPayload) {
    setError(null);
    try {
      const created = await create.mutateAsync({
        person,
        links: links.map((link) => ({ shopId: link.shopId, role: link.role }))
      });
      navigation.replace("PersonProfile", { personId: created.id });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
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

      <PersonSearchSheet
        visible={searchOpen}
        onClose={() => {
          // Dismissing the search without choosing means leaving — the form is only reached
          // through "Not on record — create new".
          setSearchOpen(false);
          navigation.goBack();
        }}
        title="Add a member"
        onPickExisting={(person) => {
          setSearchOpen(false);
          // `replace`, so Back doesn't return to a half-filled form.
          navigation.replace("PersonProfile", { personId: person.id });
        }}
        onCreateNew={() => setSearchOpen(false)}
      />
    </>
  );
}
