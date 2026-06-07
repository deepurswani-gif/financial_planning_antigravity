-- Optional: richer default for income JSONB on newly created financial plans
ALTER TABLE public.financial_plans
ALTER COLUMN income SET DEFAULT '{
  "self": "",
  "selfBonus": "",
  "selfPassive": "",
  "selfOther": "",
  "spouse": "",
  "spouseBonus": "",
  "spousePassive": "",
  "spouseOther": "",
  "selfDetail": {
    "grossSalary": "",
    "inHandSalary": "",
    "takeHomeProfit": "",
    "netPension": "",
    "passiveIncome": "",
    "otherIncome": [],
    "needTaxPlanning": null,
    "taxPlanning": { "earnings": {}, "deductions": {} }
  },
  "spouseDetail": {
    "grossSalary": "",
    "inHandSalary": "",
    "takeHomeProfit": "",
    "netPension": "",
    "passiveIncome": "",
    "otherIncome": [],
    "needTaxPlanning": null,
    "taxPlanning": { "earnings": {}, "deductions": {} }
  }
}'::jsonb;
