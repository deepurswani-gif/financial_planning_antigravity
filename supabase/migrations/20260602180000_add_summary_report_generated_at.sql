-- Migration: Track when user first generated the Summary Report (quick re-entry)

ALTER TABLE public.financial_plans
ADD COLUMN IF NOT EXISTS summary_report_generated_at TIMESTAMPTZ;
