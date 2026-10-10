import type { EventStatus } from "../../../api";
import { eventStatusLabel } from "../../../utils/format";
import { StatusTag, type StatusTone } from "../../money/components/StatusTag";

/** The prototype's chip colours: Active amber, Open green, Closed grey. */
const TONE: Record<EventStatus, StatusTone> = { ACTIVE: "notice", OPEN: "success", CLOSED: "muted" };

export function EventStatusTag({ status }: { status: EventStatus }) {
  return <StatusTag label={eventStatusLabel(status)} tone={TONE[status] ?? "muted"} />;
}
