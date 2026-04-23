import { PDFDocument, rgb, PDFFont, PDFPage, RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { generateContractLines, ContractData, ContractLine } from './contract-templates';

// ── Layout constants ──
const PAGE_W = 595.28;  // A4
const PAGE_H = 841.89;
const ML = 55;           // margin left
const MR = 55;           // margin right
const MT = 60;           // margin top
const MB = 65;           // margin bottom
const CW = PAGE_W - ML - MR;  // content width

// ── Typography ──
const TITLE_SIZE = 15;
const SUBTITLE_SIZE = 10;
const HEADING_SIZE = 10.5;
const BODY_SIZE = 9.5;
const PARTY_LABEL_SIZE = 10;
const PARTY_FIELD_SIZE = 9;
const SUB_ITEM_SIZE = 9.5;
const FOOTER_SIZE = 7.5;

const LINE_H = 14;       // line height for body
const HEADING_H = 16;    // line height for headings
const PARTY_H = 13;      // line height for party fields
const GAP_H = 8;         // gap height

// ── Colors ──
const ACCENT: RGB = rgb(0.13, 0.55, 0.52);       // teal accent
const DARK: RGB = rgb(0.10, 0.10, 0.14);           // main text
const MEDIUM: RGB = rgb(0.30, 0.30, 0.35);         // secondary text
const LIGHT: RGB = rgb(0.50, 0.50, 0.55);          // light text
const ACCENT_BG: RGB = rgb(0.93, 0.97, 0.97);      // light teal bg
const SEPARATOR: RGB = rgb(0.82, 0.82, 0.85);      // separator line
const USER_TEXT_BG: RGB = rgb(0.96, 0.97, 0.99);    // user text background

// ── Font loading ──
function findSystemFont(): Buffer {
  const candidates = [
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'calibri.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'segoeui.ttf'),
    '/Library/Fonts/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ];
  for (const fp of candidates) {
    try { if (fs.existsSync(fp)) return fs.readFileSync(fp); } catch { continue; }
  }
  throw new Error('Nem található megfelelő betűtípus. Telepítsen Arial vagy Calibri betűtípust.');
}

function findBoldFont(): Buffer | null {
  const candidates = [
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'calibrib.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arialbd.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'segoeuib.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ];
  for (const fp of candidates) {
    try { if (fs.existsSync(fp)) return fs.readFileSync(fp); } catch { continue; }
  }
  return null;
}

function findItalicFont(): Buffer | null {
  const candidates = [
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'calibrii.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'ariali.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'segoeuii.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
  ];
  for (const fp of candidates) {
    try { if (fs.existsSync(fp)) return fs.readFileSync(fp); } catch { continue; }
  }
  return null;
}

// ── Text wrapping ──
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') { result.push(''); continue; }
    const words = para.split(' ');
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) result.push(currentLine);
  }
  return result;
}

// ── Main generator ──
export async function generateContractPdf(templateId: string, data: ContractData): Promise<Buffer> {
  const contractLines = generateContractLines(templateId, data);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = findSystemFont();
  const boldBytes = findBoldFont();
  const italicBytes = findItalicFont();

  const font = await pdfDoc.embedFont(fontBytes);
  const bold = boldBytes ? await pdfDoc.embedFont(boldBytes) : font;
  const italic = italicBytes ? await pdfDoc.embedFont(italicBytes) : font;

  let pageNum = 0;
  let page: PDFPage = null!;
  let y = PAGE_H - MT;

  function newPage(): PDFPage {
    pageNum++;
    const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MT;

    // Header accent bar (thin teal line at top)
    p.drawRectangle({
      x: 0,
      y: PAGE_H - 4,
      width: PAGE_W,
      height: 4,
      color: ACCENT,
    });

    return p;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MB) {
      drawFooter();
      page = newPage();
    }
  }

  function drawFooter() {
    // Page number
    const text = `— ${pageNum} —`;
    const tw = font.widthOfTextAtSize(text, FOOTER_SIZE);
    page.drawText(text, {
      x: (PAGE_W - tw) / 2,
      y: MB - 30,
      size: FOOTER_SIZE,
      font,
      color: LIGHT,
    });

    // Bottom accent line
    page.drawLine({
      start: { x: ML, y: MB - 15 },
      end: { x: PAGE_W - MR, y: MB - 15 },
      thickness: 0.5,
      color: SEPARATOR,
    });
  }

  page = newPage();

  // ── Render each line ──
  for (const line of contractLines) {
    switch (line.type) {

      case 'title': {
        ensureSpace(30);
        const tw = bold.widthOfTextAtSize(line.text, TITLE_SIZE);
        const tx = (PAGE_W - tw) / 2;
        page.drawText(line.text, { x: tx, y, size: TITLE_SIZE, font: bold, color: DARK });
        y -= TITLE_SIZE + 4;
        // Decorative line under title
        const lineW = Math.min(tw + 40, CW * 0.6);
        const lineX = (PAGE_W - lineW) / 2;
        page.drawLine({
          start: { x: lineX, y },
          end: { x: lineX + lineW, y },
          thickness: 1.5,
          color: ACCENT,
        });
        y -= 8;
        break;
      }

      case 'subtitle': {
        ensureSpace(16);
        const tw = italic.widthOfTextAtSize(line.text, SUBTITLE_SIZE);
        page.drawText(line.text, { x: (PAGE_W - tw) / 2, y, size: SUBTITLE_SIZE, font: italic, color: MEDIUM });
        y -= SUBTITLE_SIZE + 6;
        break;
      }

      case 'preamble': {
        ensureSpace(LINE_H);
        const wrapped = wrapText(line.text, italic, BODY_SIZE, CW);
        for (const wl of wrapped) {
          ensureSpace(LINE_H);
          const tw = italic.widthOfTextAtSize(wl, BODY_SIZE);
          page.drawText(wl, { x: (PAGE_W - tw) / 2, y, size: BODY_SIZE, font: italic, color: MEDIUM });
          y -= LINE_H;
        }
        break;
      }

      case 'party-label': {
        ensureSpace(PARTY_H + 6);
        // Small teal accent bar before party label
        page.drawRectangle({
          x: ML,
          y: y - 2,
          width: 3,
          height: PARTY_LABEL_SIZE + 4,
          color: ACCENT,
        });
        page.drawText(line.text, { x: ML + 10, y, size: PARTY_LABEL_SIZE, font: bold, color: ACCENT });
        y -= PARTY_H + 2;
        break;
      }

      case 'party-field': {
        ensureSpace(PARTY_H);
        // Light indent with smaller text
        page.drawText(line.text, { x: ML + 16, y, size: PARTY_FIELD_SIZE, font, color: DARK });
        y -= PARTY_H;
        break;
      }

      case 'section-heading': {
        ensureSpace(HEADING_H + 10);
        y -= 6; // Extra space before heading

        // Teal left border for section heading
        page.drawRectangle({
          x: ML,
          y: y - 3,
          width: 3,
          height: HEADING_SIZE + 6,
          color: ACCENT,
        });

        // Light background band
        page.drawRectangle({
          x: ML,
          y: y - 4,
          width: CW,
          height: HEADING_SIZE + 8,
          color: ACCENT_BG,
        });

        page.drawText(line.text, { x: ML + 10, y, size: HEADING_SIZE, font: bold, color: DARK });
        y -= HEADING_H + 4;
        break;
      }

      case 'clause': {
        const wrapped = wrapText(line.text, font, BODY_SIZE, CW - 10);
        for (let i = 0; i < wrapped.length; i++) {
          ensureSpace(LINE_H);
          page.drawText(wrapped[i], { x: ML + 10, y, size: BODY_SIZE, font, color: DARK });
          y -= LINE_H;
        }
        break;
      }

      case 'sub-item': {
        const wrapped = wrapText(line.text, font, SUB_ITEM_SIZE, CW - 30);
        for (let i = 0; i < wrapped.length; i++) {
          ensureSpace(LINE_H);
          page.drawText(wrapped[i], { x: ML + 26, y, size: SUB_ITEM_SIZE, font, color: MEDIUM });
          y -= LINE_H;
        }
        break;
      }

      case 'body': {
        const wrapped = wrapText(line.text, font, BODY_SIZE, CW);
        for (const wl of wrapped) {
          ensureSpace(LINE_H);
          page.drawText(wl, { x: ML, y, size: BODY_SIZE, font, color: DARK });
          y -= LINE_H;
        }
        break;
      }

      case 'user-text': {
        // User-provided text with subtle background highlight
        const wrapped = wrapText(line.text, font, BODY_SIZE, CW - 30);
        const n = wrapped.length;
        const rectH = (n - 1) * LINE_H + 16;
        ensureSpace(rectH + 8);
        y -= 4; // gap before box

        // Background rectangle tightly wrapping text
        page.drawRectangle({
          x: ML + 16,
          y: y - (n - 1) * LINE_H - 6,
          width: CW - 20,
          height: rectH,
          color: USER_TEXT_BG,
          borderColor: SEPARATOR,
          borderWidth: 0.5,
        });

        for (const wl of wrapped) {
          page.drawText(wl, { x: ML + 22, y, size: BODY_SIZE, font, color: DARK });
          y -= LINE_H;
        }
        y -= 4;
        break;
      }

      case 'separator': {
        ensureSpace(10);
        y -= 4;
        page.drawLine({
          start: { x: ML, y },
          end: { x: PAGE_W - MR, y },
          thickness: 0.75,
          color: SEPARATOR,
        });
        y -= 6;
        break;
      }

      case 'signing-date': {
        ensureSpace(20);
        y -= 6;
        page.drawText(line.text, { x: ML, y, size: BODY_SIZE, font: italic, color: DARK });
        y -= LINE_H;
        break;
      }

      case 'signature-block': {
        const [left, right] = line.text.split('|');
        const sigWidth = 160;
        const sigLeftX = ML + 30;
        const sigRightX = PAGE_W - MR - sigWidth - 30;

        ensureSpace(70);
        y -= 20;

        // Dotted signature lines (approximated with dashes)
        const lineY = y;
        page.drawLine({
          start: { x: sigLeftX, y: lineY },
          end: { x: sigLeftX + sigWidth, y: lineY },
          thickness: 0.75,
          color: MEDIUM,
        });
        page.drawLine({
          start: { x: sigRightX, y: lineY },
          end: { x: sigRightX + sigWidth, y: lineY },
          thickness: 0.75,
          color: MEDIUM,
        });

        // Role labels centered under lines
        y -= 14;
        const leftLabelW = bold.widthOfTextAtSize(left, BODY_SIZE);
        const rightLabelW = bold.widthOfTextAtSize(right, BODY_SIZE);
        page.drawText(left, {
          x: sigLeftX + (sigWidth - leftLabelW) / 2,
          y,
          size: BODY_SIZE,
          font: bold,
          color: DARK,
        });
        page.drawText(right, {
          x: sigRightX + (sigWidth - rightLabelW) / 2,
          y,
          size: BODY_SIZE,
          font: bold,
          color: DARK,
        });

        y -= LINE_H;
        break;
      }

      case 'gap': {
        y -= GAP_H;
        if (y < MB) {
          drawFooter();
          page = newPage();
        }
        break;
      }
    }
  }

  // Final page footer
  drawFooter();

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}