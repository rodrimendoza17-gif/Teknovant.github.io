import React, { useState } from 'react';
import {
  X,
  Printer,
  Share2,
  FileText,
  ShieldCheck,
  CheckCircle,
  Smartphone,
  Calendar,
  User,
  Wrench,
  Receipt,
  Layers,
  Landmark,
  CreditCard
} from 'lucide-react';
import { RepairOrder, Quote, Invoice, WorkshopSettings } from '../types/workshop';
import { calculateOrderTotals, formatCurrency, openWhatsApp, generateWhatsAppMessage } from '../utils/whatsapp';

export type DocumentType = 'remision_entrada' | 'recibo_entrega' | 'factura' | 'cotizacion';

interface DocumentPrintModalProps {
  type: DocumentType;
  order?: RepairOrder;
  quote?: Quote;
  invoice?: Invoice;
  settings: WorkshopSettings;
  onClose: () => void;
}

export const DocumentPrintModal: React.FC<DocumentPrintModalProps> = ({
  type,
  order,
  quote,
  invoice,
  settings,
  onClose
}) => {
  const [printFormat, setPrintFormat] = useState<'a4' | 'ticket'>('a4');
  const currency = settings.currency || '$';

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (type === 'cotizacion' && quote) {
      const msg = generateWhatsAppMessage('cotizacion', undefined, quote, settings);
      openWhatsApp(quote.clientPhone, msg);
    } else if (type === 'remision_entrada' && order) {
      const msg = generateWhatsAppMessage('remision_entrada', order, undefined, settings);
      openWhatsApp(order.clientPhone, msg);
    } else if (type === 'recibo_entrega' && order) {
      const msg = generateWhatsAppMessage('entrega_recibo', order, undefined, settings);
      openWhatsApp(order.clientPhone, msg);
    } else if (order) {
      const msg = generateWhatsAppMessage('actualizacion_estado', order, undefined, settings);
      openWhatsApp(order.clientPhone, msg);
    }
  };

  // Determine title and subtitle
  let docTitle = 'Remisión de Entrada & Orden de Servicio';
  let docBadge = 'REMISIÓN DE ENTRADA';
  let docNumber = order?.orderNumber || 'ORD-000';
  let docDate = order ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

  if (type === 'recibo_entrega') {
    docTitle = 'Comprobante de Entrega & Garantía';
    docBadge = 'COMPROBANTE DE ENTREGA';
    docDate = order?.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : new Date().toLocaleDateString();
  } else if (type === 'cotizacion') {
    docTitle = 'Cotización Técnica de Laboratorio';
    docBadge = 'COTIZACIÓN FORMAL';
    docNumber = quote?.quoteNumber || 'COT-000';
    docDate = quote ? new Date(quote.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  } else if (type === 'factura') {
    docTitle = 'Factura de Venta / Servicio';
    docBadge = 'FACTURA DE SERVICIO';
    docNumber = invoice?.invoiceNumber || 'FAC-000';
    docDate = invoice ? new Date(invoice.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  }

  const totals = order ? calculateOrderTotals(order) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
        
        {/* Modal Toolbar (hidden when printing) */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-t-xl print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-900 dark:text-white text-sm">{docTitle}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded">
                  1 Hoja Breve
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">Folio: <span className="font-mono font-medium">{docNumber}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle: Letter vs 80mm receipt */}
            <div className="hidden sm:flex items-center bg-zinc-200 dark:bg-zinc-800 rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setPrintFormat('a4')}
                className={`px-2.5 py-1 rounded-md transition ${printFormat === 'a4' ? 'bg-white dark:bg-zinc-750 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400'}`}
              >
                Hoja Carta / A4 (1 Hoja)
              </button>
              <button
                onClick={() => setPrintFormat('ticket')}
                className={`px-2.5 py-1 rounded-md transition ${printFormat === 'ticket' ? 'bg-white dark:bg-zinc-750 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400'}`}
              >
                Ticket 80mm
              </button>
            </div>

            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-xs"
              title="Compartir por WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Guardar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-zinc-100 dark:bg-zinc-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          {/* Printable Sheet: strictly bounded for clean single-page letter/A4 printing */}
          <div
            id="printable-document"
            className={`bg-white text-zinc-900 shadow-lg border border-zinc-200 print:border-none print:shadow-none transition-all ${
              printFormat === 'ticket'
                ? 'w-full max-w-[380px] p-4 text-xs font-mono'
                : 'w-full max-w-3xl p-5 sm:p-6 print:p-2 text-xs leading-normal'
            }`}
          >
            {/* Header: Shop branding & document summary */}
            <div className="flex flex-row justify-between items-start gap-3 border-b-2 border-zinc-900 pb-2.5">
              <div className="flex items-center gap-2.5">
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.name}
                    className="w-11 h-11 object-contain rounded-md border border-zinc-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold shadow-xs shrink-0">
                    <Wrench className="w-5 h-5 text-cyan-400" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-mono font-black text-base text-zinc-900 tracking-tight leading-none">
                      {settings.name}
                    </h1>
                    <span className="text-[8.5px] font-mono font-bold px-1 py-0.2 bg-zinc-900 text-cyan-300 rounded uppercase">
                      TEKNOVANT
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-600 font-medium leading-tight">{settings.slogan}</p>
                  <p className="text-[9.5px] text-zinc-500 leading-tight">
                    <span className="font-mono font-medium">{settings.nitRfc}</span> • Tel/WA: <span className="font-mono">{settings.phone}</span>
                  </p>
                  <p className="text-[9px] text-zinc-500 leading-tight">
                    {settings.address} — {settings.city}
                  </p>
                </div>
              </div>

              <div className="text-right bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg shrink-0">
                <span className="inline-block px-1.5 py-0.5 bg-blue-900 text-white text-[9.5px] font-bold tracking-wider rounded uppercase">
                  {docBadge}
                </span>
                <div className="text-base font-mono font-black text-blue-950 leading-tight mt-0.5">
                  {docNumber}
                </div>
                <div className="text-[9.5px] text-zinc-600 mt-0.5">
                  <strong>Emisión:</strong> {docDate}
                </div>
                {order?.estimatedDeliveryDate && type === 'remision_entrada' && (
                  <div className="text-[9.5px] text-zinc-600">
                    <strong>Entrega est:</strong> {new Date(order.estimatedDeliveryDate).toLocaleDateString()}
                  </div>
                )}
                {type === 'recibo_entrega' && (
                  <div className="text-[9.5px] text-emerald-800 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 mt-0.5">
                    Garantía: {order?.warrantyDays || settings.defaultWarrantyDays || 60} días
                  </div>
                )}
              </div>
            </div>

            {/* Document Content based on Type */}
            {type === 'cotizacion' && quote ? (
              /* Quotation View */
              <div className="mt-2.5 space-y-2.5">
                {/* Client info */}
                <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-2 rounded border border-zinc-200 text-[10.5px]">
                  <div>
                    <span className="text-zinc-500 block text-[9.5px]">Cliente:</span>
                    <strong className="text-zinc-900 text-xs">{quote.clientName}</strong>
                    <span className="block text-zinc-600">Tel: {quote.clientPhone}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9.5px]">Equipo / Vigencia:</span>
                    <strong className="text-zinc-900">{quote.deviceDescription}</strong>
                    <span className="block text-zinc-600">Vigencia hasta: {new Date(quote.validUntil).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="p-2 bg-zinc-50 rounded border border-zinc-200 text-[10px]">
                  <strong className="text-zinc-700 block uppercase tracking-wider text-[9px] mb-0.5">Diagnóstico y Falla Reportada:</strong>
                  <p className="text-zinc-800 italic leading-snug">"{quote.issueDescription}"</p>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-[10px] border border-zinc-200">
                  <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-200 uppercase text-[9px]">
                    <tr>
                      <th className="py-1 px-2">Concepto / Repuesto</th>
                      <th className="py-1 px-2 text-center w-12">Cant.</th>
                      <th className="py-1 px-2 text-right w-20">Unit.</th>
                      <th className="py-1 px-2 text-right w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {quote.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 px-2 font-medium">{item.description}</td>
                        <td className="py-1 px-2 text-center">{item.quantity}</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(item.unitPrice, currency)}</td>
                        <td className="py-1 px-2 text-right font-semibold">{formatCurrency(item.unitPrice * item.quantity, currency)}</td>
                      </tr>
                    ))}
                    {quote.laborCost > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-medium">Mano de obra técnica especializada</td>
                        <td className="py-1 px-2 text-center">1</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(quote.laborCost, currency)}</td>
                        <td className="py-1 px-2 text-right font-semibold">{formatCurrency(quote.laborCost, currency)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Side-by-side Bank & Payment Methods + Totals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] items-stretch">
                  {/* Bank & payment methods box */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded p-2 text-zinc-800 space-y-1">
                    <div className="font-bold text-blue-900 flex items-center gap-1 text-[10px] uppercase">
                      <Landmark className="w-3.5 h-3.5 text-blue-700" />
                      Medios de Pago, Depósito y Transferencia
                    </div>
                    <div className="flex flex-wrap gap-1 text-[8.5px] font-bold">
                      {settings.acceptedPaymentMethods?.depositoBancario !== false && (
                        <span className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-900">Depósito Bancario</span>
                      )}
                      {settings.acceptedPaymentMethods?.transferencia !== false && (
                        <span className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-900">Transferencia</span>
                      )}
                      {settings.acceptedPaymentMethods?.tarjeta !== false && (
                        <span className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-900">Tarjeta Débito/Crédito</span>
                      )}
                      {settings.acceptedPaymentMethods?.efectivo !== false && (
                        <span className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-900">Efectivo</span>
                      )}
                    </div>
                    <p className="text-[10px]">
                      <strong>Banco:</strong> {settings.bankName || 'Bancolombia'} ({settings.bankAccountType || 'Ahorros'})
                    </p>
                    <p className="text-[10.5px] font-mono font-bold text-zinc-900">
                      <strong>No:</strong> {settings.bankAccountNumber || '458-921478-33'}
                    </p>
                    <p className="text-[9.5px] text-zinc-600">
                      <strong>Titular:</strong> {settings.bankAccountHolder || settings.name}
                    </p>
                    {settings.bankPaymentNotes && (
                      <p className="text-[9px] text-blue-800 italic">
                        {settings.bankPaymentNotes}
                      </p>
                    )}
                    {settings.acceptedPaymentMethods?.tarjeta !== false && settings.cardPaymentNotes && (
                      <p className="text-[9px] text-zinc-700">
                        <CreditCard className="w-3 h-3 inline mr-1 text-blue-700" />
                        {settings.cardPaymentNotes}
                      </p>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded p-2 text-[10px] space-y-1">
                    {quote.discount > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Descuento aplicado:</span>
                        <span>-{formatCurrency(quote.discount, currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-xs border-t border-zinc-900 pt-1 text-blue-950">
                      <span>Total Cotizado:</span>
                      <span>{formatCurrency(quote.total, currency)}</span>
                    </div>
                    {quote.notes && (
                      <div className="text-[9px] text-zinc-600 pt-1 italic">
                        <strong>Nota:</strong> {quote.notes}
                      </div>
                    )}
                  </div>
                </div>

                {settings.invoiceTerms && (
                  <div className="text-[8.5px] text-zinc-600 bg-zinc-50 px-2 py-1.5 rounded border border-zinc-200 leading-snug whitespace-pre-line">
                    <strong className="block text-zinc-800 text-[9px] font-bold uppercase mb-0.5">Condiciones de Cotización:</strong>
                    {settings.invoiceTerms}
                  </div>
                )}
              </div>
            ) : type === 'factura' && invoice ? (
              /* Invoice View */
              <div className="mt-2.5 space-y-2.5">
                <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-2 rounded border border-zinc-200 text-[10.5px]">
                  <div>
                    <span className="text-zinc-500 block text-[9.5px]">Facturado a:</span>
                    <strong className="text-zinc-900 text-xs">{invoice.clientName}</strong>
                    {invoice.clientDocId && <span className="block text-zinc-600">{invoice.clientDocId}</span>}
                    <span className="block text-zinc-600">Tel: {invoice.clientPhone}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9.5px]">Método & Estado de Pago:</span>
                    <strong className="uppercase text-zinc-900">{invoice.paymentMethod}</strong>
                    <div>
                      <span className="inline-block px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded text-[9.5px] uppercase mt-0.5">
                        {invoice.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Invoice Table */}
                <table className="w-full text-left text-[10px] border border-zinc-200">
                  <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-200 uppercase text-[9px]">
                    <tr>
                      <th className="py-1 px-2">Descripción</th>
                      <th className="py-1 px-2 text-center w-12">Cant.</th>
                      <th className="py-1 px-2 text-right w-20">Unit.</th>
                      <th className="py-1 px-2 text-right w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 px-2 font-medium">{item.description}</td>
                        <td className="py-1 px-2 text-center">{item.quantity}</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(item.unitPrice, currency)}</td>
                        <td className="py-1 px-2 text-right font-semibold">{formatCurrency(item.total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Bank & Payment Methods + Totals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] items-stretch">
                  <div className="bg-blue-50/70 border border-blue-200 rounded p-2 text-zinc-800 space-y-1">
                    <div className="font-bold text-blue-900 flex items-center gap-1 text-[10px] uppercase">
                      <Landmark className="w-3.5 h-3.5 text-blue-700" />
                      Medios de Cobro & Cuentas Bancarias
                    </div>
                    <div className="flex flex-wrap gap-1 text-[8.5px] font-bold">
                      {settings.acceptedPaymentMethods?.depositoBancario !== false && (
                        <span className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-900">Depósito Bancario</span>
                      )}
                      {settings.acceptedPaymentMethods?.transferencia !== false && (
                        <span className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-900">Transferencia</span>
                      )}
                      {settings.acceptedPaymentMethods?.tarjeta !== false && (
                        <span className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-900">Pago con Tarjeta</span>
                      )}
                      {settings.acceptedPaymentMethods?.efectivo !== false && (
                        <span className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-900">Efectivo</span>
                      )}
                    </div>
                    <p className="text-[10px]">
                      <strong>Banco:</strong> {settings.bankName || 'Bancolombia'} ({settings.bankAccountType || 'Ahorros'})
                    </p>
                    <p className="text-[10.5px] font-mono font-bold text-zinc-900">
                      <strong>No:</strong> {settings.bankAccountNumber || '458-921478-33'}
                    </p>
                    <p className="text-[9.5px] text-zinc-600">
                      <strong>Titular:</strong> {settings.bankAccountHolder || settings.name}
                    </p>
                    {settings.bankPaymentNotes && (
                      <p className="text-[9px] text-blue-800 italic">
                        {settings.bankPaymentNotes}
                      </p>
                    )}
                    {settings.acceptedPaymentMethods?.tarjeta !== false && settings.cardPaymentNotes && (
                      <p className="text-[9px] text-zinc-700">
                        <CreditCard className="w-3 h-3 inline mr-1 text-blue-700" />
                        {settings.cardPaymentNotes}
                      </p>
                    )}
                  </div>

                  <div className="bg-zinc-50 border border-zinc-200 rounded p-2 text-[10px] space-y-1">
                    <div className="flex justify-between text-zinc-600">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(invoice.subtotal, currency)}</span>
                    </div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Descuento:</span>
                        <span>-{formatCurrency(invoice.discount, currency)}</span>
                      </div>
                    )}
                    {invoice.tax > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>IVA:</span>
                        <span>{formatCurrency(invoice.tax, currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-xs border-t border-zinc-900 pt-1 text-zinc-950">
                      <span>Total Facturado:</span>
                      <span>{formatCurrency(invoice.total, currency)}</span>
                    </div>
                    {invoice.warrantyText && (
                      <p className="text-[8.5px] text-zinc-600 pt-1 italic">
                        {invoice.warrantyText}
                      </p>
                    )}
                  </div>
                </div>

                {settings.invoiceTerms && (
                  <div className="text-[8.5px] text-zinc-600 bg-zinc-50 px-2 py-1.5 rounded border border-zinc-200 leading-snug whitespace-pre-line">
                    <strong className="block text-zinc-800 text-[9px] font-bold uppercase mb-0.5">Términos y Condiciones de Facturación:</strong>
                    {settings.invoiceTerms}
                  </div>
                )}
              </div>
            ) : order ? (
              /* Remisión de Entrada / Comprobante de Entrega */
              <div className="mt-2 space-y-2">
                {/* Client & Device Grid (Ultra-compact 2-Column Matrix) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-50 p-2.5 rounded border border-zinc-200 text-[10.5px]">
                  <div>
                    <h4 className="font-bold text-zinc-800 text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <User className="w-3 h-3 text-blue-600" />
                      Datos del Cliente
                    </h4>
                    <p className="font-bold text-xs text-zinc-950">{order.clientName}</p>
                    <p className="text-zinc-600 leading-tight"><strong>Doc/ID:</strong> {order.clientDocId || 'N/A'}</p>
                    <p className="text-zinc-600 leading-tight"><strong>Teléfono / WhatsApp:</strong> {order.clientPhone}</p>
                    {order.clientAddress && <p className="text-zinc-600 leading-tight"><strong>Dirección:</strong> {order.clientAddress}</p>}
                  </div>

                  <div>
                    <h4 className="font-bold text-zinc-800 text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-blue-600" />
                      Dispositivo & Responsable
                    </h4>
                    <p className="font-bold text-xs text-zinc-950 capitalize">{order.deviceType}: {order.brand} {order.model}</p>
                    <p className="text-zinc-600 font-mono leading-tight"><strong>Serial / IMEI:</strong> {order.serialOrImei || 'No visible'}</p>
                    <div className="flex items-center gap-2 leading-tight">
                      <span className="text-zinc-600"><strong>Color:</strong> {order.color || 'N/A'}</span>
                      {order.passcode && (
                        <span className="text-zinc-800 font-mono bg-zinc-200 px-1 py-0.2 rounded text-[9.5px]">
                          <strong>PIN:</strong> {order.passcode}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-600 leading-tight"><strong>Técnico:</strong> {order.technicianAssigned}</p>
                  </div>
                </div>

                {/* Technical Diagnostic & Physical condition row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                  <div className="border border-zinc-200 p-2 rounded bg-white sm:col-span-1">
                    <strong className="text-zinc-800 block text-[9.5px] uppercase tracking-wider">Falla Reportada:</strong>
                    <p className="text-zinc-700 italic mt-0.5 leading-snug">"{order.reportedFault}"</p>
                  </div>

                  <div className="border border-zinc-200 p-2 rounded bg-white sm:col-span-1">
                    <strong className="text-zinc-800 block text-[9.5px] uppercase tracking-wider">Informe / Diagnóstico:</strong>
                    <p className="text-zinc-700 mt-0.5 leading-snug">{order.technicalDiagnostic || 'En revisión y diagnóstico de laboratorio.'}</p>
                  </div>

                  <div className="border border-zinc-200 p-2 rounded bg-white sm:col-span-1">
                    <strong className="text-zinc-800 block text-[9.5px] uppercase tracking-wider">Estado & Accesorios:</strong>
                    <p className="text-zinc-700 text-[9.5px] leading-snug">
                      <strong>Estético:</strong> {order.physicalCondition || 'Normal de uso.'}
                    </p>
                    <p className="text-zinc-700 text-[9.5px] mt-0.5 leading-snug">
                      <strong>Accesorios:</strong> {order.accessories && order.accessories.length > 0 ? order.accessories.join(', ') : 'Ninguno dejado'}
                    </p>
                  </div>
                </div>

                {/* Checklist de entrega if recibo_entrega */}
                {type === 'recibo_entrega' && (
                  <div className="border border-emerald-200 bg-emerald-50/60 p-2 rounded text-[10px]">
                    <div className="font-bold text-emerald-900 text-[10px] mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Pruebas Técnicas de Salida (Control de Calidad):
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 text-[9.5px] text-zinc-700 font-medium">
                      <span>✓ Pantalla</span>
                      <span>✓ Táctil</span>
                      <span>✓ Carga</span>
                      <span>✓ Batería</span>
                      <span>✓ Audio</span>
                      <span>✓ Señal</span>
                      <span>✓ Cámaras</span>
                      <span>✓ Sellos OK</span>
                    </div>
                  </div>
                )}

                {/* Costs breakdown table (compact) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-700">
                      {type === 'remision_entrada' ? 'Presupuesto de Repuestos y Servicio:' : 'Liquidación Final de Costos:'}
                    </h4>
                  </div>
                  <table className="w-full text-left text-[10px] border border-zinc-200">
                    <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-200 uppercase text-[9px]">
                      <tr>
                        <th className="py-1 px-2">Concepto / Repuesto</th>
                        <th className="py-1 px-2 text-center w-12">Cant.</th>
                        <th className="py-1 px-2 text-right w-20">Unit.</th>
                        <th className="py-1 px-2 text-right w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {order.parts && order.parts.length > 0 ? (
                        order.parts.map((p, idx) => (
                          <tr key={idx}>
                            <td className="py-0.8 px-2 font-medium">{p.name}</td>
                            <td className="py-0.8 px-2 text-center">{p.quantity}</td>
                            <td className="py-0.8 px-2 text-right">{formatCurrency(p.price, currency)}</td>
                            <td className="py-0.8 px-2 text-right font-semibold">{formatCurrency(p.price * p.quantity, currency)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-0.8 px-2 text-zinc-500 italic">No se agregaron repuestos adicionales</td>
                        </tr>
                      )}
                      {order.laborCost > 0 && (
                        <tr>
                          <td className="py-0.8 px-2 font-medium">Mano de obra técnica y diagnóstico especializado</td>
                          <td className="py-0.8 px-2 text-center">1</td>
                          <td className="py-0.8 px-2 text-right">{formatCurrency(order.laborCost, currency)}</td>
                          <td className="py-0.8 px-2 text-right font-semibold">{formatCurrency(order.laborCost, currency)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Side-by-Side: Bank Account Details for Deposit & Financial Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] items-stretch">
                  
                  {/* Left Box: Accepted Payment Methods & Bank Account to Deposit */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded p-2 text-zinc-800 flex flex-col justify-between space-y-1">
                    <div>
                      <div className="font-bold text-blue-900 flex items-center gap-1.5 text-[10px] uppercase mb-1">
                        <Landmark className="w-3.5 h-3.5 text-blue-700" />
                        Formas de Cobro, Depósito y Transferencia
                      </div>
                      <div className="flex flex-wrap gap-1 text-[8.5px] font-bold mb-1">
                        {settings.acceptedPaymentMethods?.depositoBancario !== false && (
                          <span className="px-1.5 py-0.2 bg-white border border-blue-200 rounded text-blue-900">Depósito</span>
                        )}
                        {settings.acceptedPaymentMethods?.transferencia !== false && (
                          <span className="px-1.5 py-0.2 bg-white border border-blue-200 rounded text-blue-900">Transferencia</span>
                        )}
                        {settings.acceptedPaymentMethods?.tarjeta !== false && (
                          <span className="px-1.5 py-0.2 bg-white border border-blue-200 rounded text-blue-900">Tarjeta</span>
                        )}
                        {settings.acceptedPaymentMethods?.efectivo !== false && (
                          <span className="px-1.5 py-0.2 bg-white border border-blue-200 rounded text-blue-900">Efectivo</span>
                        )}
                      </div>
                      <div className="space-y-0.5 text-[10px]">
                        <p>
                          <strong className="text-zinc-700">Banco:</strong> <span className="font-semibold text-zinc-900">{settings.bankName || 'Bancolombia'}</span>
                          <span className="text-zinc-500 text-[9px] ml-1">({settings.bankAccountType || 'Cuenta de Ahorros'})</span>
                        </p>
                        <p className="font-mono text-zinc-950 font-bold text-[11px]">
                          <strong>No. Cuenta:</strong> {settings.bankAccountNumber || '458-921478-33'}
                        </p>
                        <p className="text-[9.5px] text-zinc-600">
                          <strong>Titular:</strong> {settings.bankAccountHolder || `${settings.name} (${settings.nitRfc})`}
                        </p>
                      </div>
                    </div>

                    {settings.bankPaymentNotes && (
                      <p className="text-[9px] text-blue-900 bg-white/70 p-1 rounded border border-blue-100 italic">
                        {settings.bankPaymentNotes}
                      </p>
                    )}
                    {settings.acceptedPaymentMethods?.tarjeta !== false && settings.cardPaymentNotes && (
                      <p className="text-[8.5px] text-zinc-700">
                        <CreditCard className="w-3 h-3 inline mr-1 text-blue-700" />
                        {settings.cardPaymentNotes}
                      </p>
                    )}
                  </div>

                  {/* Right Box: Economic Summary (Subtotal, Abono, Saldo Pendiente) */}
                  {totals && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded p-2 text-[10px] space-y-1">
                      <div className="flex justify-between text-zinc-600">
                        <span>Subtotal Servicio:</span>
                        <span>{formatCurrency(totals.subtotal, currency)}</span>
                      </div>
                      {totals.discount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Descuento aplicado:</span>
                          <span>-{formatCurrency(totals.discount, currency)}</span>
                        </div>
                      )}
                      {totals.tax > 0 && (
                        <div className="flex justify-between text-zinc-600">
                          <span>Impuestos ({order.taxPercent}%):</span>
                          <span>{formatCurrency(totals.tax, currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-xs border-t border-zinc-200 pt-0.5 text-zinc-900">
                        <span>Costo Total:</span>
                        <span>{formatCurrency(totals.total, currency)}</span>
                      </div>
                      <div className="flex justify-between text-blue-800 font-medium">
                        <span>Abono Recibido:</span>
                        <span>{formatCurrency(order.depositPaid, currency)}</span>
                      </div>
                      <div className="flex justify-between font-black text-xs border-t border-zinc-900 pt-0.5 text-red-700">
                        <span>Saldo Pendiente por Pagar:</span>
                        <span>{formatCurrency(totals.balanceDue, currency)}</span>
                      </div>
                      {order.priceAdjustmentNote && (
                        <div className="text-[8.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1 mt-1">
                          <strong>Nota de ajuste:</strong> {order.priceAdjustmentNote}
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Terms and conditions (Brief, concise 2-3 lines) */}
                <div className="text-[8.5px] text-zinc-600 bg-zinc-50 px-2 py-1.5 rounded border border-zinc-200 leading-snug">
                  <strong className="block text-zinc-800 text-[9px] font-bold uppercase tracking-wider mb-0.5">
                    Términos y Condiciones del Servicio:
                  </strong>
                  {type === 'remision_entrada' ? (
                    <div className="whitespace-pre-line">{settings.entryTerms}</div>
                  ) : (
                    <div className="whitespace-pre-line">{settings.deliveryTerms}</div>
                  )}
                </div>

                {/* Signatures Section (Clean, compact lines) */}
                <div className="grid grid-cols-2 gap-6 pt-2 border-t border-zinc-300 mt-2">
                  {/* Client Signature */}
                  <div className="flex flex-col items-center text-center">
                    <div className="h-10 w-full flex items-center justify-center border-b border-zinc-800 pb-0.5">
                      {type === 'remision_entrada' && order.signatureEntryUrl ? (
                        <img src={order.signatureEntryUrl} alt="Firma Cliente" className="max-h-9 max-w-full object-contain" />
                      ) : type === 'recibo_entrega' && order.signatureDeliveryUrl ? (
                        <img src={order.signatureDeliveryUrl} alt="Firma Recibido" className="max-h-9 max-w-full object-contain" />
                      ) : (
                        <div className="text-[9px] text-zinc-400 italic">Firma del Cliente</div>
                      )}
                    </div>
                    <span className="text-[10.5px] font-bold text-zinc-900 mt-0.5">{order.clientName}</span>
                    <span className="text-[8.5px] text-zinc-500">
                      {type === 'remision_entrada'
                        ? 'Acepto condiciones de ingreso y diagnóstico'
                        : 'Recibido a entera satisfacción (Conforme)'}
                    </span>
                    <span className="text-[8.5px] text-zinc-400 font-mono">{order.clientDocId ? `Doc: ${order.clientDocId}` : 'C.C. ___________________'}</span>
                  </div>

                  {/* Technician / Workshop Signature */}
                  <div className="flex flex-col items-center text-center">
                    <div className="h-10 w-full flex items-center justify-center border-b border-zinc-800 pb-0.5">
                      <div className="text-center">
                        <div className="text-[10px] font-serif italic text-blue-900 font-semibold">{settings.name}</div>
                        <div className="text-[8px] text-zinc-400 uppercase">Sello Técnico Autorizado</div>
                      </div>
                    </div>
                    <span className="text-[10.5px] font-bold text-zinc-900 mt-0.5">{order.technicianAssigned}</span>
                    <span className="text-[8.5px] text-zinc-500">Responsable de Laboratorio</span>
                    <span className="text-[8.5px] text-zinc-400 font-mono">Tel: {settings.phone}</span>
                  </div>
                </div>

              </div>
            ) : null}

            {/* Document Footer: 1 Discrete line */}
            <div className="mt-2.5 pt-1.5 border-t border-zinc-200 text-center text-[8.5px] text-zinc-500">
              {settings.name} • {settings.documentFooterNote || 'Conserve este comprobante para cualquier reclamación o retiro del equipo.'}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
