# Admin Panel Developer Instructions: Persistent System Banner

To support the new "Persistent Collapsible System Status Banner" (e.g., for "System Maintenance", "Under Development", etc.), the existing broadcasts flow has been extended.

**Do NOT use AI to generate raw HTML for System Banners.** System Banners are highly visual structural components embedded in the header, and rendering raw HTML inside them will break the layout. Instead, use predefined types and an active toggle.

## Database Changes

You need to add three new columns to the `broadcasts` table:
*   `type` column to distinguish between normal popup broadcasts and system banners.
*   `banner_type` column to pick the predefined UI.
*   `is_active` column to turn the banner on or off.

Run the following SQL migration in your Supabase SQL editor:

```sql
ALTER TABLE public.broadcasts 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'popup',
ADD COLUMN IF NOT EXISTS banner_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
```

(Optional but recommended) Update existing rows so they default to 'popup':

```sql
UPDATE public.broadcasts SET type = 'popup' WHERE type IS NULL;
```

## Admin Panel UI Changes

When creating a new broadcast from the Admin Panel, you should provide an option to select the Broadcast Type:
1.  **Popup (Default):** Pops up as a full-screen modal that is dismissible and tracked in the user's local storage. This explicitly gets saved as `type: 'popup'`. You can continue using AI generated `raw_html` for this.
2.  **System Banner:** Renders as a top-level banner embedded below the header. It cannot contain arbitrary HTML. It uses internal React components to look beautiful.
    *   You must provide a dropdown for **Banner Variant** (`banner_type`). The valid options are:
        *   `maintenance` - For scheduled downtime/system updates.
        *   `development` - For showing users they are in a dev environment.
        *   `testing` - For beta testing phases.
        *   `alert` - For critical active issues.
    *   You must provide a toggle switch for **Is Active** (`is_active` boolean). True shows the banner, false hides it. Only one row with `type = 'system_banner'` is needed. You can just update it.

## Saving Logic Example for System Banner

Ensure your insert/update mutation includes the chosen types and toggles:

```javascript
// Example for updating the single System Banner row
await supabase.from('broadcasts')
  .upsert({
    id: 'SOME_FIXED_UUID_FOR_BANNER', // Ensure you update the same row instead of creating many
    type: 'system_banner',
    banner_type: 'maintenance', // 'maintenance', 'development', 'testing', 'alert'
    is_active: true, // true to show, false to hide
    status: 'sent' 
});
```

Note: The frontend code gracefully handles the case where the columns are missing, but the system banner will not be visible until the columns are added to your database and a row is set to `is_active = true`.
