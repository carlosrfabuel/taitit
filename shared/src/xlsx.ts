import { strToU8, zipSync } from 'fflate';

// Minimal .xlsx writer (Office Open XML spreadsheet): one sheet, a bold header row, column widths,
// text and numbers. Small on purpose, so the same code runs in the admin panel (browser) and in a
// Supabase function (Deno) for the order email. Opens in Excel, LibreOffice and Google Sheets.

export type Cell = string | number | null | undefined;

// Characters XML 1.0 doesn't allow (control characters other than tab / line breaks, lone surrogates
// can't occur in database text) are dropped; the rest is escaped.
const clean = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export const columnName = (index: number): string => {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

const cellXml = (value: Cell, ref: string, header: boolean) => {
  const style = header ? ' s="1"' : '';
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
  // Inline strings: no shared-string table to keep in sync. xml:space keeps leading spaces and line breaks.
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${clean(String(value))}</t></is></c>`;
};

/**
 * Builds an .xlsx file. The first row is the header (bold, frozen). Column widths fit the longest
 * value (capped), so the sheet is readable when opened.
 */
export function buildXlsx(rows: Cell[][], sheetName = 'Sheet1'): Uint8Array {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const widths = Array.from({ length: width }, (_, c) =>
    Math.min(60, Math.max(8, ...rows.map((r) => String(r[c] ?? '').split('\n')[0]!.length + 2))),
  );
  const sheetRows = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row.map((v, c) => cellXml(v, `${columnName(c)}${r + 1}`, r === 0)).join('')}</row>`,
    )
    .join('');
  // Excel limits sheet names to 31 characters, without : \ / ? * [ ]
  const name = clean(sheetName.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31)) || 'Sheet1';

  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>` +
      '</workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>',
    'xl/worksheets/sheet1.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      (width
        ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
        : '') +
      `<sheetData>${sheetRows}</sheetData>` +
      '</worksheet>',
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, xml]) => [path, strToU8(xml)])), {
    level: 6,
  });
}
