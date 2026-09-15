# Email OTP migration

The backend now delivers first-login and M-PIN-reset OTPs by **email**, not SMS. This addendum
supersedes earlier references to SMS or a `DEV OTP` backend-console line.

> ⚠️ **Removed / superseded:** any instruction to wait for an SMS, read a `DEV OTP` line from
> the API console, or show “code sent to your phone.” Preserve those historic references in
> earlier build records, but do not follow them for current work.

## Current API contract

| Endpoint | Current behavior |
| --- | --- |
| `POST /committee` | Requires `name`, `phone`, `email`, and `role`. `email` must be valid and unique among active committee members. |
| `PATCH /committee/{id}` | Partial body: `name?`, `email?`, `role?`. An admin may change their own name/email but not their own role. |
| `GET /committee`, `GET /committee/{id}` | Each member includes `email`, including legacy `@invalid.local` placeholders. |
| `POST /auth/phone` | Adds masked `emailHint`; `null` when the number is not on the committee. |
| OTP request/verify/set-PIN | Request shape and phone-based identity remain unchanged. Codes are six digits, valid for ten minutes, and resend is throttled for 60 seconds. |

## Frontend behavior

- The Add Committee Member form requires and validates an email address.
- The committee list displays every email. The member action sheet can correct name/email and
  saves name, email and an allowed role change together.
- First-login, Forgot M-PIN and Change M-PIN fetch the masked `emailHint` and show it while the
  member enters the OTP.
- OTP entry copy must say the code was **emailed** and should tell members to check their spam
  folder.

## Error handling

| Code | Required user-facing behavior |
| --- | --- |
| `duplicate_email` | Show a field error that the address belongs to another active committee member. |
| `nothing_to_update` | Do not issue an empty PATCH; if the server returns it, show its message. |
| `otp_send_failed` | “Couldn't send the code, please try again.” Keep Resend enabled because the server did not start the throttle. |
| `no_email_on_file` | Tell the member to contact the treasurer. |

## Implementation status

The email fields, partial committee update, committee display, masked OTP destination, delivery
error messages, and spam-folder hint are implemented in the client.
