"""
Create a sample PDF with hierarchy, tables, and images for testing.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Table,
    TableStyle,
    Image,
)
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import os

# Create PDF
output_path = "test_llm.pdf"

doc = SimpleDocTemplate(
    output_path,
    pagesize=letter,
    topMargin=0.5 * inch,
    bottomMargin=0.5 * inch,
)

styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle(
    "CustomTitle",
    parent=styles["Heading1"],
    fontSize=24,
    spaceAfter=30,
    alignment=TA_CENTER,
)

heading1_style = ParagraphStyle(
    "Heading1Custom",
    parent=styles["Heading1"],
    fontSize=18,
    spaceAfter=12,
    spaceBefore=20,
    textColor=colors.HexColor("#1a1a2e"),
)

heading2_style = ParagraphStyle(
    "Heading2Custom",
    parent=styles["Heading2"],
    fontSize=14,
    spaceAfter=8,
    spaceBefore=12,
    textColor=colors.HexColor("#16213e"),
)

heading3_style = ParagraphStyle(
    "Heading3Custom",
    parent=styles["Heading3"],
    fontSize=12,
    spaceAfter=6,
    spaceBefore=8,
    textColor=colors.HexColor("#0f3460"),
)

body_style = ParagraphStyle(
    "BodyCustom",
    parent=styles["BodyText"],
    fontSize=11,
    spaceAfter=10,
    alignment=TA_LEFT,
)

# Build content
story = []

# ===== PAGE 1: Title and Introduction =====
story.append(Paragraph("Large Language Models: A Comprehensive Guide", title_style))
story.append(Spacer(1, 20))

story.append(Paragraph("Understanding the Foundation of Modern AI", styles["Heading3"]))
story.append(Spacer(1, 10))

intro_text = """
Large Language Models (LLMs) represent a groundbreaking advancement in artificial intelligence. 
These models are trained on vast amounts of text data and can understand, generate, and manipulate 
human language with remarkable proficiency. The emergence of transformer architectures in 2017 
marked a pivotal moment in NLP, enabling models to process sequential data with unprecedented 
parallelization and attention to contextual relationships.
"""
story.append(Paragraph(intro_text, body_style))

story.append(PageBreak())

# ===== PAGE 2: Architecture and Types =====
story.append(Paragraph("1. Architecture Overview", heading1_style))
story.append(Spacer(1, 10))

story.append(Paragraph("1.1 Transformer Architecture", heading2_style))

transformer_text = """
The transformer architecture relies on the self-attention mechanism, which allows the model to 
weigh the significance of different parts of the input when processing each element. This 
enables parallel processing and captures long-range dependencies in text more effectively than 
previous recurrent architectures like LSTM and GRU.
"""
story.append(Paragraph(transformer_text, body_style))

story.append(Paragraph("1.2 Key Components", heading2_style))

components = [
    ["Component", "Description", "Function"],
    ["Attention Mechanism", "Self-Attention", "Calculates relationship between tokens"],
    ["Feed-Forward Networks", "Dense Layers", "Processes attention outputs"],
    ["Positional Encoding", "Sinusoidal", "Adds sequence order information"],
    ["Layer Normalization", "Stable Training", "Normalizes activations"],
]

table = Table(components, colWidths=[1.5 * inch, 2 * inch, 2.5 * inch])
table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 11),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f5f5f5")),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]
    )
)
story.append(table)
story.append(Spacer(1, 15))

story.append(Paragraph("1.3 Types of LLMs", heading2_style))

llm_types = """
There are several categories of large language models, each with distinct characteristics. 
Encoder-only models like BERT excel at understanding tasks such as classification and named 
entity recognition. Decoder-only models like GPT series are optimized for text generation. 
Encoder-decoder models like T5 and BART combine both approaches for tasks requiring both 
understanding and generation capabilities.
"""
story.append(Paragraph(llm_types, body_style))

story.append(PageBreak())

# ===== PAGE 3: Training and Applications =====
story.append(Paragraph("2. Training Methodology", heading1_style))
story.append(Spacer(1, 10))

story.append(Paragraph("2.1 Pre-training Phase", heading2_style))

pretrain_text = """
The pre-training phase involves training the model on a large corpus of text data using 
unsupervised learning objectives. The two most common approaches are: Masked Language Modeling 
(MLM), where random tokens are masked and the model learns to predict them, and Next Token 
Prediction (NTP), where the model learns to predict the next token in a sequence. This phase 
helps the model learn general language representations and world knowledge.
"""
story.append(Paragraph(pretrain_text, body_style))

story.append(Paragraph("2.2 Fine-tuning Phase", heading2_style))

finetune_text = """
Fine-tuning adapts pre-trained models to specific downstream tasks. This process typically 
involves continuing training on a smaller, task-specific dataset. Popular fine-tuning 
techniques include instruction tuning, where models learn to follow instructions, and 
RLHF (Reinforcement Learning from Human Feedback), which aligns model outputs with human 
preferences using reward models and Proximal Policy Optimization.
"""
story.append(Paragraph(finetune_text, body_style))

# Training statistics table
stats_data = [
    ["Metric", "GPT-3", "GPT-4", "Claude 3"],
    ["Parameters", "175B", "~1.7T*", "~100B"],
    ["Training Tokens", "300B", "13T", "10T"],
    ["Context Window", "4K", "128K", "200K"],
    ["Training Cost", "$4.6M", "~$100M", "~$25M"],
]

stats_table = Table(
    stats_data, colWidths=[1.5 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch]
)
stats_table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16213e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#e8e8e8")),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]
    )
)
story.append(stats_table)
story.append(Spacer(1, 15))

story.append(Paragraph("3. Applications", heading1_style))

apps_text = """
LLMs have found applications across numerous domains including: Natural Language Understanding 
for sentiment analysis and text classification; Text Generation for creative writing and content 
creation; Code Generation through tools like GitHub Copilot; Question Answering for information 
retrieval; and Dialog Systems for customer service and personal assistants. The versatility 
of these models continues to expand as research progresses.
"""
story.append(Paragraph(apps_text, body_style))

# Add note about approximate numbers
note_text = "* Note: Some numbers are estimates based on public information"
story.append(
    Paragraph(
        note_text,
        ParagraphStyle(
            "Note", parent=styles["Normal"], fontSize=8, textColor=colors.grey
        ),
    )
)

# Build PDF
doc.build(story)

print(f"Created: {output_path}")
print(f"Size: {os.path.getsize(output_path)} bytes")
