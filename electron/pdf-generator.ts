import { PDFDocument, rgb, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { generateContractLines, ContractData } from './contract-templates';

const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;
const LINE_HEIGHT = 16;
const TITLE_SIZE = 16;
const BODY_SIZE = 10;
const HEADING_SIZE = 11;

/**
 * Load a system font that supports Hungarian characters.
 * Falls back through common fonts on Windows/Mac/Linux.
 */
function findSystemFont(): Buffer {
  const candidates = [
    // Windows
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'calibri.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'segoeui.ttf'),
    // macOS
    '/Library/Fonts/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    // Linux
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ];

  for (const fontPath of candidates) {
    try {
      if (fs.existsSync(fontPath)) {
        return fs.readFileSync(fontPath);
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    'Nem található megfelelő betűtípus a szerződés generálásához. ' +
    'Kérjük, telepítsen Arial vagy Calibri betűtípust a rendszerére. ' +
    'Windows: arial.ttf vagy calibri.ttf a C:\\Windows\\Fonts mappában.'
  );
}

function findBoldFont(): Buffer | null {
  const candidates = [
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'calibrib.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arialbd.ttf'),
    path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'segoeuib.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ];

  for (const fontPath of candidates) {
    try {
      if (fs.existsSync(fontPath)) {
        return fs.readFileSync(fontPath);
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** Wrap text to fit within maxWidth, returning lines */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      result.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);

      if (width > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result;
}

function isTitle(line: string): boolean {
  return /^[A-ZÁÉÍÓÖŐÚÜŰ\s()—–-]+$/.test(line.trim()) && line.trim().length > 2;
}

function isSectionHeading(line: string): boolean {
  return /^\d+\.\s+[A-ZÁÉÍÓÖŐÚÜŰ]/.test(line.trim());
}

export async function generateContractPdf(templateId: string, data: ContractData): Promise<Buffer> {
  const lines = generateContractLines(templateId, data);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = findSystemFont();
  const boldFontBytes = findBoldFont();

  const font = await pdfDoc.embedFont(fontBytes);
  const boldFont = boldFontBytes ? await pdfDoc.embedFont(boldFontBytes) : font;

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

  let page: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - MARGIN_TOP;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - MARGIN_TOP;
    }
  };

  for (const rawLine of lines) {
    if (rawLine === '') {
      y -= LINE_HEIGHT * 0.7;
      ensureSpace(LINE_HEIGHT);
      continue;
    }

    const lineIsTitle = isTitle(rawLine);
    const lineIsHeading = isSectionHeading(rawLine);

    const fontSize = lineIsTitle ? TITLE_SIZE : lineIsHeading ? HEADING_SIZE : BODY_SIZE;
    const lineFont = (lineIsTitle || lineIsHeading) ? boldFont : font;
    const color = rgb(0.08, 0.08, 0.12);

    const wrapped = wrapText(rawLine, lineFont, fontSize, contentWidth);

    for (const wl of wrapped) {
      ensureSpace(LINE_HEIGHT);

      const xOffset = lineIsTitle
        ? (contentWidth - lineFont.widthOfTextAtSize(wl, fontSize)) / 2 + MARGIN_LEFT
        : MARGIN_LEFT;

      page.drawText(wl, {
        x: xOffset,
        y,
        size: fontSize,
        font: lineFont,
        color,
      });

      y -= LINE_HEIGHT;
    }

    if (lineIsTitle) {
      y -= LINE_HEIGHT * 0.3;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
