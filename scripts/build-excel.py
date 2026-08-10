#!/usr/bin/env python3
"""
build-excel.py — Generate docs/survey-responses.xlsx from the Google Form CSV
export (docs/survey-responses.csv).

Dependency-free: writes a real .xlsx (an Office Open XML zip) using only the
Python standard library, so it runs anywhere with Python 3. Two sheets:

  1. "Responses"      — every survey response, one row per user, formatted header.
  2. "Summary"        — headline metrics: count, avg rating, recommend split.

Usage:
    python3 scripts/build-excel.py
    python3 scripts/build-excel.py --csv path/to/export.csv --out docs/survey-responses.xlsx
"""

import argparse
import csv
import os
import zipfile
from xml.sax.saxutils import escape

XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'


def col_letter(idx):
    """0-based column index -> spreadsheet column letter (A, B, ... Z, AA...)."""
    s = ""
    idx += 1
    while idx:
        idx, rem = divmod(idx - 1, 26)
        s = chr(65 + rem) + s
    return s


def build_sheet_xml(headers, rows, col_widths=None, first_col_widths=None):
    """Return sheet XML with a bold header row and raw string cells."""
    col_count = max(len(headers), *(len(r) for r in rows)) if rows else len(headers)
    cols = []
    for i in range(col_count):
        width = None
        if col_widths and i < len(col_widths):
            width = col_widths[i]
        elif first_col_widths and i == 0:
            width = first_col_widths[0]
        width = width or 16
        cols.append(f'<col min="{i+1}" max="{i+1}" width="{width}" customWidth="1"/>')

    out = []
    for r, row in enumerate([headers] + rows):
        cells = []
        for c, val in enumerate(row):
            v = str(val)
            style = ' s="1"' if r == 0 else ""
            cells.append(f'<c r="{col_letter(c)}{r+1}" t="inlineStr"{style}><is><t xml:space="preserve">{escape(v)}</t></is></c>')
        out.append('<row r="%d">%s</row>' % (r + 1, "".join(cells)))

    return (
        XML_DECL
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + "<cols>%s</cols>" % "".join(cols)
        + "<sheetData>%s</sheetData>" % "".join(out)
        + "</worksheet>"
    )


def build_styles_xml():
    """Minimal styles: default font + a bold header (xf id 1)."""
    return XML_DECL + (
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="2"><fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill></fills>'
        '<borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
        '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="0" fontId="1" applyFont="1"/></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0"/></cellStyles>'
        "</styleSheet>"
    )


def build_workbook_xml(sheet_names):
    sheets = "".join(
        f'<sheet name="{escape(name)}" sheetId="{i+1}" r:id="rId{i+1}"/>'
        for i, name in enumerate(sheet_names)
    )
    return (
        XML_DECL
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        "<sheets>%s</sheets></workbook>" % sheets
    )


def build_content_types(sheet_count):
    sheets = "".join(
        f'<Override PartName="/xl/worksheets/sheet{i+1}.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for i in range(sheet_count)
    )
    return XML_DECL + (
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + sheets
        + "</Types>"
    )


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    if not rows:
        raise SystemExit(f"No data found in {path}")
    headers = [h.strip() for h in rows[0]]
    data = rows[1:]
    return headers, data


def main():
    parser = argparse.ArgumentParser(description="Generate PayLoop survey Excel from CSV.")
    parser.add_argument("--csv", default=os.path.join("docs", "survey-responses.csv"))
    parser.add_argument("--out", default=os.path.join("docs", "survey-responses.xlsx"))
    args = parser.parse_args()

    headers, data = read_csv(args.csv)

    rating_idx = next((i for i, h in enumerate(headers) if "rating" in h.lower() and "product" in h.lower()), None)
    recommend_idx = next((i for i, h in enumerate(headers) if "recommend" in h.lower()), None)
    name_idx = next((i for i, h in enumerate(headers) if h.lower().startswith("name")), None)

    ratings = []
    for row in data:
        if rating_idx is not None:
            try:
                ratings.append(float(row[rating_idx]))
            except (ValueError, IndexError):
                pass
    recommends = []
    if recommend_idx is not None:
        recommends = [row[recommend_idx].strip().lower() for row in data if recommend_idx < len(row)]
    yes = sum(1 for r in recommends if r.startswith("yes"))
    no = sum(1 for r in recommends if r.startswith("no"))
    maybe = len(recommends) - yes - no

    avg = round(sum(ratings) / len(ratings), 2) if ratings else 0
    max_r = max(headers.index(h) for h in headers)

    width_hint = [int(max(len(str(row[c])), len(headers[c])) * 1.35 + 2) for c in range(max_r + 1)]

    summary = [
        ["Metric", "Value"],
        ["Total responses", len(data)],
        ["Product rating average (out of 6)", avg],
        ["Ratings collected", len(ratings)],
        ["Would recommend — Yes", yes],
        ["Would recommend — No", no],
        ["Would recommend — Maybe", maybe],
        ["Network", "Testnet"],
        ["Export generated (UTC)", __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%d %H:%M:%S")],
    ]

    sheet1 = build_sheet_xml(headers, data, col_widths=width_hint)
    sheet2 = build_sheet_xml(summary[0], summary[1:], col_widths=[38, 12])

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", build_content_types(2))
        z.writestr("_rels/.rels", XML_DECL + (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>"
        ))
        z.writestr("xl/workbook.xml", build_workbook_xml(["Responses", "Summary"]))
        z.writestr("xl/_rels/workbook.xml.rels", XML_DECL + (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            "</Relationships>"
        ))
        z.writestr("xl/styles.xml", build_styles_xml())
        z.writestr("xl/worksheets/sheet1.xml", sheet1)
        z.writestr("xl/worksheets/sheet2.xml", sheet2)

    print(f"Wrote {args.out} ({len(data)} responses, avg rating {avg})")


if __name__ == "__main__":
    main()
