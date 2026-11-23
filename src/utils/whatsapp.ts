import { RepairOrder, Quote, Invoice, WorkshopSettings, OrderStatus } from '../types/workshop';

// Clean phone number for WhatsApp wa.me API
export function cleanPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return cleaned;
}

export function formatCurrency(amount: number, symbol: string = '$'): string {
  return `${symbol} ${amount.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function calculateOrderTotals(order: RepairOrder) {
  const partsSubtotal = order.parts.reduce((acc, part) => acc + (part.price * part.quantity), 0);
  const subtotal = partsSubtotal + (order.laborCost || 0);
  const discount = order.discount || 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * ((order.taxPercent || 0) / 100);
  const total = taxable + tax;
  const balanceDue = Math.max(0, total - (order.depositPaid || 0));

  return {
    partsSubtotal,
    subtotal,
    discount,
    tax,
    total,
    balanceDue
  };
}

export const STATUS_LABELS: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  recibido: { label: 'Recibido en Taller', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  diagnostico: { label: 'En Diagnóstico', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  espera_repuesto: { label: 'Espera de Repuestos', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/40' },
  en_reparacion: { label: 'En Reparación', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  control_calidad: { label: 'Pruebas / QA', color: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
  listo: { label: 'Listo para Entrega', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  entregado: { label: 'Entregado al Cliente', color: 'text-zinc-700 dark:text-zinc-300', bg: 'bg-zinc-200 dark:bg-zinc-800' },
  cancelado: { label: 'Cancelado / Sin Rep.', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40' },
};

export type WhatsAppMessageType =
  | 'remision_entrada'
  | 'actualizacion_estado'
  | 'incidente'
  | 'equipo_listo'
  | 'entrega_recibo'
  | 'cotizacion';

function formatBankDetails(settings?: WorkshopSettings): string {
  const shopName = settings?.name || 'Teknovant Labs';
  if (!settings?.bankName || !settings?.bankAccountNumber) return '';
  return `\n💳 *Cuenta para transferir / depositar:*
🏦 ${settings.bankName} (${settings.bankAccountType || 'Cuenta'})
🔢 *No:* ${settings.bankAccountNumber}
👤 *Titular:* ${settings.bankAccountHolder || shopName}${settings.bankPaymentNotes ? `\n📲 _${settings.bankPaymentNotes}_` : ''}\n`;
}

export function generateInvoiceWhatsAppMessage(
  invoice: Invoice,
  settings?: WorkshopSettings
): string {
  const shopName = settings?.name || 'Teknovant Labs';
  const currency = settings?.currency || '$';
  const bankDepositText = formatBankDetails(settings);

  const lines = invoice.items
    .map(it => `• ${it.quantity}x ${it.description}: *${formatCurrency(it.total, currency)}*`)
    .join('\n');

  return `🧾 *FACTURA / COMPROBANTE DE PAGO - ${shopName}*

Hola *${invoice.clientName}*, te compartimos el detalle de tu factura *${invoice.invoiceNumber}*${invoice.orderNumber ? ` (Orden ${invoice.orderNumber})` : ''}:
📅 *Fecha:* ${new Date(invoice.createdAt).toLocaleDateString()}
💳 *Estado:* ${invoice.paymentStatus.toUpperCase()} (${invoice.paymentMethod.toUpperCase()})

📋 *Conceptos:*
${lines}
${invoice.discount > 0 ? `\n🏷️ Descuento: -${formatCurrency(invoice.discount, currency)}` : ''}
💰 *TOTAL:* ${formatCurrency(invoice.total, currency)}

🛡️ *Garantía:* ${invoice.warrantyText}
${invoice.paymentStatus !== 'pagada' ? bankDepositText : ''}
¡Gracias por tu preferencia en *${shopName}*! 🚀`;
}

export function generateWhatsAppMessage(
  type: WhatsAppMessageType,
  order?: RepairOrder,
  quote?: Quote,
  settings?: WorkshopSettings,
  extraNote?: string
): string {
  const shopName = settings?.name || 'Teknovant Labs';
  const currency = settings?.currency || '$';
  const bankDepositText = formatBankDetails(settings);

  if (quote) {
    const itemsText = quote.items.length > 0
      ? `\n📦 *Conceptos cotizados:*\n${quote.items.map(i => `• ${i.quantity}x ${i.description}: ${formatCurrency(i.unitPrice * i.quantity, currency)}`).join('\n')}${quote.laborCost > 0 ? `\n• Mano de obra / Instalación: ${formatCurrency(quote.laborCost, currency)}` : ''}\n`
      : '';

    return `👋 *Hola ${quote.clientName}*, te saluda *${shopName}*.

📋 Adjuntamos tu cotización formal *${quote.quoteNumber}*:
📱 *Equipo / Servicio:* ${quote.deviceDescription}
🔧 *Detalle:* ${quote.issueDescription}
${itemsText}💰 *Total Cotizado:* ${formatCurrency(quote.total, currency)}
📅 *Vigencia:* Hasta el ${new Date(quote.validUntil).toLocaleDateString()}
${quote.notes ? `📝 *Notas:* ${quote.notes}\n` : ''}${bankDepositText}
Quedamos atentos a tu aprobación para iniciar el trabajo. ¡Gracias por confiar en nosotros! 🚀`;
  }

  if (!order) return '';

  const totals = calculateOrderTotals(order);
  const statusLabel = STATUS_LABELS[order.status].label;
  const priceNoteBlock = order.priceAdjustmentNote
    ? `\n⚠️ *Nota de ajuste de costo:* ${order.priceAdjustmentNote}\n`
    : '';

  switch (type) {
    case 'remision_entrada':
      return `👋 *¡Hola ${order.clientName}!* Te saluda *${shopName}*.

📥 Tu equipo ha sido recibido correctamente en nuestro taller:
🔖 *Orden de Entrada:* ${order.orderNumber}
📱 *Equipo:* ${order.brand} ${order.model}
🔍 *Falla reportada:* ${order.reportedFault}
💵 *Anticipo / Abono:* ${formatCurrency(order.depositPaid, currency)}
💰 *Total estimado:* ${formatCurrency(totals.total, currency)}
👨‍🔧 *Técnico asignado:* ${order.technicianAssigned}
${bankDepositText}
Te mantendremos al tanto del avance de tu reparación. ¡Muchas gracias por tu confianza! ⚙️`;

    case 'actualizacion_estado':
      return `🔔 *Actualización de Servicio Técnico* - *${shopName}*

Hola ${order.clientName}, tu orden *${order.orderNumber}* (${order.brand} ${order.model}) se encuentra en:
📊 *Estado actual:* ${statusLabel}
${extraNote ? `\n📝 *Nota técnica:* ${extraNote}\n` : ''}${priceNoteBlock}Cualquier duda o inquietud estamos a tu disposición por este medio. 👍`;

    case 'incidente':
      return `⚠️ *Notificación importante sobre tu equipo* - *${shopName}*

Estimado/a ${order.clientName}, te escribimos sobre tu orden *${order.orderNumber}* (${order.brand} ${order.model}):

🔍 *Novedad en laboratorio:*
${extraNote || order.priceAdjustmentNote || 'Durante la revisión técnica se detectó una situación que requiere tu autorización para proceder.'}
💰 *Nuevo total actualizado:* ${formatCurrency(totals.total, currency)} (Anticipo: ${formatCurrency(order.depositPaid, currency)} | Saldo: ${formatCurrency(totals.balanceDue, currency)})

Por favor responde a este mensaje para coordinar la autorización. ¡Gracias!`;

    case 'equipo_listo':
      return `🎉 *¡Tu equipo ya está LISTO!* - *${shopName}*

¡Excelentes noticias ${order.clientName}!
Tu equipo *${order.brand} ${order.model}* (Orden *${order.orderNumber}*) ha superado todas las pruebas de calidad y ya puede ser retirado.

💰 *Costo Total:* ${formatCurrency(totals.total, currency)}
💵 *Anticipo previo:* ${formatCurrency(order.depositPaid, currency)}
💳 *Saldo pendiente a pagar:* ${formatCurrency(totals.balanceDue, currency)}
🛡️ *Garantía:* ${order.warrantyDays} días
${priceNoteBlock}${totals.balanceDue > 0 ? bankDepositText : ''}
📍 *Dirección de retiro:*
${settings?.address || 'Visítanos en nuestro taller'}

¡Te esperamos! 🛠️`;

    case 'entrega_recibo':
      return `✅ *Comprobante de Entrega y Garantía* - *${shopName}*

Hola ${order.clientName}, confirmamos la entrega satisfactoria de tu *${order.brand} ${order.model}* (Orden *${order.orderNumber}*).

💵 *Total liquidado:* ${formatCurrency(totals.total, currency)}
🛡️ *Garantía de servicio:* ${order.warrantyDays} días a partir de hoy.

Ha sido un placer atenderte. ¡Guarda este contacto para futuras asesorías o servicios! ⭐⭐⭐⭐⭐`;

    default:
      return `Hola ${order.clientName}, te escribimos de ${shopName} sobre tu orden ${order.orderNumber}.`;
  }
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanPhoneNumber(phone);
  const encoded = encodeURIComponent(message);
  return cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
}

export function openWhatsApp(phone: string, message: string): void {
  const url = buildWhatsAppLink(phone, message);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
