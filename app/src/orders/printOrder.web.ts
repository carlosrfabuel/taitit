import { orderSheet } from './orderSheet';
import type { Order } from './orders';

// Web: expo-print can only print the current page there, so the order sheet is loaded into a hidden
// frame and printed from it (the browser's dialog also saves it as a PDF). The app page stays as it is.

let frame: HTMLIFrameElement | null = null;

/** Opens the browser's print dialog (print or save as PDF) with the order. */
export async function printOrder(order: Order): Promise<void> {
  const html = await orderSheet(order);
  frame?.remove(); // the previous sheet, if its dialog was closed without an afterprint event
  const f = document.createElement('iframe');
  frame = f;
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  await new Promise<void>((resolve, reject) => {
    f.onload = () => resolve();
    f.onerror = () => reject(new Error('print_frame_failed'));
    f.srcdoc = html;
    document.body.appendChild(f);
  });
  const win = f.contentWindow;
  if (!win) throw new Error('print_frame_failed');
  win.addEventListener('afterprint', () => {
    if (frame === f) frame = null;
    f.remove();
  });
  win.focus();
  win.print();
}
