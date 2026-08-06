# Admin Push Campaigns — deploy checklist

1. **Apply migrations** (from repo root):
   ```bash
   npx supabase db push
   ```
   Tables: `cohorts`, `cohort_members`, `push_notification_templates`, `push_campaigns`, `push_campaign_deliveries`  
   RPCs: `admin_cohort_preview`, `admin_cohort_refresh`

2. **Redeploy Edge Function**:
   ```bash
   npx supabase functions deploy send-push-notification
   ```
   Requires secrets already set: `FIREBASE_SERVICE_ACCOUNT_JSON`  
   Hosted functions receive `SUPABASE_SERVICE_ROLE_KEY` automatically.

3. **Optional schedule cron** (Dashboard SQL or CLI) — see comment at bottom of  
   `supabase/migrations/20260805121000_admin_push_campaigns.sql`  
   Or click **Process due schedules** in Admin → Push Campaigns.

4. **Smoke test**
   - Admin → Cohorts → create rule set → Save & refresh  
   - Admin → Push Campaigns → Design → preview Android/iOS → Save template  
   - Send / Schedule → audience = that cohort → Send now  
   - Confirm phone tray + Reports → Deliveries
