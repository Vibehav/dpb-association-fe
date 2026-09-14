# Market Association — Design System Reference

This reference is extracted from the React Native implementation in `src/`, `app.json`, and `package.json`. Values labelled as behaviour or states are implemented component behaviour; no additional visual tokens are assumed.

## 1. Brand & App Overview

- **App name:** Market Association (Expo display name). The sign-in masthead uses the association name **Dadar Phool Bazaar Vyapari Navnirman Mandal** and the short mark `DPB · ASSOCIATION` is defined for the prototype.
- **Purpose:** a committee-facing market register for shops, members, licence holders, renters, and staff. The current v1 explicitly excludes money, contributions, receipts, funds, events, and reports.
- **Platforms:** native iOS and Android builds are configured (`com.marketassociation.records`); portrait orientation, light interface style, and no iPad support are declared. A web start script exists, but no web-specific visual design is configured.
- **Visual character (inferred from implementation):** warm, paper-like and restrained: off-white surfaces/cards, beige borders/backgrounds, deep maroon primary actions, serif display titles, and monospaced numerical/label data. The UI favors bordered paper cards, modest iconography, and practical touch targets over decoration.
- **App chrome:** dark status-bar content; all configured screens use the warm surface colour. Splash/adaptive-icon background is `#FBF9F6`.

## 2. Color Palette

| Token | Value | Implemented use |
| --- | --- | --- |
| `background` | `#EDE9E2` | Theme background token |
| `surface` | `#FBF9F6` | Screen, header, tab bar, sheet, loading, auth background, splash/adaptive-icon background |
| `card` / `white` | `#FFFFFF` | Cards, text inputs, chips, keypad keys; white text/icons on filled controls |
| `border` | `#E4DDD2` | 1 px input/card/control borders, header/tab/action-bar dividers, empty code dots, sheet grabber |
| `primary` | `#8E1B22` | Primary button/chip/check states, active tabs, count icons, avatar initials, filled code dots, action/link text |
| `text` | `#1A1613` | Primary text, headers, secondary/ghost button content, keypad text |
| `secondaryText` | `#5A5148` | Body copy and unselected chip text |
| `muted` | `#8A8177` | Supporting copy, placeholders, inactive tabs, search icons, empty/error icons |
| `success` | `#2F6B4F` | Success feedback and image-ready badge |
| `error` | `#B3352F` | Error button, field error border/text, error banner foreground |
| `warning` | `#E8892B` | Defined token; no direct component use found |
| `soft` | `#F4EFE7` | Avatar/image placeholder, pressed list/key backgrounds |
| `successSoft` | `#EAF2ED` | Success banner background |
| `errorSoft` | `#FBF3F2` | Error banner background |
| `noticeSoft` | `#FFF6E8` | Notice banner background |
| `noticeText` | `#8A5A13` | Notice banner foreground and non-blocking field hints |

Additional literal overlays: sheet scrim `rgba(26,22,19,0.35)` and image-upload overlay `rgba(26,22,19,0.55)`.

## 3. Typography

### Font families

- **Instrument Serif Regular** (`InstrumentSerif_400Regular`): display, screen titles, association name, and large figures.
- **IBM Plex Mono Regular** (`IBMPlexMono_400Regular`): numerical/aligned data, phone/shop numbers, labels, OTP/PIN keypad.
- **IBM Plex Mono Medium** (`IBMPlexMono_500Medium`): avatar initials.
- **Platform sans:** `Helvetica Neue` on iOS; `sans-serif` otherwise. Used for body copy, card titles, controls, and tab labels.

The three bundled fonts are loaded before the app renders; the system sans intentionally remains platform-provided.

| Role / token | Family | Size | Weight | Line height / other |
| --- | --- | ---: | --- | --- |
| Display | Instrument Serif | 25 | regular | 30 |
| Auth association name override | Instrument Serif | 28 | regular | 34; centred |
| Screen title | Instrument Serif | 20 | regular | 25 |
| Native stack header title | Instrument Serif | 18 | unspecified | unspecified |
| Large home count override | Instrument Serif | 30 | regular | inherits display line height 30 |
| Card title | platform sans | 15 | 500 | unspecified |
| Body | platform sans | 12.5 | unspecified | 18 |
| Small body/caption | platform sans | 11.5 | unspecified | 16 |
| Eyebrow/field label | IBM Plex Mono | 10 | regular | uppercase, letter-spacing 0.7 |
| Mono data | IBM Plex Mono | 14 | regular | unspecified |
| Mono small | IBM Plex Mono | 11 | regular | unspecified |
| Button label | platform sans | 14 | 500 | unspecified |
| Tab label | platform sans | 10 | unspecified | letter-spacing 0.2 |
| Standard Field input | inherited/default | 15 | unspecified | unspecified |
| Phone input | IBM Plex Mono | 15 | regular | unspecified |
| Phone `+91` prefix | IBM Plex Mono | 14 | regular | unspecified |
| Search input | inherited/default | 14 | unspecified | unspecified |
| Chip label | inherited/default | 12 | unspecified | unspecified |
| Numeric keypad digit | IBM Plex Mono | 21 | regular | unspecified |

Contextual mono overrides use 12 for list/profile phone values, 13 for email/OTP contexts, 16 for shop-card numbers, and 17 for the shop-detail number. Avatar initials are `size × 0.34` (default avatar: 38 px, search avatar: 34 px, account: 48 px, profile: 44 px).

## 4. Spacing & Layout

### Tokens and dimensions

| Token | px |
| --- | ---: |
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 20 |
| `xxl` | 24 |
| `screen` | 16 |
| Minimum tap target (`MIN_TOUCH`) | 44 |

The standard `Screen` uses 16 px gutters and a 12 px vertical child gap. Lists use the same 16 px inset and 12 px item separator. Auth uses 24 px outer padding, 20 px top-level gap, and 24 px top masthead padding.

| Radius token / literal | px | Implemented use |
| --- | ---: | --- |
| `sm` | 8 | Checkbox |
| `md` | 12 | Banner and pressable result rows |
| `lg` | 15 | Buttons, text/phone/search fields, image frames |
| `xl` | 18 | Cards |
| `pill` | 999 | Chips, avatars, image-ready badge, sheet grabber |
| Keypad literal | 16 | Key tiles |
| Bottom-sheet top corners literal | 26 | Sheet panel wrapper |

Other fixed measurements: sheet grabber 38 × 4; avatar default 38 × 38; auth logo 64 × 64; member-photo capture frame 132 × 132; Aadhaar capture frame 210 × 132; ready badge 22 × 22; checkbox 22 × 22; PIN dots 14 px with 14 px gaps; OTP dots 11 px with 11 px gaps.

### Repeated layout patterns

- Screen content is a safe-area-aware vertical stack; scrollable forms use `ScrollView` and iOS keyboard avoidance. The top safe-area inset is deliberately omitted under existing headers.
- Cards use a white fill, 1 px beige border, 18 px radius, 16 px padding, and 4 px internal gap.
- Horizontal rows generally use `flexDirection: "row"`, centered alignment, and 8 or 12 px gaps: headers, person rows, inputs, action groups, and count cards.
- `ChipRow` is a horizontal scroll view with 8 px gaps and 4 px vertical padding. Role/shop tags can wrap in profile/list contexts.
- Shops/people registers are `FlatList`s with a sticky-looking bottom action bar (16 px padding, top border) for the create action.
- Image actions and several action groups use a wrapping row with 8 px gap; image action cells start at a 120 px basis.

## 5. Components Inventory

### Foundation UI

| Component | Appearance and behaviour | States / usage |
| --- | --- | --- |
| `Screen` | Warm safe-area screen frame with 16 px content inset. | Scroll or non-scroll; optional pull-to-refresh; iOS keyboard avoidance. Used by forms, details, home, account, and auth-related signed-in flows. |
| `Card` | White, 1 px bordered, 18 px rounded paper panel; 16 px padding. | Static or pressable. Pressed state opacity 0.9. Used for dashboard counts, identity, details, forms, list rows, and administrative sections. |
| `Button` | 44 px minimum-height, centered label/icon row, 15 px radius, 16 px horizontal padding. | **Primary:** maroon with white content. **Secondary:** white with beige border and dark content. **Ghost:** transparent/dark content. **Danger:** red with white content. Pressed opacity 0.85; loading replaces icon with spinner; loading/disabled opacity 0.5. |
| `Field` | Optional uppercase mono label above a white, bordered 44 px-minimum text input. | Default, error (red border/message), or hint (brown text). Used in shop, member, committee, and edit forms. |
| `PhoneField` | Same field container, with fixed mono `+91` prefix and 10-digit numeric input. | Default, error, hint, and disabled (0.6 opacity). Used in sign-in and person/committee forms. |
| `SearchBox` | White bordered 44 px-minimum row with 18 px search icon, input, and conditional clear icon. | Clear affordance only while nonempty. Used in registers and search/picker surfaces. |
| `Chip` / `ChipRow` | Pill tag/filter with 12 px label, white fill, beige border and 12/8 px horizontal/vertical padding. | Selected = maroon fill/border and white label. Static when no press handler; selectable via press handler. Used for filters, roles, tenancy, status tags. |
| `CheckRow` | 44 px-minimum row with 22 px square checkbox and body/optional caption. | Empty white bordered box; checked maroon box/white check; pressed opacity 0.7. Used for WhatsApp-same-as-phone and Aadhaar consent. |
| `Avatar` | Soft beige circular initial avatar with beige border and maroon IBM Plex Mono Medium initials. | Size prop, default 38; noninteractive by itself. Used in headers, records, profile, account, committee, search results. |
| `Banner` | Rounded 12 px feedback row with 16 px Ionicon and small body text. | Error (pink/red alert), notice (pale yellow/brown info), success (pale green/green check). Used for validation, API feedback, uploads, permissions. |
| `EmptyState` | Centered muted 30 px Ionicon, card-title heading, optional body. | No data / no matching data; list-specific icons and messaging. |
| `ErrorState` | Centered muted 32 px offline/alert icon, title/message and optional secondary retry button. | Network vs general failure determines icon/title; used by queries and pickers. |
| `LoadingScreen` | Centered primary-colour spinner on surface. | Full screen while restoring session/fonts or loading route data. |
| `ListFooter` | Centered paginated-list footer. | Primary spinner while loading, retry messaging/button on next-page failure, or end label. |

### Modal, search, media, and authentication components

| Component | Appearance and behaviour | States / usage |
| --- | --- | --- |
| `Sheet` | RN modal bottom sheet with dark translucent scrim, 26 px rounded top corners, 20 px panel padding, 38 × 4 grabber, optional serif title. | Slide animation; tapping scrim/requesting close dismisses. Base for search and destructive/action sheets. |
| `ConfirmSheet` | `Sheet` containing body message and vertically stacked confirm/cancel buttons. | Confirm uses primary or danger; loading disables cancel. Present as reusable confirmation primitive. |
| `PersonSearchSheet` | Sheet with hint, search field, debounced results, and cancel/create footer. | Before query prompt, loading spinner, API error, no-match message, results. Existing rows may be excluded. Used for adding a person to a shop and licence transfers. |
| `ShopSearchSheet` | Sheet with role chips, search, result rows, inline errors and ghost cancel. | Debounced results; renter-taken or busy row disabled at 0.45 opacity; pressed rows turn soft beige. Used to link a member to shops. |
| `PersonPicker` / `ShopPicker` | In-place (not modal) search fields plus capped scrolling result lists. | Prompt/loading/error/no match/results; result press clears query. Used inside shop registration and member/shop-link forms. |
| `PersonResultRow` | 34 px avatar, person/card title, mono phone, shop-role caption, optional maroon trailing action. | Pressed soft-beige row. Shared by person sheets/pickers. |
| `ImageCaptureField` | Label/note, bordered soft-beige photo or Aadhaar frame, then Camera/Choose actions. | Empty icon placeholder; uploading dark overlay + spinner; ready green check badge; failed message + retry; ready can remove. Used by `MemberForm`. |
| `MemberPhoto` | Profile-photo preview/capture control. | Shows stored/captured photo or no-photo text; can retake for writers; upload failure banner. Used on member profile. |
| `AadhaarPanel` | Profile Aadhaar view/capture panel. | Permission-sensitive locked/explanation UI, signed image frame, capture actions and errors. Used on member profile. |
| `CodeDots` | Centered filled-dot code indicator with no outlines. | Maroon entered dots and beige empty dots; 4-digit PIN uses 14 px dots/gaps, 6-digit OTP uses 11 px dots/gaps. |
| `Keypad` | Four explicit equal three-column rows of white bordered number keys. | 16 px radius, 16 px vertical padding, 10 px grid gaps; press turns key soft beige; blank final-row key is invisible; disabled ignores input. Used for PIN/OTP/unlock. |
| `AuthShell` | Scrollable auth frame: 64 px circular association logo, centered serif association name, `Committee sign-in` caption, then 16 px-gapped panel. | Shared by Phone, PIN, OTP, and new-PIN flows. |
| `PersonRow` / `ShopCard` | Pressable card records: person row has avatar, name/phone and role chips; shop card has mono shop number, lane, business, holder, renter and worker count. | Card pressed opacity. Used by people and shop `FlatList`s. |
| `ShopLinksField` | Member-form card for role selection, attached shop rows, inline shop picker, and add-shop action. | Uses chips and picker states; used on standalone member add. |
| `MemberForm` | Reusable member capture form composed of fields, image capture, consent, banners, submit/back. | Validation/upload-wait/error feedback; used when adding members, adding a new licence holder, and transfer flows. |
| `MemberActionsSheet` | Committee-member details/edit sheet with nested reset-PIN and remove confirmation sheets. | Edit, role selection, inactive/PIN notices, error, busy, reset/remove confirmation states. |

## 6. Navigation Structure

The app uses React Navigation native stacks plus a bottom tab navigator.

```text
RootNavigator
├─ loading → LoadingScreen
├─ locked → UnlockScreen (outside NavigationContainer)
├─ signed out → AuthStack (native stack; headers hidden; slide-from-right)
│  ├─ Phone
│  ├─ Pin
│  ├─ Otp
│  └─ NewPin
└─ signed in → AppStack (native stack)
   ├─ Tabs (header hidden)
   │  └─ Bottom tabs: Shops | Home (initial, centre) | People
   ├─ Account
   ├─ ShopDetail → ShopForm, ShopAddPerson, ShopTransfer
   ├─ PersonProfile → PersonEdit, AddMember
   ├─ ChangePin
   └─ Committee → AddCommitteeMember
```

### Header and tab styling

- The three tabs use a custom `AppHeader`: surface fill, 16 px horizontal inset, 12 px lower inset, 1 px beige lower rule, serif screen title, small `name · role` line, and a 38 px initial avatar that opens Account.
- Native-stack detail headers use the surface fill, dark text/back tint, 18 px Instrument Serif title, and no shadow.
- `ShopForm`, `ShopAddPerson`, `ShopTransfer`, `PersonEdit`, `AddMember`, `ChangePin`, and `AddCommitteeMember` use native-stack `modal` presentation.
- Tab bar: surface background, beige top border; active maroon and inactive muted tint; 10 px sans labels with 0.2 letter spacing. Ionicons are `storefront-outline`, `home-outline`, and `people-outline`.

## 7. Icons & Imagery

- **Icon system:** `@expo/vector-icons` Ionicons. It supplies tab icons and all control/status imagery (search, clear, camera, photo library, alert/info/success, retry, person/shop actions, keypad backspace, and empty/error states). Implemented icon sizes include 13, 15, 16, 18, 20, 28, 30, and 32 px.
- **Brand image:** `uploads/logo-1784996881407.jpeg`, a 640 × 640 JPEG, is the auth masthead logo and renders at 64 × 64 with a pill radius. A duplicate sits under documentation assets.
- **App assets:** `assets/icon.png`, `assets/splash.png`, and `assets/adaptive-icon.png` are each 1024 × 1024 PNGs. They are configured respectively as app icon, splash image (`contain`), and Android adaptive-icon foreground.
- **Member imagery:** runtime image picker/camera assets are used for member photo, Aadhaar front, and Aadhaar back. Capture previews use `cover`; stored Aadhaar display uses `contain`. No custom SVG/icon asset set was found.

## 8. Screen-by-Screen Breakdown

### Authentication and lock

| Screen file | Screen | Purpose and key UI |
| --- | --- | --- |
| `src/features/auth/PhoneScreen.tsx` | Phone | Start committee sign-in: Indian phone field, live greeting/check, error banner, Continue. |
| `src/features/auth/PinScreen.tsx` | Pin | Existing-user 4-digit M-PIN entry: phone, eyebrow instruction, code dots, keypad, Change number and Forgot M-PIN links. |
| `src/features/auth/OtpScreen.tsx` | Otp | Six-digit emailed code: email hint, dots/keypad, Back and resend/cooldown links. |
| `src/features/auth/NewPinScreen.tsx` | NewPin | Set a 4-digit M-PIN after OTP: explanatory copy, dots, keypad, error banner. |
| `src/features/auth/UnlockScreen.tsx` | Unlock | Locked-session M-PIN gate: current phone, dots, keypad, error and sign-in-with-another-number link. |

### Primary tabs and account

| Screen file | Screen | Purpose and key UI |
| --- | --- | --- |
| `src/features/home/HomeScreen.tsx` | Home | Lightweight register overview: two pressable count cards (shops and people) and explanatory register card; pull-to-refresh/error state. |
| `src/features/shops/ShopsListScreen.tsx` | Shops | Paginated shops register: search, lane filter chips, count, shop cards, empty/error/footer states, and permission-gated sticky Register new shop button. |
| `src/features/people/PeopleListScreen.tsx` | People | Paginated member register: name/phone/shop search, All/Owner/Renter/Staff chips, person cards, empty/error/footer states, and permission-gated sticky Add a member button. |
| `src/features/account/AccountScreen.tsx` | Account | Identity card with avatar/role/phone, rights explanation, Change M-PIN, admin-only committee entry, Lock app, and Sign out. |
| `src/features/account/ChangePinScreen.tsx` | ChangePin | In-app multi-step change PIN flow: send-code intro card, OTP keypad/resend, new PIN keypad, and success/Done state. |

### Shops

| Screen file | Screen | Purpose and key UI |
| --- | --- | --- |
| `src/features/shops/ShopDetailScreen.tsx` | ShopDetail | Shop number/name/lane/tenancy and people cards; person role rows, add-person action, edit/admin transfer/delete actions, errors and unlink confirmation. |
| `src/features/shops/ShopFormScreen.tsx` | ShopForm | Register/edit shop modal. Shop number, business, lane, tenancy chips; registration also selects/creates licence holder, then opens a reusable member form as step 2. |
| `src/features/shops/ShopAddPersonScreen.tsx` | ShopAddPerson | Modal to attach renter/staff to a shop: shop context, role chips, existing-person search sheet or new member form. |
| `src/features/shops/ShopTransferScreen.tsx` | ShopTransfer | Admin modal to replace a licence holder: current-holder and consequence cards, picker sheet, or new-person form. |

### People

| Screen file | Screen | Purpose and key UI |
| --- | --- | --- |
| `src/features/people/PersonProfileScreen.tsx` | PersonProfile | Member identity/card, photo, shops/roles with remove links, personal details, Aadhaar panel, edit/link actions, and admin delete section. |
| `src/features/people/PersonEditScreen.tsx` | PersonEdit | Modal edit form for name, phone, WhatsApp toggle/number, address; banner validation and Save/Delete actions. |
| `src/features/people/AddMemberScreen.tsx` | AddMember | Standalone member-add route that starts through person searching and then uses `MemberForm` plus `ShopLinksField`. |

### Committee

| Screen file | Screen | Purpose and key UI |
| --- | --- | --- |
| `src/features/committee/CommitteeScreen.tsx` | Committee | Admin-only committee roster: member cards with avatar, role chips, email/phone/PIN/removed state, add-member CTA, and actions sheet. |
| `src/features/committee/AddCommitteeMemberScreen.tsx` | AddCommitteeMember | Modal committee invitation/member form: name, phone, email, role chip selection with role description, warnings/banners, add/cancel actions. |

## Implementation Notes for Mockup Generation

- Preserve the warm `surface` as the dominant page colour, white cards/controls, single beige keylines, maroon as the principal interactive emphasis, and serif only for display/title hierarchy.
- Treat the 44 px minimum as the baseline height for buttons and form controls. Cards and fields are not shadowed in the implementation.
- Use Ionicons-style simple outline icons and image thumbnails only where the implemented screens use them; the register/list experience is primarily type, cards, tags, and utility controls.
- Permission-sensitive controls exist: write actions, transfer/delete/admin operations, and Aadhaar access are conditionally shown. Mockups should retain those as states, not assume all actions are visible to every user.
