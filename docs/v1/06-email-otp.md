# Slice 6 — OTP delivery by email (Brevo)

**Status: built and verified end-to-end against real Brevo** — delivered and opened, with a
real emailed code completing the full reset flow (2026-09-10).

**Goal:** make first-login and PIN-reset codes actually reachable by the committee. Before
this, codes were only printed to the server console, so nobody but the operator could
onboard. That was the last launch blocker.

**Two channels exist**, selected by `app.otp.channel`:

| Use | `app.otp.channel` | Where the code goes |
|---|---|---|
| Everyday dev, and the test suite | `console` *(default)* | the app log |
| **Production** | **`brevo`** | Brevo's HTTP API → the member's inbox |

An SMTP channel (`email`, over `spring-boot-starter-mail` with a Mailpit container) was built
first and **has since been removed** — see §9, point 5. `AuthService` never knew which channel
was active, so removing one cost nothing but deletions.

---

## 1. Why email, not SMS

| | |
|---|---|
| **Volume is tiny** | OTP fires **only** on first-login and PIN reset — never on ordinary login (spec §3). ~6 codes at onboarding, then a handful a year. |
| **Cost was never the issue** | ~₹0.15/SMS × ~20/year ≈ ₹4. |
| **Friction is the issue** | India mandates **DLT registration** (TRAI) for transactional SMS: entity + sender-ID + template approval, days-to-weeks. Disproportionate for ~20 messages. |
| **No free SMS for India** | "Free" routes are promotional grade — DND-blocked, unreliable, exactly wrong for OTP. |
| **Email is free at this volume** | Brevo's free tier is 300/day. Confirmed: all committee members have email they check. |

**Why not admin-delivered codes** (the alternative considered): having the admin read the code
out needs zero infrastructure, but it **deadlocks** — if the sole admin forgets their own PIN,
nobody can issue them a code. It also makes every reset depend on the treasurer being
reachable. Email keeps reset **self-service**, which is what spec §3 describes.

**SMS is not ruled out forever.** `OtpSender` is an interface; SMS would be one more
implementation if DLT ever clears.

---

## 2. What did NOT change

The payoff of the `OtpSender` abstraction — untouched throughout, including when Brevo was
added and when SMTP was removed:

- OTP **generation, bcrypt hashing, TTL, attempt-capping, 60s resend throttle** — all of
  `AuthService.requestOtp` / `verifyOtp`.
- The **API shape**: `POST /auth/otp/request {phone, purpose}` → 202, then
  `POST /auth/otp/verify` → reset token, then `POST /auth/pin/set`. The client still
  identifies the user **by phone**; only delivery changed.
- `otp_request` table, `OtpPurpose` (`FIRST_LOGIN` / `PIN_RESET`).
- The slice-5 onboarding model (add member → `pin_set=false` → member self-serves the code).

---

## 3. Data model — migrations `V3`, `V4`, `V5`

`committee_user` gains a mandatory email address, over **three separate migrations** so each
step is independently reviewable and revertible.

**`V3`** — add the column *nullable* (a `NOT NULL` here would fail on every existing row) plus
a partial unique index, because two members sharing an inbox would each receive the other's
reset codes:
```sql
alter table committee_user add column email varchar(255);
create unique index uq_committee_email_active
    on committee_user (lower(email)) where deleted_at is null;
```

**`V4`** — make existing rows reachable:
```sql
update committee_user set email = 'shindeishwar08@gmail.com'
 where phone = '8451963620' and email is null;              -- the seeded admin

update committee_user
   set email = 'no-email-' || phone || '@invalid.local'      -- everything else
 where email is null;
```

> **Why the placeholder branch exists.** A fresh/production database contains only the seeded
> admin, so that second statement is a no-op there. The dev DB held **8** committee rows from
> testing, of which only the admin had a real address — without this, `V5` would have aborted
> on 7 not-null violations and the whole chain would have failed. `.invalid` is reserved by
> RFC 2606 and can never resolve, so the placeholders are *visibly* broken rather than
> plausible. Anyone still holding one cannot receive a code until an admin corrects it.

**`V5`** — `alter table committee_user alter column email set not null;`, safe only after V4.
Application-level `@NotBlank @Email` keeps it true from then on.

---

## 4. Code

### Files
| File | Role |
|---|---|
| `auth/service/OtpSender.java` | The contract: `void send(OtpMessage)`. 5 lines. |
| `auth/dto/OtpMessage.java` | `record(toEmail, recipientName, code, purpose, ttl)` — the delivery payload. Internal; never crosses the API boundary. |
| `auth/service/ConsoleOtpSender.java` | Logs the code. Active on `console` **or when the property is absent**, so a fresh clone and the test suite run with no mail config. |
| `auth/service/BrevoApiOtpSender.java` | `POST {base}/v3/smtp/email` with an `api-key` header via `RestClient`. |
| `auth/service/OtpEmailTemplate.java` | Subject + body, kept apart from transport so the wording is reviewable in one place and a new channel cannot word it differently. |
| `common/AppProperties.java` | `app.otp.channel`, `app.mail.{from,from-name}`, `app.brevo.{api-key,base-url,connect-timeout,read-timeout}` |

Also changed for this slice: `CommitteeUser` (+`email`), `AddCommitteeRequest`
(`@NotBlank @Email`), `CommitteeMemberResponse` (exposes `email`), `CommitteeService`
(persist + duplicate → 409), `PhoneCheckResponse` (+ masked `emailHint`), and
`AuthService.requestOtp` (build an `OtpMessage`; reject with `no_email_on_file` if absent).

### One change that is easy to miss
**The admin must be able to correct a mistyped email.** `PATCH /committee/{id}` previously
accepted `{role}` only — so a typo would lock that member out of onboarding permanently, with
no other route to a code. It now takes `{role?, email?, name?}`, and the self/last-admin
guards apply **only to a role change**, otherwise a sole admin with a wrong address could
never fix it. Changing email does **not** bump `token_version`; it is not a credential.

### Selecting exactly one bean
Two `OtpSender` beans would fail startup with an ambiguity error, so the conditions are
mutually exclusive:
```java
// BrevoApiOtpSender
@ConditionalOnProperty(name = "app.otp.channel", havingValue = "brevo")

// ConsoleOtpSender — also the default when the property is absent
@ConditionalOnProperty(name = "app.otp.channel", havingValue = "console", matchIfMissing = true)
```
A channel with no implementation (e.g. the removed `email`) fails loudly at startup with
*"No qualifying bean of type 'OtpSender'"* rather than silently sending nothing.

### Why the HTTP API rather than SMTP
- **Round trips.** An SMTP send is connect → EHLO → STARTTLS → TLS handshake → EHLO → AUTH →
  MAIL FROM → RCPT TO → DATA → QUIT (~7–9), and `JavaMailSenderImpl` opened a fresh
  connection every time. One HTTPS POST is 2–3. The send is deliberately synchronous, so the
  person waiting on "send code" feels it. Measured ≈1s end to end.
- **Diagnostics — the bigger win.** SMTP hands back a numeric code; Brevo returns
  `{"message":"Key not found","code":"unauthorized"}`. That message is usually the whole
  answer, so it is logged verbatim.

### Why the send is synchronous
`POST /auth/otp/request` returns **202**, which hints async, but the send blocks on purpose:
a misconfigured provider surfaces **immediately** as `502 otp_send_failed` instead of quietly
producing codes that never arrive. Timeouts are bounded at 5s so a hung provider cannot hang
the request thread, and the caller's transaction **rolls the OTP row back** — so a failed send
leaves nothing behind to trip the 60-second resend throttle, and the member can retry at once.

---

## 5. Configuration

```yaml
app:
  otp:
    channel: ${OTP_CHANNEL:console}        # console | brevo
  mail:
    from: ${MAIL_FROM:navnirmanmandal.app@gmail.com}   # must be a VERIFIED Brevo sender
    from-name: ${MAIL_FROM_NAME:Dadar Phool Bazaar Association}
  brevo:
    api-key: ${BREVO_API_KEY:}             # empty default — this file is committed
    base-url: ${BREVO_BASE_URL:https://api.brevo.com}
    connect-timeout: 5s
    read-timeout: 5s
```

**The API key is not the SMTP key.** It comes from Brevo → *SMTP & API → **API Keys***. It is
supplied **only** via `BREVO_API_KEY`; `application.yaml` is committed and pushed, so it holds
an empty default and never a real value. A missing key fails at **startup**, not at the first
PIN reset when a locked-out admin is waiting.

---

## 6. The email itself

Plain text — most deliverable, and nothing in an OTP needs markup. It carries:

- the **6-digit code**, prominently;
- **validity** ("expires in 10 minutes"), read from `app.otp.ttl`, never hardcoded;
- a **purpose-aware subject**: `FIRST_LOGIN` → "Set your M-PIN"; `PIN_RESET` → "Reset your
  M-PIN";
- the recipient's **first name** and the association name, so it doesn't read as spam;
- an "**if you didn't request this, ignore it and tell the treasurer**" line.

**Never the M-PIN itself** — the code is exchanged for a PIN the member chooses — and no other
member data.

---

## 7. Flows

**First login (new member)**
1. Admin: `POST /committee {name, phone, email, role}` → `pin_set=false`.
2. Member enters their phone → `POST /auth/phone` →
   `{onCommittee:true, pinSet:false, emailHint:"s****…@g***l.com"}`.
3. Client shows "we'll email a code to …" → `POST /auth/otp/request {purpose:"FIRST_LOGIN"}` → **202**.
4. Member enters the code → `POST /auth/otp/verify` → reset token → `POST /auth/pin/set` → logged in.

**Forgot / change M-PIN** — identical with `purpose: "PIN_RESET"`. Self-service; no admin
needed. (`POST /committee/{id}/reset-pin` still exists for when the member can't do it
themselves.)

`emailHint` is **masked** because `/auth/phone` is public: it is enough for the member to
recognise which inbox to open, without turning a public endpoint into a phone → email lookup.

---

## 8. API surface changes

| Endpoint | Change |
|---|---|
| `POST /committee` | **new required field `email`**; duplicate active email → 409 `duplicate_email` |
| `PATCH /committee/{id}` | now accepts optional `email` / `name` alongside `role` |
| `GET /committee`, `GET /committee/{id}` | response gains `email` |
| `POST /auth/phone` | response gains masked `emailHint` (null when `onCommittee=false`) |
| `POST /auth/otp/request` | unchanged shape. New failures: **502** `otp_send_failed`, **409** `no_email_on_file` |

---

## 9. What running it taught us

> **1. `SimpleClientHttpRequestFactory` throws away error bodies.** The first Brevo version
> logged `HTTP 401` with nothing after it. A direct `curl` proved Brevo *does* send
> `{"message":"Key not found","code":"unauthorized"}` (50 bytes) — the factory discards bodies
> on 4xx/5xx, defeating the entire reason for choosing the API. Switched to
> `JdkClientHttpRequestFactory`, which preserves them.
>
> **2. Brevo can block by IP.** A valid key still returned
> `401 … "unrecognised IP address 206.84.236.156 … app.brevo.com/security/authorised_ips"`.
> The account had IP allowlisting on. Remember a home broadband IP rotates, and a deployed
> server has its own. SMTP would have given a bare `401`; this message *was* the fix.
>
> **3. A `202` from Brevo does NOT mean delivered.** Brevo queues, then rejects
> **asynchronously**, so the log line "OTP email sent via Brevo" can be wrong. The first real
> send returned 202 and never arrived. **To diagnose a missing code, query the events
> endpoint** — it is the authoritative record:
> ```bash
> curl -s -H "api-key: $BREVO_API_KEY" \
>   'https://api.brevo.com/v3/smtp/statistics/events?limit=10&email=<recipient>'
> # → REQUESTS → DELIVERED → OPENED, or an ERROR with the reason
> ```
>
> **4. The sender must match the verified address exactly.** Config said
> `navnirmanmandal@gmail.com`; the verified sender is **`navnirmanmandal.app@gmail.com`** —
> the `.app` mattered. Only the events log revealed it: *"the sender you used … is not valid"*.
>
> **5. The SMTP channel was removed once Brevo worked.** It had been built first, before the
> API was chosen. Afterwards it earned only a fallback nobody was going to use — `console`
> already covers an outage, since the code is in the log and the treasurer can read it out —
> while costing `spring-boot-starter-mail`, a 44-line `spring.mail.*` block and a Mailpit
> container. Removing it took **deletions only**: `EmailOtpSender`, the dependency, the config
> block, the container. `AuthService`, `OtpSender`, `OtpMessage`, `OtpEmailTemplate`, the
> endpoints and the DTOs were untouched — the same seam that made adding Brevo cheap made
> dropping SMTP cheap.

---

## 10. Verified

| Check | Result |
|---|---|
| Missing API key | startup refused, with the reason |
| Invalid key | `502 otp_send_failed`; `{"message":"Key not found"}` logged |
| Unauthorised IP | `502`; Brevo's IP + fix URL logged |
| Unverified / mismatched sender | `202` then async rejection, found via the events API |
| **Correct sender, real send** | `REQUESTS → DELIVERED → OPENED`, ≈1s |
| **Real emailed code** | `otp/verify` → `pin/set` → `login` → `/me` = Ishwar/ADMIN; reuse → `400 otp_invalid` (single-use) |
| Committed default (no `MAIL_FROM` override) | delivers |
| Failed send | OTP row **rolled back** — nothing left to trip the throttle |
| Add committee: no email / bad email / duplicate | 400 · 400 · 409 |
| `PATCH` email-only, role-only, empty, duplicate | 200 · 200 · 400 `nothing_to_update` · 409 |
| Self-guard: own **email** allowed, own **role** blocked | 200 · 400 `self_action` |
| Resend throttle | 429 `otp_throttled` |
| `console` channel (default, no config) | code logged |
| Removed `email` channel | startup fails loudly: *No qualifying bean of type 'OtpSender'* |
| `./mvnw test` | green |

> **Testing note.** These runs used a scratch database
> (`DB_URL=jdbc:postgresql://localhost:5432/dpb_brevo`). The shared `dpb` dev database is at
> **V6** from the money branch while this branch carries only V1–V5, so Flyway refuses to
> start against it: *"detected applied migration not resolved locally"*. Create the scratch DB
> once (`create database dpb_brevo;`) and Flyway builds V1–V5 into it.

---

## 11. How to run it

The Brevo account is already set up: **sender `navnirmanmandal.app@gmail.com` verified**, **IP
restriction off**, API key generated under *SMTP & API → API Keys*.

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export BREVO_API_KEY='<your Brevo API key>'    # never committed

docker compose up -d
OTP_CHANNEL=brevo ./mvnw spring-boot:run
```
```bash
curl -i -X POST http://localhost:8080/api/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"8451963620","purpose":"PIN_RESET"}'      # → 202
```

Leave `OTP_CHANNEL` unset for everyday dev and read the code from the log.

**If a code does not arrive, do not guess** — a 202 only means queued. Query the events
endpoint (§9, point 3); it names the reason.

---

## 12. Still to do

1. **When the domain lands:** authenticate it in Brevo, publish the SPF + DKIM records, then
   set `MAIL_FROM=no-reply@<domain>`. Config only — no code change, no rebuild. Brevo's
   dashboard currently flags this sender (DKIM "Default", DMARC *"Freemail domain is not
   recommended"*), which is expected for a Gmail from-address and is exactly what the domain
   fixes.
2. **Fix the placeholder addresses:** `GET /committee`, then `PATCH /committee/{id}` with a
   real email for anyone still on `@invalid.local`, or remove those test accounts — they
   cannot receive a code.
3. **Consider rewording the success log.** "OTP email sent via Brevo" fires on a 202, which
   means queued, not delivered — that wording is how the mismatched sender initially slipped
   past. "Accepted by Brevo" would be truthful.

---

## 13. Risks & operational notes

- **Deliverability is the main real risk**, and it is materially worse while the sender is a
  Gmail address relayed through Brevo. Brief the committee to check spam on first use; the
  domain step is the real fix.
- **Wrong email = locked out.** Mitigated by the `PATCH` email fix above. Break-glass:
  ```sql
  update committee_user set email = 'correct@example.com', pin_set = false, pin_hash = null
   where phone = '<number>';
  ```
- **Placeholder `@invalid.local` addresses** can never receive a code — see §12.
- **Email is a weaker recovery channel than SMS** in general (inbox compromise → takeover).
  Acceptable here: 5–6 known people, and an attacker would still need the member's phone
  number *and* to set a new PIN, which visibly locks the real member out.
- **Enumeration**: `/auth/phone` still states plainly whether a number is on the committee —
  spec §3 asks for that, and the masked hint leaks no more.
