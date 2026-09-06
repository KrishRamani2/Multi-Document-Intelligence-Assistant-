# Ingested Documents Summary

This file provides context for the AI Agent about what documents are available.

## Documents

### 1. Annual Report 2024 (PDF)
- **File**: `data/annual_report_2024.pdf`
- **Type**: PDF (9 pages)
- **Key Sections**:
  - Executive Summary: $125M revenue (+23% YoY), 1,250 employees, 5,500 customers
  - Quarterly Financials: Q1 $26M, Q2 $28M, Q3 $32M, Q4 $39M
  - Regional: North America $52M (42%), Europe $38M, Asia Pacific $25M, RoW $10M
  - Products: Enterprise $62M, SMB $38M, Consumer $25M
  - Monthly Revenue: Apr 2023 ($21M) to Mar 2024 ($29M)
  - Human Capital: 1,250 employees, Engineering 450, Sales 320
  - Customer Metrics: CAC $450, LTV $8,500, NPS 72, Churn 2.3%
  - FY2025 Outlook: $150M revenue target

### 2. Financial Time Series (CSV)
- **File**: `data/csv/financial_timeseries.csv`
- **Type**: CSV (32 rows)
- **Columns**: date, region, product, revenue_usd, customers, nps_score, employees
- **Data**: Quarterly data from Jan 2023 to Jan 2024
- **Contains**: Revenue, COGS, gross profit, operating expenses, net income by region/product

### 3. Acme Corp Website (HTML)
- **File**: `data/html/acme_corp.html`
- **Type**: HTML
- **Key Data**:
  - Executive Summary stats
  - Quarterly revenue ($26M, $28M, $32M, $39M)
  - Regional breakdown with customers
  - Product performance
  - 12-month revenue trend
  - Customer metrics
  - Employee breakdown

## Key Metrics for RAG Queries

| Metric | Value |
|--------|-------|
| FY2024 Revenue | $125M |
| YoY Growth | +23% |
| Net Income | $24M |
| Employees | 1,250 |
| Customers | 5,500 |
| NPS | 72 |
| CAC | $450 |
| LTV | $8,500 |
| Churn Rate | 2.3% |

## Query Examples

- "What was our revenue?" → $125M (FY2024)
- "Which region is best?" → North America $52M (42%)
- "Show quarterly growth" → Q1-Q4 trend
- "Customer metrics" → CAC $450, LTV $8,500, NPS 72
- "Employee breakdown" → Engineering 450, Sales 320
- "FY2025 outlook" → $150M target