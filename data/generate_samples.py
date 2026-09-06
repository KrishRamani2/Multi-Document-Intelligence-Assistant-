#!/usr/bin/env python3
"""Generate sample data files for testing - focused on dense PDF with images and tables."""

from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    PageBreak,
    Flowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from PIL import Image as PILImage, ImageDraw, ImageFont
import io
import matplotlib.pyplot as plt
import numpy as np


DATA_DIR = Path(__file__).parent


def create_sample_styles():
    """Create custom styles."""
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CustomTitle",
            parent=styles["Title"],
            fontSize=28,
            spaceAfter=40,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1a365d"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            parent=styles["Heading1"],
            fontSize=18,
            spaceBefore=30,
            spaceAfter=15,
            textColor=colors.HexColor("#1a365d"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubsectionHeading",
            parent=styles["Heading2"],
            fontSize=14,
            spaceBefore=20,
            spaceAfter=12,
            textColor=colors.HexColor("#2c5282"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="NormalText",
            parent=styles["Normal"],
            fontSize=11,
            spaceAfter=8,
            leading=16,
        )
    )
    return styles


def create_chart_image(filename="chart.png"):
    """Create a matplotlib chart image."""
    fig, ax = plt.subplots(figsize=(5, 3.5))

    x = np.arange(12)
    y = [65, 72, 78, 85, 82, 90, 95, 98, 102, 108, 115, 120]

    ax.plot(x, y, marker="o", linewidth=2.5, markersize=6, color="#2c5282")
    ax.fill_between(x, 0, y, alpha=0.2, color="#2c5282")
    ax.set_title("Monthly Revenue Trend", fontsize=14, fontweight="bold", pad=10)
    ax.set_xlabel("Month (2024)", fontsize=10)
    ax.set_ylabel("Revenue ($K)", fontsize=10)
    ax.set_xticks(x)
    ax.set_xticklabels(
        [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ],
        rotation=45,
    )
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.set_facecolor("#fafbfc")
    fig.patch.set_facecolor("#fafbfc")
    ax.set_ylim(0, 140)

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=100, bbox_inches="tight", facecolor="#fafbfc")
    plt.close()
    buf.seek(0)

    img = PILImage.open(buf)
    img.save(DATA_DIR / "pdf" / filename)
    return DATA_DIR / "pdf" / filename


def create_bar_chart():
    """Create a bar chart showing comparison."""
    fig, ax = plt.subplots(figsize=(4.5, 3))

    categories = ["Q1", "Q2", "Q3", "Q4"]
    values = [125, 142, 138, 156]
    colors_list = ["#4299e1", "#48bb78", "#ecc94b", "#ed8936"]

    bars = ax.bar(
        categories, values, color=colors_list, edgecolor="white", linewidth=1.5
    )
    ax.set_title("Quarterly Revenue", fontsize=14, fontweight="bold")
    ax.set_ylabel("Revenue ($K)", fontsize=10)
    ax.set_ylim(0, 180)

    for bar, val in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 3,
            f"${val}K",
            ha="center",
            fontsize=10,
            fontweight="bold",
        )

    ax.grid(True, axis="y", linestyle="--", alpha=0.3)
    fig.patch.set_facecolor("#fafbfc")

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=100, bbox_inches="tight", facecolor="#fafbfc")
    plt.close()
    buf.seek(0)

    img = PILImage.open(buf)
    img.save(DATA_DIR / "pdf" / "bar_chart.png")
    return DATA_DIR / "pdf" / "bar_chart.png"


def create_pie_chart():
    """Create a pie chart for breakdown."""
    fig, ax = plt.subplots(figsize=(3.5, 3))

    labels = ["Product A", "Product B", "Services", "Licenses"]
    sizes = [35, 30, 20, 15]
    colors_list = ["#4299e1", "#48bb78", "#ed8936", "#9f7aea"]

    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        colors=colors_list,
        autopct="%1.0f%%",
        startangle=90,
        pctdistance=0.75,
    )
    for text in texts:
        text.set_fontsize(9)
    for autotext in autotexts:
        autotext.set_color("white")
        autotext.set_fontsize(10)
        autotext.set_fontweight("bold")

    ax.set_title("Revenue by Category", fontsize=12, fontweight="bold")
    fig.patch.set_facecolor("#fafbfc")

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=100, bbox_inches="tight", facecolor="#fafbfc")
    plt.close()
    buf.seek(0)

    img = PILImage.open(buf)
    img.save(DATA_DIR / "pdf" / "pie_chart.png")
    return DATA_DIR / "pdf" / "pie_chart.png"


def create_heatmap():
    """Create a heatmap-style image for visual interest."""
    img = PILImage.new("RGB", (300, 200), color="#f7fafc")
    draw = ImageDraw.Draw(img)

    data = [
        [0.2, 0.4, 0.6, 0.8, 0.5],
        [0.3, 0.5, 0.7, 0.9, 0.6],
        [0.4, 0.6, 0.8, 0.7, 0.5],
        [0.5, 0.7, 0.9, 0.6, 0.4],
    ]

    cell_w = 60
    cell_h = 50

    for row_idx, row in enumerate(data):
        for col_idx, val in enumerate(row):
            x = col_idx * cell_w
            y = row_idx * cell_h
            intensity = int(val * 255)
            color = (intensity, intensity, min(255, intensity + 50))
            draw.rectangle([x, y, x + cell_w, y + cell_h], fill=color, outline="white")

    img.save(DATA_DIR / "pdf" / "heatmap.png")
    return DATA_DIR / "pdf" / "heatmap.png"


def create_pdf_with_rich_content():
    """Create a dense PDF with multiple images and tables for chunking."""
    DATA_DIR.mkdir(exist_ok=True)
    (DATA_DIR / "pdf").mkdir(exist_ok=True)

    print("Creating chart images...")
    create_chart_image()
    create_bar_chart()
    create_pie_chart()
    create_heatmap()

    output = DATA_DIR / "pdf" / "sample_with_image_and_table.pdf"
    print(f"Building PDF: {output}")

    styles = create_sample_styles()
    story = []

    # ============== PAGE 1: Title ==============
    story.append(Paragraph("Annual Business Report 2024", styles["CustomTitle"]))
    story.append(
        Paragraph(
            "<b>Comprehensive Financial Analysis and Strategic Overview</b>",
            styles["NormalText"],
        )
    )
    story.append(Spacer(1, 30))
    story.append(
        Paragraph(
            "Prepared for: Executive Leadership Team<br/>Date: December 2024",
            styles["NormalText"],
        )
    )

    story.append(PageBreak())

    # ============== PAGE 2: Executive Summary ==============
    story.append(Paragraph("1. Executive Summary", styles["SectionHeading"]))
    story.append(
        Paragraph(
            "This report provides a comprehensive analysis of our business performance "
            "for the fiscal year 2024. The document contains detailed financial metrics, "
            "regional performance breakdowns, product analysis, and strategic recommendations "
            "for the upcoming year. Our revenue grew by 24% year-over-year, exceeding "
            "our target of 20%. This growth was driven by strong product sales in the "
            "enterprise segment and expansion into new geographic markets.",
            styles["NormalText"],
        )
    )
    story.append(Spacer(1, 20))
    story.append(
        Paragraph(
            "Key highlights include: successful launch of three new product lines, "
            "expansion into five new countries, achieving a customer satisfaction "
            "score of 94%, and reducing operational costs by 15% through automation.",
            styles["NormalText"],
        )
    )

    story.append(PageBreak())

    # ============== PAGE 3: Revenue Table ==============
    story.append(Paragraph("2. Quarterly Revenue Analysis", styles["SectionHeading"]))
    story.append(
        Paragraph(
            "The following table shows quarterly revenue breakdown by product category:",
            styles["NormalText"],
        )
    )
    story.append(Spacer(1, 15))

    revenue_data = [
        [
            "Quarter",
            "Product A",
            "Product B",
            "Services",
            "Licenses",
            "Total",
            "Growth",
        ],
        ["Q1 2024", "$125,000", "$98,000", "$45,000", "$32,000", "$300,000", "+18%"],
        ["Q2 2024", "$142,000", "$105,000", "$52,000", "$38,000", "$337,000", "+22%"],
        ["Q3 2024", "$138,000", "$112,000", "$58,000", "$42,000", "$350,000", "+18%"],
        ["Q4 2024", "$156,000", "$125,000", "$65,000", "$48,000", "$394,000", "+28%"],
        [
            "<b>Total</b>",
            "<b>$561,000</b>",
            "<b>$440,000</b>",
            "<b>$220,000</b>",
            "<b>$160,000</b>",
            "<b>$1,381,000</b>",
            "<b>+22%</b>",
        ],
    ]

    revenue_table = Table(
        revenue_data,
        colWidths=[
            0.9 * inch,
            1 * inch,
            1 * inch,
            0.9 * inch,
            0.9 * inch,
            1.1 * inch,
            0.7 * inch,
        ],
    )
    revenue_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a365d")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -2),
                    [colors.white, colors.HexColor("#f7fafc")],
                ),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
            ]
        )
    )
    story.append(revenue_table)
    story.append(Spacer(1, 20))

    # Revenue trend chart
    story.append(
        Paragraph("<b>Revenue Trend Visualization</b>", styles["SubsectionHeading"])
    )
    chart_img = Image(
        str(DATA_DIR / "pdf" / "chart.png"), width=4.5 * inch, height=3 * inch
    )
    story.append(chart_img)
    story.append(
        Paragraph(
            "Figure 1: Monthly revenue trend showing consistent growth throughout 2024.",
            styles["NormalText"],
        )
    )

    story.append(PageBreak())

    # ============== PAGE 4: Regional Performance ==============
    story.append(Paragraph("3. Regional Performance", styles["SectionHeading"]))
    story.append(
        Paragraph(
            "Regional breakdown of sales performance with year-over-year comparison:",
            styles["NormalText"],
        )
    )
    story.append(Spacer(1, 15))

    regional_data = [
        ["Region", "2023 Revenue", "2024 Revenue", "Growth", "Customers", "Avg Deal"],
        ["North America", "$450,000", "$580,000", "+29%", "1,250", "$464"],
        ["Europe", "$320,000", "$395,000", "+23%", "890", "$444"],
        ["Asia Pacific", "$180,000", "$265,000", "+47%", "620", "$427"],
        ["Latin America", "$85,000", "$120,000", "+41%", "340", "$353"],
        ["Middle East", "$65,000", "$85,000", "+31%", "180", "$472"],
    ]

    regional_table = Table(
        regional_data,
        colWidths=[
            1.3 * inch,
            1.2 * inch,
            1.2 * inch,
            0.9 * inch,
            1 * inch,
            0.9 * inch,
        ],
    )
    regional_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f7fafc")],
                ),
            ]
        )
    )
    story.append(regional_table)
    story.append(Spacer(1, 25))

    # Quarterly comparison bar chart
    story.append(Paragraph("<b>Quarterly Comparison</b>", styles["SubsectionHeading"]))
    bar_img = Image(
        str(DATA_DIR / "pdf" / "bar_chart.png"), width=4 * inch, height=2.8 * inch
    )
    story.append(bar_img)
    story.append(
        Paragraph(
            "Figure 2: Quarterly revenue comparison showing Q4 as highest performing quarter.",
            styles["NormalText"],
        )
    )

    story.append(PageBreak())

    # ============== PAGE 5: Product Analysis ==============
    story.append(Paragraph("4. Product Line Analysis", styles["SectionHeading"]))
    story.append(
        Paragraph(
            "Detailed breakdown of product performance and market share:",
            styles["NormalText"],
        )
    )
    story.append(Spacer(1, 15))

    product_data = [
        ["Product", "Units Sold", "Revenue", "Margin", "Market Share", "Satisfaction"],
        ["Enterprise Suite", "450", "$561,000", "72%", "41%", "96%"],
        ["Team Package", "820", "$440,000", "65%", "32%", "91%"],
        ["Professional", "1,200", "$220,000", "58%", "16%", "88%"],
        ["Starter", "2,500", "$160,000", "45%", "11%", "94%"],
    ]

    product_table = Table(
        product_data,
        colWidths=[1.4 * inch, 1 * inch, 1.2 * inch, 0.8 * inch, 1 * inch, 1 * inch],
    )
    product_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#276749")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f0fff4")],
                ),
            ]
        )
    )
    story.append(product_table)
    story.append(Spacer(1, 25))

    # Product breakdown pie chart
    story.append(
        Paragraph("<b>Revenue by Product Category</b>", styles["SubsectionHeading"])
    )
    pie_img = Image(
        str(DATA_DIR / "pdf" / "pie_chart.png"), width=3 * inch, height=2.8 * inch
    )
    story.append(pie_img)
    story.append(
        Paragraph(
            "Figure 3: Revenue distribution across product categories.",
            styles["NormalText"],
        )
    )

    story.append(PageBreak())

    # ============== PAGE 6: Customer Metrics ==============
    story.append(Paragraph("5. Customer Metrics", styles["SectionHeading"]))
    story.append(
        Paragraph(
            "Key customer acquisition and retention metrics for 2024:",
            styles["NormalText"],
        )
    )
    story.append(Spacer(1, 15))

    customer_data = [
        ["Metric", "Q1", "Q2", "Q3", "Q4", "YTD"],
        ["New Customers", "125", "142", "138", "156", "561"],
        ["Churn Rate", "2.1%", "1.8%", "1.5%", "1.2%", "1.7%"],
        ["NPS Score", "72", "75", "78", "82", "77"],
        ["Support Tickets", "450", "520", "480", "440", "1,890"],
        ["Resolution Time", "4.2h", "3.8h", "3.2h", "2.8h", "3.5h"],
    ]

    customer_table = Table(
        customer_data,
        colWidths=[
            1.3 * inch,
            0.9 * inch,
            0.9 * inch,
            0.9 * inch,
            0.9 * inch,
            0.9 * inch,
        ],
    )
    customer_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#744210")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#fffaf0")],
                ),
            ]
        )
    )
    story.append(customer_table)

    # Heatmap visualization
    story.append(Spacer(1, 25))
    story.append(
        Paragraph("<b>Customer Engagement Heatmap</b>", styles["SubsectionHeading"])
    )
    heatmap_img = Image(
        str(DATA_DIR / "pdf" / "heatmap.png"), width=3 * inch, height=2 * inch
    )
    story.append(heatmap_img)
    story.append(
        Paragraph(
            "Figure 4: Heatmap showing customer engagement by time and product.",
            styles["NormalText"],
        )
    )

    story.append(PageBreak())

    # ============== PAGE 7: Summary ==============
    story.append(Paragraph("6. Summary and Recommendations", styles["SectionHeading"]))
    story.append(Paragraph("<b>6.1 Key Findings</b>", styles["SubsectionHeading"]))
    story.append(
        Paragraph(
            "1. Revenue exceeded targets by 22%, reaching $1.38M vs. target of $1.13M<br/>"
            "2. Enterprise segment grew 29%, driving overall profitability<br/>"
            "3. Asia Pacific showed fastest growth at 47% year-over-year<br/>"
            "4. Customer satisfaction improved to 94%, up from 88% in 2023<br/>"
            "5. Support resolution time improved by 33% through automation investments",
            styles["NormalText"],
        )
    )
    story.append(Spacer(1, 20))

    story.append(
        Paragraph("<b>6.2 Strategic Recommendations</b>", styles["SubsectionHeading"])
    )
    story.append(
        Paragraph(
            "1. Continue investment in enterprise segment with dedicated account management<br/>"
            "2. Expand Asia Pacific operations with local sales team<br/>"
            "3. Launch next-generation product line in Q2 2025<br/>"
            "4. Increase marketing budget by 15% for lead generation<br/>"
            "5. Implement AI-powered support by end of Q1 2025",
            styles["NormalText"],
        )
    )
    story.append(Spacer(1, 30))

    story.append(Paragraph("<b>6.3 2025 Targets</b>", styles["SubsectionHeading"]))
    story.append(
        Paragraph(
            "Revenue Target: $1.75M (+27% YoY)<br/>"
            "Customer Acquisition: 750 new customers<br/>"
            "Customer Satisfaction: 95%+<br/>"
            "Operational Efficiency: 20% cost reduction",
            styles["NormalText"],
        )
    )

    # Build PDF
    doc = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    doc.build(story)

    print(f"Created: {output}")
    return output


def create_other_formats():
    """Create other sample formats."""
    # HTML with table
    (DATA_DIR / "html").mkdir(exist_ok=True)
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Employee Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #cbd5e0; padding: 12px; text-align: left; }
        th { background: #1a365d; color: white; }
        tr:nth-child(even) { background: #f7fafc; }
    </style>
</head>
<body>
    <h1>Quarterly Performance Report</h1>
    
    <h2>Employee Metrics</h2>
    <table>
        <tr><th>Name</th><th>Department</th><th>Projects</th><th>Efficiency</th></tr>
        <tr><td>Alice Johnson</td><td>Engineering</td><td>12</td><td>95%</td></tr>
        <tr><td>Bob Smith</td><td>Marketing</td><td>8</td><td>88%</td></tr>
        <tr><td>Carol Williams</td><td>Engineering</td><td>15</td><td>92%</td></tr>
        <tr><td>David Brown</td><td>Sales</td><td>22</td><td>85%</td></tr>
    </table>
</body>
</html>"""
    (DATA_DIR / "html" / "sample_with_table.html").write_text(html_content)
    print(f"Created: {DATA_DIR / 'html' / 'sample_with_table.html'}")

    # CSV
    (DATA_DIR / "csv").mkdir(exist_ok=True)
    csv_content = """name,department,projects,revenue,efficiency
Alice Johnson,Engineering,12,125000,95%
Bob Smith,Marketing,8,95000,88%
Carol Williams,Engineering,15,142000,92%
David Brown,Sales,22,156000,85%
"""
    (DATA_DIR / "csv" / "sample.csv").write_text(csv_content)
    print(f"Created: {DATA_DIR / 'csv' / 'sample.csv'}")

    # JSON
    (DATA_DIR / "json").mkdir(exist_ok=True)
    import json

    json_data = {
        "report": "Quarterly Performance",
        "employees": [
            {"name": "Alice", "dept": "Engineering", "projects": 12, "revenue": 125000},
            {"name": "Bob", "dept": "Marketing", "projects": 8, "revenue": 95000},
        ],
        "metrics": {"total_revenue": 220000, "avg_efficiency": 90},
    }
    (DATA_DIR / "json" / "sample.json").write_text(json.dumps(json_data, indent=2))
    print(f"Created: {DATA_DIR / 'json' / 'sample.json'}")

    # Markdown with table
    (DATA_DIR / "markdown").mkdir(exist_ok=True)
    md_content = """# Quarterly Report

## Employee Performance

| Name | Department | Projects | Revenue | Efficiency |
|------|-----------|----------|---------|------------|
| Alice | Engineering | 12 | $125,000 | 95% |
| Bob | Marketing | 8 | $95,000 | 88% |
| Carol | Engineering | 15 | $142,000 | 92% |
| David | Sales | 22 | $156,000 | 85% |

## Summary

- Total Revenue: $518,000
- Average Efficiency: 90%
"""
    (DATA_DIR / "markdown" / "sample_with_table.md").write_text(md_content)
    print(f"Created: {DATA_DIR / 'markdown' / 'sample_with_table.md'}")

    # Image
    (DATA_DIR / "image").mkdir(exist_ok=True)
    img = PILImage.new("RGB", (400, 200), color="#1a365d")
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 350, 150], fill="#2c5282", outline="white", width=3)
    draw.text((150, 90), "Sample Image", fill="white")
    img.save(DATA_DIR / "image" / "sample.png")
    print(f"Created: {DATA_DIR / 'image' / 'sample.png'}")


def main():
    """Generate all sample files."""
    print("Generating sample data files...")
    print(f"Output directory: {DATA_DIR}")
    print("-" * 40)

    create_pdf_with_rich_content()
    create_other_formats()

    print("-" * 40)
    print("Done!")
    print(f"\nAll files created in: {DATA_DIR}")


if __name__ == "__main__":
    main()
