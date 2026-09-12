#!/usr/bin/env python3
"""Create paired crate labels on Avery 5163/8163 Letter sheets.

Run with Python containing reportlab. Node + this app's installed dependencies
provide the same crateLabelUrl() and QR encoder used by ContainerLabel.tsx.

Geometry source: https://www.avery.com/templates/5163
Official portrait download: US_en/Downloadables/pdf/U-0090-01.pdf
Its ten rounded paths are 288 x 144 pt at x=11.2001/312.7504 pt and
top=36,180,324,468,612 pt. Each crate gets a front/side and lid label.
The default range remains crates 1-5; partial final sheets are left blank.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess

from reportlab.pdfgen import canvas

APP = Path(__file__).resolve().parents[1]
PAGE = (612.0, 792.0)
LABEL_W, LABEL_H = 288.0, 144.0
COLUMN_X = (11.2001, 312.7504)
ROW_TOP = (36.0, 180.0, 324.0, 468.0, 612.0)
QR_SIZE = 94.0
QR_QUIET_MODULES = 4

NODE_SOURCE = r"""
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import qrcode from 'qrcode-generator';
const source = readFileSync('src/crates/labelLinks.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const { crateLabelUrl, parseCrateLabelHash } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const labels = JSON.parse(process.argv[1]).map(number => {
  const code = `C-${String(number).padStart(3, '0')}`;
  const payload = crateLabelUrl(code);
  if (!payload || parseCrateLabelHash(new URL(payload).hash) !== code
    || new URL(payload).origin !== 'https://garage-reset.vercel.app'
    || payload.includes('access=')) throw Error('Invalid crate QR route');
  const qr = qrcode(0, 'M'); qr.addData(payload); qr.make();
  const size = qr.getModuleCount();
  return { code, payload, modules: Array.from({length:size}, (_, row) =>
    Array.from({length:size}, (_, col) => qr.isDark(row, col))) };
});
process.stdout.write(JSON.stringify(labels));
"""


def qr_labels(start: int, end: int) -> list[dict]:
    node = os.environ.get("GARAGE_LABEL_NODE") or shutil.which("node")
    if not node:
        raise SystemExit("Node.js is required; set GARAGE_LABEL_NODE to its path.")
    result = subprocess.run(
        [node, "--input-type=module", "-e", NODE_SOURCE, json.dumps(list(range(start, end + 1)))], cwd=APP,
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def draw_qr(pdf: canvas.Canvas, modules: list[list[bool]], x: float, y: float) -> None:
    count = len(modules)
    pitch = QR_SIZE / (count + 2 * QR_QUIET_MODULES)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.rect(x, y, QR_SIZE, QR_SIZE, fill=1, stroke=0)
    pdf.setFillColorRGB(0, 0, 0)
    # Merge adjacent dark modules into vector runs without touching the quiet zone.
    for row, values in enumerate(modules):
        col = 0
        while col < count:
            if not values[col]:
                col += 1
                continue
            start = col
            while col < count and values[col]:
                col += 1
            pdf.rect(
                x + (start + QR_QUIET_MODULES) * pitch,
                y + (count - row - 1 + QR_QUIET_MODULES) * pitch,
                (col - start) * pitch, pitch, fill=1, stroke=0,
            )


def draw_label(pdf: canvas.Canvas, label: dict, x: float, top: float, placement: str) -> None:
    y_top = PAGE[1] - top
    pdf.saveState()
    pdf.translate(x, y_top - LABEL_H)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawString(14, LABEL_H - 21, "GARAGE RESET")
    pdf.setFont("Helvetica-Bold", 37)
    pdf.drawString(12, LABEL_H - 61, label["code"])
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(14, LABEL_H - 80, placement)
    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(14, LABEL_H - 98, "Name / contents")
    pdf.setLineWidth(0.55)
    pdf.line(14, LABEL_H - 117, 168, LABEL_H - 117)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(14, LABEL_H - 132, "Keep this ID. Update the contents.")
    qr_x = LABEL_W - 14 - QR_SIZE
    qr_y = LABEL_H - 15 - QR_SIZE
    draw_qr(pdf, label["modules"], qr_x, qr_y)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(qr_x + QR_SIZE / 2, LABEL_H - 122, "SCAN TO OPEN")
    pdf.linkURL(label["payload"], (qr_x, qr_y, qr_x + QR_SIZE, qr_y + QR_SIZE), relative=1, thickness=0)
    pdf.restoreState()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=1, help="First crate number (default: 1)")
    parser.add_argument("--end", type=int, default=5, help="Last crate number (default: 5)")
    parser.add_argument("--output", type=Path, help="PDF path; defaults to the matching range in public/print")
    args = parser.parse_args()
    if not 1 <= args.start <= args.end <= 999:
        parser.error("Use a crate range from 1 through 999, with start no greater than end.")
    args.output = args.output or APP / f"public/print/garage-labels-avery-5163-crates-{args.start}-{args.end}.pdf"
    labels = qr_labels(args.start, args.end)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(args.output), pagesize=PAGE, pageCompression=1, invariant=1)
    pdf.setTitle(f"Garage Reset - Crates {args.start}-{args.end} - Avery 5163 / 8163")
    pdf.setAuthor("Garage Reset")
    pdf.setSubject(f"{len(labels)*2} labels, 2 x 4 inches: front/side and lid pairs. Print Letter at actual size, 100 percent.")
    pdf.setViewerPreference("PrintScaling", "None")
    for index, label in enumerate(labels):
        row = index % len(ROW_TOP)
        if index and row == 0:
            pdf.showPage()
        draw_label(pdf, label, COLUMN_X[0], ROW_TOP[row], "FRONT / SIDE")
        draw_label(pdf, label, COLUMN_X[1], ROW_TOP[row], "LID")
    pdf.showPage()
    pdf.save()
    print(f"Created {(len(labels)+4)//5} Letter page(s) with {len(labels)*2} labels: {args.output}")
    for label in labels:
        print(label["code"], label["payload"])


if __name__ == "__main__":
    main()
