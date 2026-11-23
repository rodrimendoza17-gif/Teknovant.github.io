import React, { useState } from 'react';
import {
  X,
  Printer,
  Share2,
  Receipt,
  Copy,
  Check
} from 'lucide-react';
import { POSSale, WorkshopSettings, RepairOrder } from '../types/workshop';
import { openWhatsApp, calculateOrderTotals } from '../utils/whatsapp';

interface TicketPrintModalProps {
  sale?: POSSale;
  order?: RepairOrder;
  settings: WorkshopSettings;
  onClose: () => void;
}

export const TicketPrintModal: React.FC<TicketPrintModalProps> = ({
  sale,
  order,
  settings,
  onClose
}) => {
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [copied, setCopied] = useState(false);
  const currency = settings.currency || '$';

  const ticketTerms =
    settings.ticketTerms ||
    'Garantía en mercancía y accesorios: 30 días calendario por defectos de fábrica. No aplica por quiebre, humedad o sobrevoltaje.';
  const ticketFooterNote =
    settings.ticketFooterNote ||
    `¡Gracias por su compra en ${settings.name}!`;

  const handlePrint = () => {
    if (paperWidth === '58mm') {
      document.body.classList.add('ticket-58mm');
    } else {
      document.body.classList.remove('ticket-58mm');
    }
    window.print();
    setTimeout(() => {
      document.body.classList.remove('ticket-58mm');
    }, 1000);
  };

  const generateTicketWhatsAppText = (): string => {
    if (sale) {
      let text = `🧾 *COMPROBANTE DE COMPRA - ${settings.name.toUpperCase()}*\n`;
      text += `📍 ${settings.address} - ${settings.city}\n`;
      text += `📞 Tel/WhatsApp: ${settings.phone}\n`;
      text += `🆔 ${settings.nitRfc}\n`;
      text += `--------------------------------\n`;
      text += `*Ticket:* #${sale.saleNumber}\n`;
      text += `*Fecha:* ${new Date(sale.createdAt).toLocaleString()}\n`;
      text += `*Cliente:* ${sale.clientName}\n`;
      text += `*Atendido por:* ${sale.cashierName}\n`;
      text += `--------------------------------\n`;
      text += `*PRODUCTOS Y MERCANCÍA:*\n`;
      sale.items.forEach((item) => {
        text += `• ${item.quantity}x ${item.name} ($${item.unitPrice.toLocaleString()}) = *$${item.subtotal.toLocaleString()}*\n`;
      });
      text += `--------------------------------\n`;
      text += `Subtotal: $${sale.subtotal.toLocaleString()}\n`;
      if (sale.discount > 0) {
        text += `Descuento: -$${sale.discount.toLocaleString()}\n`;
      }
      text += `*TOTAL PAGADO: $${sale.total.toLocaleString()} ${currency}*\n`;
      text += `*Método de Pago:* ${sale.paymentMethod.toUpperCase()}\n`;
      if (sale.changeGiven > 0) {
        text += `Recibido: $${sale.amountPaid.toLocaleString()} | Cambio: $${sale.changeGiven.toLocaleString()}\n`;
      }
      text += `--------------------------------\n`;
      text += `*TÉRMINOS Y CONDICIONES:*\n${ticketTerms}\n`;
      text += `${ticketFooterNote}`;
      return text;
    } else if (order) {
      const totals = calculateOrderTotals(order);
      let text = `🧾 *TICKET DE TALLER - ${settings.name.toUpperCase()}*\n`;
      text += `*Orden:* #${order.orderNumber}\n`;
      text += `*Cliente:* ${order.clientName}\n`;
      text += `*Equipo:* ${order.brand} ${order.model} (${order.deviceType})\n`;
      text += `*Estado:* ${order.status.toUpperCase()}\n`;
      text += `*Total Servicio:* $${totals.total.toLocaleString()} ${currency}\n`;
      text += `*Abono / Anticipo:* $${order.depositPaid.toLocaleString()} ${currency}\n`;
      text += `*Saldo Pendiente:* $${totals.balanceDue.toLocaleString()} ${currency}\n`;
      text += `--------------------------------\n`;
      text += `*TÉRMINOS:*\n${ticketTerms}\n`;
      text += `${ticketFooterNote}`;
      return text;
    }
    return '';
  };

  const handleShareWhatsApp = () => {
    const text = generateTicketWhatsAppText();
    const phone = sale?.clientPhone || order?.clientPhone || '';
    openWhatsApp(phone, text);
  };

  const handleCopyText = () => {
    const text = generateTicketWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = sale
    ? new Date(sale.createdAt).toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    : order
    ? new Date(order.createdAt).toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    : '';

  const orderTotals = order ? calculateOrderTotals(order) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:bg-white print:p-0">
      <div className="relative w-full max-w-xl bg-[#090e1d] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,242,254,0.2)] overflow-hidden my-auto flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white">

        {/* Top Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-500/20 bg-[#0b132b]/80 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Ticket Térmico POS
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {paperWidth}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Formato estándar con logotipo y términos editables (58mm / 80mm)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper width selector */}
            <div className="flex items-center bg-[#070b14] p-1 rounded-xl border border-cyan-500/20 text-xs font-mono">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  paperWidth === '80mm'
                    ? 'bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-400/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                80 mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  paperWidth === '58mm'
                    ? 'bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-400/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                58 mm
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action quick buttons */}
        <div className="px-5 py-3 bg-[#060a16] border-b border-cyan-500/10 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="text-xs text-zinc-400 font-mono">
            Listo para impresora térmica USB / Red
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition"
              title="Copiar texto del ticket"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-[0_0_15px_rgba(0,242,254,0.4)] transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Ticket</span>
            </button>
          </div>
        </div>

        {/* Ticket Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#040711] flex justify-center items-start print:bg-white print:p-0">
          <div
            id="printable-ticket"
            className={`thermal-ticket-container bg-white text-zinc-950 font-mono text-[11px] leading-tight shadow-2xl relative select-text transition-all duration-300 print:shadow-none ${
              paperWidth === '80mm' ? 'w-[320px] max-w-full p-5' : 'w-[250px] max-w-full p-3 text-[10px]'
            }`}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.6))'
            }}
          >
            {/* Serrated paper top edge styling */}
            <div className="absolute -top-1 left-0 right-0 h-2 bg-repeat-x bg-[length:8px_4px] bg-[radial-gradient(circle,transparent_2px,#fff_2px)] print:hidden" />

            {/* Header info + Workshop Logo */}
            <div className="text-center pb-3 border-b border-dashed border-zinc-400">
              {settings.logoUrl && (
                <div className="flex justify-center mb-2">
                  <img
                    src={settings.logoUrl}
                    alt={settings.name}
                    className={`${
                      paperWidth === '80mm' ? 'max-h-14 max-w-[160px]' : 'max-h-11 max-w-[120px]'
                    } object-contain grayscale contrast-125`}
                  />
                </div>
              )}
              <h1 className="text-base font-black tracking-wider uppercase">
                {settings.name}
              </h1>
              <p className="text-[10px] text-zinc-600 font-sans font-medium uppercase mt-0.5">
                {settings.slogan}
              </p>
              <p className="text-[10px] font-bold mt-1 text-zinc-800">
                {settings.nitRfc}
              </p>
              <p className="text-[10px] text-zinc-700">
                {settings.address}
              </p>
              <p className="text-[10px] text-zinc-700">
                {settings.city} • Tel: {settings.phone}
              </p>
            </div>

            {/* Ticket Metadata */}
            <div className="py-2.5 border-b border-dashed border-zinc-400 text-[10px] space-y-1">
              <div className="flex justify-between font-bold">
                <span>TICKET {sale ? 'POS' : 'TALLER'}:</span>
                <span>#{sale?.saleNumber || order?.orderNumber || '000'}</span>
              </div>
              <div className="flex justify-between text-zinc-700">
                <span>FECHA:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between text-zinc-700">
                <span>CAJERO / LAB:</span>
                <span className="truncate max-w-[170px] text-right font-medium">
                  {sale?.cashierName || order?.technicianAssigned || 'Teknovant Labs'}
                </span>
              </div>
              <div className="flex justify-between text-zinc-800 font-semibold border-t border-dotted border-zinc-300 pt-1 mt-1">
                <span>CLIENTE:</span>
                <span className="truncate max-w-[170px] text-right">
                  {sale?.clientName || order?.clientName || 'Cliente Mostrador'}
                </span>
              </div>
              {(sale?.clientDocId || order?.clientDocId) && (
                <div className="flex justify-between text-zinc-600">
                  <span>ID / CC:</span>
                  <span>{sale?.clientDocId || order?.clientDocId}</span>
                </div>
              )}
              {(sale?.clientPhone || order?.clientPhone) && (
                <div className="flex justify-between text-zinc-600">
                  <span>TELÉFONO:</span>
                  <span>{sale?.clientPhone || order?.clientPhone}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2.5 border-b border-dashed border-zinc-400">
              <div className="flex justify-between font-bold text-[9px] uppercase pb-1.5 border-b border-zinc-300 text-zinc-700">
                <span className="w-7">CANT</span>
                <span className="flex-1 px-1">DESCRIPCIÓN</span>
                <span className="w-14 text-right">TOTAL</span>
              </div>

              {sale && sale.items && sale.items.map((item, idx) => (
                <div key={idx} className="py-1 text-[10px] border-b border-dotted border-zinc-200 last:border-none">
                  <div className="flex justify-between items-start">
                    <span className="w-7 font-bold">{item.quantity}x</span>
                    <span className="flex-1 px-1 font-sans font-semibold leading-tight text-zinc-900">
                      {item.name}
                      {item.sku && (
                        <span className="block text-[8px] font-mono text-zinc-500">
                          SKU: {item.sku}
                        </span>
                      )}
                    </span>
                    <span className="w-16 text-right font-bold">
                      ${item.subtotal.toLocaleString()}
                    </span>
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-[8px] text-zinc-500 text-right pr-1 font-mono">
                      @ ${item.unitPrice.toLocaleString()} c/u
                    </div>
                  )}
                </div>
              ))}

              {order && (
                <div className="space-y-1 py-1 text-[10px]">
                  <div className="text-[9px] font-bold text-zinc-600 uppercase pb-1">
                    {order.brand} {order.model} • {order.serialOrImei}
                  </div>
                  <div className="flex justify-between items-start font-bold">
                    <span className="w-7">1x</span>
                    <span className="flex-1 px-1 font-sans">
                      Servicio Técnico / Mano de Obra
                    </span>
                    <span className="w-16 text-right">${order.laborCost.toLocaleString()}</span>
                  </div>
                  {order.parts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-start text-zinc-800">
                      <span className="w-7">{p.quantity}x</span>
                      <span className="flex-1 px-1 font-sans">{p.name}</span>
                      <span className="w-16 text-right">${(p.price * p.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calculations & Totals */}
            <div className="py-2.5 border-b border-dashed border-zinc-400 space-y-1 text-[11px]">
              {sale && (
                <>
                  <div className="flex justify-between text-zinc-700">
                    <span>SUBTOTAL:</span>
                    <span>${sale.subtotal.toLocaleString()} {currency}</span>
                  </div>
                  {sale.discount > 0 && (
                    <div className="flex justify-between text-zinc-700">
                      <span>DESCUENTO:</span>
                      <span>-${sale.discount.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  {sale.tax > 0 && (
                    <div className="flex justify-between text-zinc-700">
                      <span>IMPUESTOS:</span>
                      <span>${sale.tax.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-950 mt-1">
                    <span>TOTAL PAGADO:</span>
                    <span>${sale.total.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-700 pt-1">
                    <span>FORMA DE PAGO:</span>
                    <span className="font-bold uppercase">{sale.paymentMethod}</span>
                  </div>
                  {sale.amountPaid > 0 && (
                    <div className="flex justify-between text-[10px] text-zinc-700">
                      <span>MONTO RECIBIDO:</span>
                      <span>${sale.amountPaid.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  {sale.changeGiven > 0 && (
                    <div className="flex justify-between text-[10px] font-bold text-zinc-950">
                      <span>CAMBIO / DEVUELTA:</span>
                      <span>${sale.changeGiven.toLocaleString()} {currency}</span>
                    </div>
                  )}
                </>
              )}

              {order && orderTotals && (
                <>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-zinc-700">
                      <span>DESCUENTO:</span>
                      <span>-${order.discount.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-950">
                    <span>TOTAL SERVICIO:</span>
                    <span>${orderTotals.total.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-700">
                    <span>ANTICIPO / ABONO:</span>
                    <span>${order.depositPaid.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-zinc-950">
                    <span>SALDO PENDIENTE:</span>
                    <span>${orderTotals.balanceDue.toLocaleString()} {currency}</span>
                  </div>
                </>
              )}
            </div>

            {/* Bank Info snippet when configured */}
            {settings.bankName && settings.bankAccountNumber && (
              <div className="py-2 border-b border-dashed border-zinc-400 text-[9px] text-center text-zinc-700 space-y-0.5">
                <div className="font-bold text-zinc-900 uppercase">DATOS PARA DEPÓSITO / TRANSF.</div>
                <div>{settings.bankName} • {settings.bankAccountNumber}</div>
                {settings.bankAccountHolder && <div>Titular: {settings.bankAccountHolder}</div>}
              </div>
            )}

            {/* Barcode representation */}
            <div className="py-3 text-center border-b border-dashed border-zinc-400">
              <div className="inline-block py-1 tracking-[4px] font-mono text-2xl font-black scale-y-125 select-none">
                ||| | |||| | ||| || |||
              </div>
              <div className="text-[9px] font-mono text-zinc-600 mt-1">
                *{sale?.saleNumber || order?.orderNumber || 'TEKNOVANT'}*
              </div>
            </div>

            {/* Editable Terms & Footer Policies */}
            <div className="pt-2 text-center text-[9px] text-zinc-600 space-y-1 leading-tight">
              <p className="font-bold text-zinc-900 uppercase">
                TÉRMINOS Y CONDICIONES
              </p>
              <p className="whitespace-pre-line">
                {ticketTerms}
              </p>
              <p className="pt-1 font-bold text-zinc-800">
                {ticketFooterNote}
              </p>
              <p className="text-[8px] text-zinc-500">
                {settings.name} • {new Date().getFullYear()}
              </p>
            </div>

            {/* Serrated paper bottom edge */}
            <div className="absolute -bottom-1 left-0 right-0 h-2 bg-repeat-x bg-[length:8px_4px] bg-[radial-gradient(circle,transparent_2px,#fff_2px)] print:hidden" />
          </div>
        </div>

        {/* Footer info (print hidden) */}
        <div className="px-5 py-3 bg-[#0b132b] border-t border-cyan-500/20 flex items-center justify-between print:hidden text-xs text-zinc-400">
          <span>Configura márgenes en "Ninguno" al imprimir en rollo térmico.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
