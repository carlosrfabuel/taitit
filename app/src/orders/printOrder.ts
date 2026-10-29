import * as Print from 'expo-print';
import { orderSheet } from './orderSheet';
import type { Order } from './orders';

// Phones: the order sheet in the system print dialog (which also saves it as a PDF). Web: printOrder.web.ts.

/** Opens the phone's print dialog (print or save as PDF) with the order. */
export async function printOrder(order: Order): Promise<void> {
  await Print.printAsync({ html: await orderSheet(order) });
}
