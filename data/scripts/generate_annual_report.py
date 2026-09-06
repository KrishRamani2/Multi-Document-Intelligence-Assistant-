#!/usr/bin/env python3
"""Generate heavy annual report PDF - simple version."""

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib import colors

doc = SimpleDocTemplate("annual_report_2024.pdf", pagesize=letter)
story = []
styles = getSampleStyleSheet()

# Title
story.append(Paragraph("<b>ACME CORP</b>", styles["Title"]))
story.append(Paragraph("Annual Report 2024", styles["Title"]))
story.append(Spacer(1, 0.3 * inch))
story.append(
    Paragraph("<b>Driving Innovation, Delivering Value</b>", styles["Heading2"])
)
story.append(Spacer(1, 2 * inch))
story.append(Paragraph("FY 2024 (April 2023 - March 2024)", styles["Normal"]))
story.append(PageBreak())

# 1. Executive Summary
story.append(Paragraph("1. Executive Summary", styles["Heading1"]))
story.append(
    Paragraph(
        "Acme Corp achieved record-breaking performance in FY2024, with revenue growing 23% year-over-year to reach $125 million. This marks our eighth consecutive year of double-digit growth.",
        styles["Normal"],
    )
)
story.append(Spacer(1, 0.2 * inch))
story.append(Paragraph("Key Metrics:", styles["Heading2"]))
for m in [
    "Revenue: $101M → $125M (+23%)",
    "Net Income: $18M → $24M (+33%)",
    "Employees: 1,087 → 1,250 (+15%)",
    "Customers: 4,200 → 5,500 (+31%)",
    "NPS: 65 → 72",
]:
    story.append(Paragraph(m, styles["Normal"]))
story.append(PageBreak())

# 2. Quarterly
story.append(Paragraph("2. Quarterly Financials", styles["Heading1"]))
story.append(Paragraph("All figures in millions:", styles["Normal"]))
story.append(Paragraph("Q1 FY24: Revenue $26M, Net Income $4.5M", styles["Normal"]))
story.append(Paragraph("Q2 FY24: Revenue $28M, Net Income $5M", styles["Normal"]))
story.append(Paragraph("Q3 FY24: Revenue $32M, Net Income $6.5M", styles["Normal"]))
story.append(Paragraph("Q4 FY24: Revenue $39M, Net Income $9M", styles["Normal"]))
story.append(PageBreak())

# 3. Regional
story.append(Paragraph("3. Regional Performance", styles["Heading1"]))
story.append(
    Paragraph(
        "North America: $52M (42%), +21% YoY, 2,450 customers, NPS 75", styles["Normal"]
    )
)
story.append(
    Paragraph("Europe: $38M (30%), +18% YoY, 1,650 customers, NPS 70", styles["Normal"])
)
story.append(
    Paragraph(
        "Asia Pacific: $25M (20%), +35% YoY, 1,100 customers, NPS 72", styles["Normal"]
    )
)
story.append(
    Paragraph(
        "Rest of World: $10M (8%), +25% YoY, 300 customers, NPS 68", styles["Normal"]
    )
)
story.append(PageBreak())

# 4. Products
story.append(Paragraph("4. Product Performance", styles["Heading1"]))
story.append(
    Paragraph(
        "Enterprise: $62M, 45% margin, 850 customers, 1.8% churn", styles["Normal"]
    )
)
story.append(
    Paragraph("SMB: $38M, 52% margin, 3,200 customers, 2.5% churn", styles["Normal"])
)
story.append(
    Paragraph(
        "Consumer: $25M, 38% margin, 1,450 customers, 3.2% churn", styles["Normal"]
    )
)
story.append(PageBreak())

# 5. Monthly
story.append(Paragraph("5. Monthly Revenue - Part 1", styles["Heading1"]))
for m, r in [
    ("Apr 2023", 21),
    ("May 2023", 22),
    ("Jun 2023", 22),
    ("Jul 2023", 23),
    ("Aug 2023", 24),
    ("Sep 2023", 24),
]:
    story.append(Paragraph(f"{m}: ${r}M", styles["Normal"]))
story.append(PageBreak())

story.append(Paragraph("5. Monthly Revenue - Part 2", styles["Heading1"]))
for m, r in [
    ("Oct 2023", 25),
    ("Nov 2023", 26),
    ("Dec 2023", 27),
    ("Jan 2024", 26),
    ("Feb 2024", 28),
    ("Mar 2024", 29),
]:
    story.append(Paragraph(f"{m}: ${r}M", styles["Normal"]))
story.append(PageBreak())

# 6. Human Capital
story.append(Paragraph("6. Human Capital", styles["Heading1"]))
story.append(
    Paragraph("Engineering: 450 employees, 2.8 yrs avg tenure", styles["Normal"])
)
story.append(Paragraph("Sales: 320 employees, 3.1 yrs avg tenure", styles["Normal"]))
story.append(
    Paragraph("Marketing: 180 employees, 2.5 yrs avg tenure", styles["Normal"])
)
story.append(
    Paragraph("Operations: 150 employees, 4.2 yrs avg tenure", styles["Normal"])
)
story.append(Paragraph("Finance: 80 employees, 4.5 yrs avg tenure", styles["Normal"]))
story.append(
    Paragraph("HR & Admin: 70 employees, 3.8 yrs avg tenure", styles["Normal"])
)
story.append(PageBreak())

# 7. Customer
story.append(Paragraph("7. Customer Metrics", styles["Heading1"]))
story.append(Paragraph("Customer Acquisition Cost (CAC): $450", styles["Normal"]))
story.append(Paragraph("Customer Lifetime Value (LTV): $8,500", styles["Normal"]))
story.append(Paragraph("LTV:CAC Ratio: 18.9x", styles["Normal"]))
story.append(Paragraph("Net Promoter Score: 72", styles["Normal"]))
story.append(Paragraph("Overall Churn Rate: 2.3%", styles["Normal"]))
story.append(PageBreak())

# 8. Risks
story.append(Paragraph("8. Risk Factors", styles["Heading1"]))
story.append(Paragraph("1. Economic uncertainty in key markets", styles["Normal"]))
story.append(Paragraph("2. Increased competition in SMB segment", styles["Normal"]))
story.append(
    Paragraph(
        "3. Currency fluctuation exposure (30% revenue in EMEA)", styles["Normal"]
    )
)
story.append(Paragraph("4. Key talent retention in engineering", styles["Normal"]))
story.append(PageBreak())

# 9. Outlook
story.append(Paragraph("9. FY2025 Outlook", styles["Heading1"]))
story.append(Paragraph("Revenue: $150M (+20% YoY)", styles["Normal"]))
story.append(Paragraph("Net Income: $30M (+25% YoY)", styles["Normal"]))
story.append(Paragraph("Employees: 1,500 (+20%)", styles["Normal"]))
story.append(Paragraph("Customers: 7,500 (+36%)", styles["Normal"]))
story.append(Paragraph("NPS: 75+", styles["Normal"]))

doc.build(story)
print("PDF created: annual_report_2024.pdf")
