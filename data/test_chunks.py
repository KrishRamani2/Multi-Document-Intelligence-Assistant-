#!/usr/bin/env python3
"""Test script to extract tables and images using hi_res strategy."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from unstructured.partition.pdf import partition_pdf


def main():
    pdf_path = Path(__file__).parent / "pdf" / "sample_with_image_and_table.pdf"

    print(f"Extracting: {pdf_path.name}")
    print("=" * 60)

    elements = partition_pdf(
        filename=str(pdf_path),
        strategy="hi_res",
        infer_table_structure=True,
    )

    tables = []
    images = []

    for el in elements:
        if type(el).__name__ == "Table":
            tables.append(el)
        elif type(el).__name__ == "Image":
            images.append(el)

    print(f"Tables: {len(tables)}")
    print(f"Images: {len(images)}")

    for i, t in enumerate(tables):
        print(f"\nTable {i + 1}:")
        print(t)


if __name__ == "__main__":
    main()
