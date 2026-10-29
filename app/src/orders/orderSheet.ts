import { FINISH_LABEL, MATERIAL_LABEL } from '@taitit/shared';
import { formSummary } from './frameForm';
import { formatOrderDate, type Order } from './orders';

// The order as a printable A4 sheet (Carlos, 2026-10-27: printing replaces sending by WhatsApp), shared
// by the phone (printOrder.ts) and the web (printOrder.web.ts). The frame images are private links that
// expire, so they are embedded in the sheet: the printer never has to load anything.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A frame image as a data URI (null when it can't be loaded: the sheet then says so). */
async function embedded(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** The sheet with every frame image embedded. */
export async function orderSheet(order: Order): Promise<string> {
  const images = await Promise.all(order.frames.map((f) => embedded(f.imageUrl)));
  return orderSheetHtml(order, images);
}

export function orderSheetHtml(order: Order, images: (string | null)[]): string {
  const b = order.business;
  const several = order.frames.length > 1;
  const row = (label: string, value: string | null) =>
    value ? `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>` : '';
  const frames = order.frames
    .map((f, i) => {
      const image = images[i];
      const form = formSummary(f.form);
      return `<section class="frame">
  <h2>${several ? `${f.lineNo}. ` : ''}${esc(f.modelName)} · ${f.quantity} ${f.quantity === 1 ? 'frame' : 'frames'}</h2>
  ${image ? `<img src="${image}" alt="">` : '<p class="muted">Image not available.</p>'}
  <table class="parts">
    <tr><th>Part</th><th>Material</th><th>Color</th><th>Finish</th></tr>
    ${f.items
      .map(
        (p) =>
          `<tr><td>${esc(p.zoneName)}</td><td>${esc(MATERIAL_LABEL[p.material])}</td><td><span class="dot" style="background:${esc(p.hex)}"></span>${esc(p.ref)}</td><td>${p.finish ? esc(FINISH_LABEL[p.finish]) : '—'}</td></tr>`,
      )
      .join('')}
  </table>
  ${form.length ? `<h3>Customizing form</h3><ul>${form.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
</section>`;
    })
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TAITIT order #${order.number}</title>
<style>
  @page { size: A4; margin: 14mm; }
  /* Always a white sheet, also when the phone is in dark mode. */
  :root { color-scheme: light; }
  html, body { background: #fff; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; font-size: 11pt; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #111; padding-bottom: 6pt; }
  .brand { font-size: 20pt; letter-spacing: 6pt; font-weight: 700; }
  h1 { font-size: 16pt; margin: 12pt 0 2pt; }
  h2 { font-size: 13pt; margin: 0 0 6pt; }
  h3 { font-size: 10pt; text-transform: uppercase; letter-spacing: 1pt; color: #555; margin: 10pt 0 4pt; }
  .muted { color: #666; }
  table { border-collapse: collapse; width: 100%; }
  .info th { text-align: left; font-weight: 600; color: #555; width: 38%; padding: 2pt 8pt 2pt 0; vertical-align: top; }
  .info td { padding: 2pt 0; }
  .frame { border: 1px solid #ccc; border-radius: 6pt; padding: 10pt; margin-top: 10pt; break-inside: avoid; }
  .frame img { display: block; width: 100%; max-height: 70mm; object-fit: contain; margin-bottom: 8pt; }
  .parts th, .parts td { text-align: left; border-bottom: 1px solid #e5e5e5; padding: 4pt 6pt 4pt 0; }
  .parts th { font-size: 9pt; text-transform: uppercase; color: #555; }
  .dot { display: inline-block; width: 9pt; height: 9pt; border-radius: 50%; border: 1px solid #999; margin-right: 5pt; vertical-align: -1pt; }
  ul { margin: 0; padding-left: 14pt; }
  .notes { white-space: pre-wrap; border: 1px solid #ccc; border-radius: 6pt; padding: 8pt; }
</style></head><body>
<header><span class="brand">TAITIT</span><span class="muted">Tailored handcrafted eyewear</span></header>
<h1>Order #${order.number}</h1>
<p class="muted">Sent ${esc(formatOrderDate(order.createdAt))} · ${several ? `${order.frames.length} different frames, ` : ''}${order.quantity} ${order.quantity === 1 ? 'frame' : 'frames'}</p>
<h3>Optician</h3>
<table class="info">
  ${row('Business', b.name)}${row('Tax ID', b.taxId)}${row('Phone', b.phone)}${row('Address', b.address)}${row('Delivery', b.delivery)}${row('Name on the glasses (optician)', b.labeling)}${row('Reference', order.shopRef)}
</table>
${frames}
<h3>Order notes</h3>
<div class="notes">${order.notes ? esc(order.notes) : '<span class="muted">No notes.</span>'}</div>
</body></html>`;
}
