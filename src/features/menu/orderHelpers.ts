import { supabase } from "../../lib/supabase";
import { money } from "../../lib/format";
import type { Product } from "../../types";
import type { PaymentSettings } from "../../services/payments";
export const ORDER_PHONE = "59171661241";
export type OrderLine = { product: Product; quantity: number };
export const orderTotal = (lines: OrderLine[]) =>
  lines.reduce(
    (sum, line) =>
      sum + Math.round(Number(line.product.price) * 100) * line.quantity,
    0,
  ) / 100;
export async function getPublicPayment(): Promise<PaymentSettings | null> {
  const { data, error } = await supabase.rpc("public_payment_qr");
  if (error && import.meta.env.DEV) {
    const response = await fetch("/api/local-public-payment");
    if (!response.ok)
      throw new Error(
        "No se pudo cargar el QR. Inténtalo nuevamente o solicítalo al negocio por WhatsApp.",
      );
    return response.json();
  }
  if (error)
    throw new Error(
      "No se pudo cargar el QR. Inténtalo nuevamente o solicítalo al negocio por WhatsApp.",
    );
  return data;
}
export function orderWhatsAppUrl(
  lines: OrderLine[],
  name: string,
  note: string,
  useWeb = false,
) {
  const text = [
    "*AÇAÍ TROPICAL*",
    "PEDIDO POR WHATSAPP",
    "",
    "¡Hola, Açaí Tropical! \u{1F44B}\nQuiero realizar el siguiente pedido:",
    "",
    name.trim() ? `\u{1F464} *Cliente:* ${name.trim()}` : "",
    "",
    "\u{1F4CB} *DETALLE DEL PEDIDO*",
    "",
    ...lines.map(
      ({ product, quantity }, index) =>
        `${index + 1}. *${product.name}*\nCantidad: ${quantity} | Precio: ${money(product.price)} c/u\nSubtotal: ${money((Math.round(Number(product.price) * 100) * quantity) / 100)}\n`,
    ),
    "",
    `\u{1F4B0} *TOTAL A PAGAR: ${money(orderTotal(lines))}*`,
    "",
    note.trim() ? `*OBSERVACIONES*\n${note.trim()}` : "",
    "",
    "\u{1F4CD} *ENTREGA O RECOJO*",
    "Coordinaremos la entrega o el recojo por WhatsApp. Cualquier costo de envío se acuerda por este chat y no está incluido en el total.",
    "",
    "\u{1F9FE} *COMPROBANTE DE PAGO*",
    "Adjunta el comprobante del pago por QR en este chat para validar tu solicitud. El negocio verificará el pago y confirmará el pedido.",
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const encoded = encodeURIComponent(text);
  return useWeb
    ? `https://web.whatsapp.com/send?phone=${ORDER_PHONE}&text=${encoded}`
    : `https://wa.me/${ORDER_PHONE}?text=${encoded}`;
}
