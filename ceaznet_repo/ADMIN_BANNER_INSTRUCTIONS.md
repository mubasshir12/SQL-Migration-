# Admin Panel Developer Instructions: Persistent System Banner

To support the new "Persistent Collapsible System Status Banner" (e.g., for "System Maintenance", "Under Development", etc.), the existing `broadcasts` flow has been extended.

**Do NOT use AI to generate raw HTML for System Banners.** System Banners are highly visual structural components embedded in the header, and rendering raw HTML inside them will break the layout. Instead, use predefined types and an active toggle.

## Database Changes

You need to add three new columns to the `broadcasts` table:

1. `type` column to distinguish between normal popup broadcasts and system banners.
2. `banner_type` column to pick the predefined UI.
3. `is_active` column to turn the banner on or off.

Run the following SQL migration in your Supabase SQL editor:

```sql
ALTER TABLE public.broadcasts
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'popup',
ADD COLUMN IF NOT EXISTS banner_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
```

(Optional but recommended) Update existing rows so they default to `'popup'`:

```sql
UPDATE public.broadcasts SET type = 'popup' WHERE type IS NULL;
```

## Admin Panel UI Changes

When creating a new broadcast from the Admin Panel, you should provide an option to select the **Broadcast Type**:

### 1. Popup (Default Behavior)

Pops up as a full-screen modal that is dismissible and tracked in the user's local storage. This explicitly gets saved as `type: 'popup'`. You can continue using AI generated `raw_html` for this.

### 2. System Banner (New Behavior)

Renders as a top-level banner embedded below the header. It cannot contain arbitrary HTML. It uses internal React components to look beautiful.

- You must provide a dropdown for **Banner Variant** (`banner_type`). The valid options are:
  - `maintenance` - For scheduled downtime/system updates.
  - `development` - For showing users they are in a dev environment.
  - `testing` - For beta testing phases.
  - `alert` - For critical active issues.
- You must provide a toggle switch for **Is Active** (`is_active` boolean). True shows the banner, false hides it. Only one row with `type = 'system_banner'` is needed. You can just update it.

### Saving Logic Example for System Banner

Ensure your insert/update mutation includes the chosen types and toggles:

```javascript
// Example for updating the single System Banner row
await supabase.from("broadcasts").upsert({
  id: "SOME_FIXED_UUID_FOR_BANNER", // Ensure you update the same row instead of creating many
  type: "system_banner",
  banner_type: "maintenance", // 'maintenance', 'development', 'testing', 'alert'
  is_active: true, // true to show, false to hide
  status: "sent",
});
```

_Note: The frontend code gracefully handles the case where the columns are missing, but the system banner will not be visible until the columns are added to your database and a row is set to `is_active = true`._

## Support System Instructions

The Support system has been updated to include Live Chat, Mail Ticketing, Read/Unread ticks, and File Attachments.

### 1. Database Updates

You must append the following columns to the `support_messages` table to handle attachments:

```sql
ALTER TABLE support_messages
ADD COLUMN attachment_url TEXT,
ADD COLUMN attachment_name TEXT,
ADD COLUMN attachment_type TEXT;
```

### 2. Read/Unread Tick Logic

The frontend displays sent ticks vs double read ticks:

- By default `is_read` is `false`. When the admin queries messages, ensure the admin panel listens for incoming messages. If the admin views the chat, they should fire an update to `support_messages` toggling `is_read = true` for messages where `sender_type = 'user'`.
- The user client automatically fires a hook to set `is_read = true` on any incoming admin messages whenever they view the conversation. Admin dashboard should reflect these read receipts as blue double ticks.

### 3. Attachments via Telegram Storage

Users can now upload attachments to Support Tickets. The Client uses a custom Telegram storage bridge via frontend API calls.

- The `attachment_url` will contain a custom schema URL (e.g., `tg://<file_id>?msg=<message_id>`).
- To render these images or download links in the admin dashboard, you MUST resolve this `tg://` URL to an actual HTTPS URL.
- **How to resolve it:**
  1. Extract the `file_id` (the part after `tg://` and before `?msg=`).
  2. Make an API call to Telegram to get the `file_path`:
     `GET https://api.telegram.org/bot<BOT_TOKEN>/getFile?file_id=<file_id>`
  3. The response will contain `result.file_path`.
  4. Construct the fetch URL: `https://api.telegram.org/file/bot<BOT_TOKEN>/<file_path>`.
  5. Use this fetch URL directly in your `<img src="...">` tag. Note that this fetch URL is temporary and expires, so you should resolve it on the fly when the admin opens the ticket.
- **Bot Details:** Ensure the admin dashboard has access to the exact same `TELEGRAM_BOT_TOKEN` as the main app to perform this resolution.
- Telegram file fetching requires no authentication headers beyond the Bot Token in the fetch URL.
