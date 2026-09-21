import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export interface QuotePdfInput {
  reference: string; createdAt: string; statusLabel: string;
  buildingName: string; buildingAddress: string; residentName: string;
  provider: string; label: string; amountCents: number;
}

let fonts: Promise<[Buffer, Buffer]> | undefined;
export async function renderQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Lora.ttf')),
    readFile(join(process.cwd(), 'public/fonts/Poppins-Regular.ttf')),
  ]);
  const [headingBytes, bodyBytes] = await fonts;
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const heading = await document.embedFont(headingBytes, { subset: true });
  const body = await document.embedFont(bodyBytes, { subset: true });
  document.setTitle(`Devis Maison Cavalier ${input.reference}`);
  document.setAuthor('Maison Cavalier'); document.setLanguage('fr-FR');
  const navy = rgb(10 / 255, 22 / 255, 40 / 255);
  const cream = rgb(245 / 255, 243 / 255, 238 / 255);
  const gold = rgb(184 / 255, 146 / 255, 42 / 255);
  let page: PDFPage;
  let y = 0;
  function newPage() {
    page = document.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: cream });
    page.drawText('MAISON CAVALIER', { x: 48, y: 784, font: heading, size: 23, color: navy });
    page.drawLine({ start: { x: 48, y: 762 }, end: { x: 547, y: 762 }, thickness: 1.4, color: gold });
    y = 725;
  }
  function paragraph(text: string, font: PDFFont = body, size = 11, after = 12) {
    const width = 499;
    const lineHeight = size * 1.65;
    function line(value: string) {
      if (y < 76 + lineHeight) newPage();
      page.drawText(value, { x: 48, y, font, size, color: navy }); y -= lineHeight;
    }
    for (const source of text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').split('\n')) {
      let current = '';
      for (const word of source.split(/\s+/u).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue; }
        if (current) { line(current); current = ''; }
        for (const character of word) {
          if (font.widthOfTextAtSize(current + character, size) > width) { line(current); current = ''; }
          current += character;
        }
      }
      line(current);
    }
    y -= after;
  }
  newPage();
  paragraph('Devis de prestation', heading, 26, 10);
  paragraph(`Référence : ${input.reference}\nCréé le ${new Date(input.createdAt).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}\nStatut : ${input.statusLabel}`);
  paragraph(`${input.buildingName}\n${input.buildingAddress}`, heading, 15);
  paragraph(`Destinataire : ${input.residentName}\nPrestataire : ${input.provider}`);
  paragraph('Prestation proposée', heading, 17, 8);
  paragraph(input.label);
  paragraph(`Montant total proposé : ${(input.amountCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`, heading, 18);
  paragraph('Ce devis récapitule la proposition du prestataire. Votre concierge reste votre interlocuteur pour toute précision.', body, 10);
  for (const [index, sheet] of document.getPages().entries()) {
    sheet.drawText(`Document confidentiel · Maison Cavalier · ${index + 1} / ${document.getPageCount()}`, { x: 48, y: 38, font: body, size: 9, color: navy });
  }
  return document.save();
}
