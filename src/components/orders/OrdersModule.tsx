import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import {
  ShoppingCart, Plus, ChevronDown, ChevronUp, Check, X,
  Package, Truck, AlertCircle, RefreshCw, Clock, Search,
  FileText, Loader2, RotateCcw, ChefHat, Upload, Camera,
  CheckCircle2, AlertTriangle, Download,
} from 'lucide-react';
import { logAudit } from '../../lib/auditLogger';
import type { Json } from '../../integrations/supabase/types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { verifyPin } from '../../lib/pinCrypto';
import mammoth from 'mammoth';

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderUnit = 'kg' | 'g' | 'L' | 'cL' | 'pcs' | 'carton' | 'caisse';
type OrderStatus = 'draft' | 'pending' | 'waiting' | 'in_transit' | 'delivered' | 'validated' | 'chef_approved' | 'received' | 'rejected';

interface OrderItem {
  id?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: OrderUnit;
  unitPrice?: number;
}

interface Order {
  id: string;
  orderNumber: string;
  supplier: string;
  status: OrderStatus;
  createdByName: string;
  createdBy?: string;
  approvedByChefName?: string;
  validatedByName?: string;
  validatedAt?: string;
  rejectionReason?: string;
  notes?: string;
  deliveryDate?: string;
  isRecurring: boolean;
  recurrenceFreq?: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

interface ReceiptItem {
  orderItemId: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  unit: OrderUnit;
  productId?: string;
}

// ─── Statuts ──────────────────────────────────────────────────────────────────
const UNITS: OrderUnit[] = ['kg', 'g', 'L', 'cL', 'pcs', 'carton', 'caisse'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:         { label: 'Brouillon',               color: 'text-muted-foreground',                bg: 'bg-muted/40' },
  pending:       { label: 'En attente',              color: 'text-amber-600',                       bg: 'bg-amber-500/10' },
  waiting:       { label: 'En attente de livraison', color: 'text-orange-600',                      bg: 'bg-orange-500/10' },
  in_transit:    { label: 'En cours de livraison',   color: 'text-blue-600',                        bg: 'bg-blue-500/10' },
  delivered:     { label: 'Livrée',                  color: 'text-emerald-600',                     bg: 'bg-emerald-500/10' },
  validated:     { label: 'Validée',                 color: 'text-green-700',                       bg: 'bg-green-600/10' },
  chef_approved: { label: 'Approuvée Chef',          color: 'text-blue-600',                        bg: 'bg-blue-500/10' },
  received:      { label: 'Reçue',                   color: 'text-emerald-600',                     bg: 'bg-emerald-500/10' },
  rejected:      { label: 'Refusée',                 color: 'text-destructive',                     bg: 'bg-destructive/10' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function notifyByRole(
  role: 'owner' | 'manager' | 'chef' | 'admin' | 'staff' | 'god',
  title: string, body: string, refId: string
) {
  const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', role);
  if (!roles?.length) return;
  await supabase.from('notifications').insert(
    roles.map((r) => ({ user_id: r.user_id, type: 'order', title, body, ref_type: 'order', ref_id: refId }))
  );
}

function generateOrderNumber(supplier: string, seq: number): string {
  const prefix = supplier.replace(/\s+/g, '').toUpperCase().slice(0, 6) || 'CMD';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}${dateStr}-${String(seq).padStart(2, '0')}`;
}

function totalEstimate(items?: OrderItem[]): number {
  return (items ?? []).reduce((s, it) => s + it.quantity * (it.unitPrice ?? 0), 0);
}

// ─── Export PDF rapport livraison ─────────────────────────────────────────────
function exportDeliveryPDF(order: Order, receiptItems: ReceiptItem[], globalStatus: string, note: string, validatedByName: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`RAPPORT DE LIVRAISON`, 14, 20);
  doc.setFontSize(11);
  doc.text(`Commande : ${order.orderNumber}`, 14, 30);
  doc.text(`Fournisseur : ${order.supplier}`, 14, 37);
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 14, 44);
  doc.text(`Validé par : ${validatedByName}`, 14, 51);
  doc.setFontSize(13);
  const statusColor = globalStatus === 'conforme' ? [22, 163, 74] : [234, 88, 12];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(`Statut global : ${globalStatus === 'conforme' ? 'LIVRAISON CONFORME' : 'LIVRAISON INCOMPLÈTE'}`, 14, 62);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 70,
    head: [['Produit', 'Commandé', 'Reçu', 'Écart', 'Statut']],
    body: receiptItems.map((it) => {
      const diff = it.receivedQty - it.orderedQty;
      const status = it.receivedQty === it.orderedQty ? '✅ OK' : it.receivedQty === 0 ? '❌ Non livré' : '⚠️ Partiel';
      return [it.productName, `${it.orderedQty} ${it.unit}`, `${it.receivedQty} ${it.unit}`, diff < 0 ? `${diff}` : '0', status];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  if (note) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Note : ${note}`, 14, finalY);
  }

  doc.save(`rapport-livraison-${order.orderNumber}.pdf`);
}

// ─── Validation PIN modal ─────────────────────────────────────────────────────
function PinModal({ onConfirm, onClose }: { onConfirm: (pin: string) => void; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleDigit = (d: string) => {
    if (pin.length < 4) {
      const next = pin + d;
      setPin(next);
      setError('');
      if (next.length === 4) onConfirm(next);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl p-6 w-full max-w-xs border border-border shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">Confirmer votre identité</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground text-center mb-4">Saisissez votre PIN pour valider</p>

        {/* Dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border-2 transition-all ${
                i < pin.length ? 'bg-primary border-primary' : 'border-border bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && <p className="text-xs text-destructive text-center mb-3">{error}</p>}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button
              key={i}
              onClick={() => {
                if (d === '⌫') { setPin((p) => p.slice(0, -1)); setError(''); }
                else if (d) handleDigit(d);
              }}
              disabled={!d}
              className={`h-12 rounded-xl text-lg font-semibold transition-colors ${
                d ? 'bg-secondary hover:bg-muted text-foreground active:scale-95' : 'opacity-0 pointer-events-none'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Delivery Validation Flow (4 étapes) ─────────────────────────────────────
function DeliveryModal({
  order,
  items,
  onClose,
  onValidated,
}: {
  order: Order;
  items: OrderItem[];
  onClose: () => void;
  onValidated: () => void;
}) {
  const { currentUser } = useApp();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [photoCmd, setPhotoCmd] = useState<File | null>(null);
  const [photoBon, setPhotoBon] = useState<File | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>(
    items.map((it) => ({
      orderItemId: it.id ?? '',
      productName: it.productName,
      orderedQty: it.quantity,
      receivedQty: it.quantity,
      unit: it.unit,
      productId: it.productId,
    }))
  );
  const [note, setNote] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const photoCmdRef = useRef<HTMLInputElement>(null);
  const photoBonRef = useRef<HTMLInputElement>(null);

  const hasGap = receiptItems.some((it) => it.receivedQty !== it.orderedQty);
  const globalStatus: 'conforme' | 'incomplete' = hasGap ? 'incomplete' : 'conforme';

  const itemsOk = receiptItems.filter((it) => it.receivedQty === it.orderedQty).length;
  const itemsPartial = receiptItems.filter((it) => it.receivedQty > 0 && it.receivedQty < it.orderedQty).length;
  const itemsMissing = receiptItems.filter((it) => it.receivedQty === 0).length;

  const updateQty = (idx: number, val: string) => {
    const n = parseFloat(val) || 0;
    setReceiptItems((prev) => prev.map((it, i) => i === idx ? { ...it, receivedQty: n } : it));
  };

  const uploadPhoto = async (file: File, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('delivery-proofs').upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('delivery-proofs').getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePinValidate = async (pin: string) => {
    if (!currentUser) return;
    // Verify PIN against stored hash
    const { data: profile } = await supabase
      .from('profiles')
      .select('pin_hash')
      .eq('id', currentUser.id)
      .single();

    let pinOk = false;
    if (profile?.pin_hash) {
      const result = await verifyPin(profile.pin_hash, pin);
      pinOk = result === 'match' || result === 'legacy';
    } else {
      // No PIN set — accept any
      pinOk = true;
    }

    if (!pinOk) {
      setShowPin(false);
      setTimeout(() => setShowPin(true), 100);
      return;
    }

    setShowPin(false);
    setSaving(true);
    try {
      // Upload photos
      let deliveryPhotoUrl: string | null = null;
      let bonPhotoUrl: string | null = null;
      if (photoCmd) deliveryPhotoUrl = await uploadPhoto(photoCmd, `${order.id}/commande.jpg`);
      if (photoBon) bonPhotoUrl = await uploadPhoto(photoBon, `${order.id}/bon.jpg`);

      // Create delivery report
      await supabase.from('delivery_reports').insert({
        order_id: order.id,
        global_status: globalStatus,
        items_ok: itemsOk,
        items_partial: itemsPartial,
        items_missing: itemsMissing,
        note: note || null,
        validated_by: currentUser.id,
        delivery_photo_url: deliveryPhotoUrl,
        bon_photo_url: bonPhotoUrl,
      });

      // Create order receipt for items
      const { data: receipt } = await supabase.from('order_receipts').insert({
        order_id: order.id,
        received_by: currentUser.id,
        received_by_name: currentUser.name,
        has_gap: hasGap,
        gap_note: hasGap ? (note || 'Écart constaté') : null,
      }).select().single();

      if (receipt) {
        await supabase.from('order_receipt_items').insert(
          receiptItems.map((it) => ({
            receipt_id: receipt.id,
            order_item_id: it.orderItemId,
            product_name: it.productName,
            ordered_qty: it.orderedQty,
            received_qty: it.receivedQty,
            unit: it.unit,
          }))
        );
      }

      // Update order to validated
      await supabase.from('orders').update({
        status: 'validated',
        delivery_photo_url: deliveryPhotoUrl,
        delivery_note_url: bonPhotoUrl,
        delivery_note: note || null,
        validated_by: currentUser.id,
        validated_at: new Date().toISOString(),
      }).eq('id', order.id);

      // Update stock with received quantities
      for (const ri of receiptItems) {
        if (ri.receivedQty > 0 && ri.productId) {
          await supabase.from('stock_logs').insert({
            product_id: ri.productId,
            delta: ri.receivedQty,
            reason: 'Delivery received',
            updated_by: currentUser.name,
          });
          const { data: prod } = await supabase.from('products').select('current_stock').eq('id', ri.productId).single();
          if (prod) {
            await supabase.from('products').update({ current_stock: prod.current_stock + ri.receivedQty }).eq('id', ri.productId);
          }
        }
      }

      // Award +15 pts
      await supabase.from('score_events').insert([{
        user_id: currentUser.id,
        user_name: currentUser.name,
        team: (currentUser.team as 'BAR' | 'KITCHEN' | 'FLOOR' | 'ATELIER' | 'MANAGEMENT' | 'ALL') || 'BAR',
        type: 'bonus' as const,
        reason: `Livraison validée : ${order.orderNumber}`,
        points: 15,
      }]);

      // Auto-create incident if incomplete
      if (globalStatus === 'incomplete') {
        const missingLines = receiptItems
          .filter((it) => it.receivedQty < it.orderedQty)
          .map((it) => `${it.productName}: reçu ${it.receivedQty}/${it.orderedQty} ${it.unit}`)
          .join('\n');
        await supabase.from('incidents').insert({
          type: 'Livraison',
          severity: 'high',
          location: 'Réception',
          team: (currentUser as { team: string }).team || 'BAR',
          description: `Livraison incomplète — Commande ${order.orderNumber}\n\n${missingLines}`,
          reporter_user_id: currentUser.id,
          reporter_name: currentUser.name,
          anonymous: false,
          status: 'open',
        });
      }

      await logAudit(currentUser.id, currentUser.name, 'order_confirmed_manager', 'order', order.id, {
        orderNumber: order.orderNumber,
        globalStatus,
      } as Json);

      onValidated();
    } catch (err) {
      console.error('Delivery validation error:', err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-foreground">Réceptionner la livraison</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{order.orderNumber} · {order.supplier}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 py-3 border-b border-border flex-shrink-0">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                step > s ? 'bg-primary text-primary-foreground' :
                step === s ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <Check className="w-3 h-3" /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 rounded transition-all ${step > s ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
            step === 4 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>4</div>
        </div>

        {/* Step content */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ÉTAPE 1 — Photos */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Étape 1 — Photos obligatoires</p>

              {/* Photo commande */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="p-3 bg-muted/30">
                  <p className="text-sm font-semibold text-foreground">📦 Photo 1 : Commande reçue</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Vue d'ensemble des produits livrés</p>
                </div>
                <div className="p-3">
                  {photoCmd ? (
                    <div className="flex items-center gap-3">
                      <img src={URL.createObjectURL(photoCmd)} className="w-16 h-16 rounded-lg object-cover" alt="cmd" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{photoCmd.name}</p>
                        <button onClick={() => setPhotoCmd(null)} className="text-xs text-destructive mt-0.5">Supprimer</button>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Prendre / choisir une photo</span>
                      <input
                        ref={photoCmdRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && setPhotoCmd(e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Photo bon */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="p-3 bg-muted/30">
                  <p className="text-sm font-semibold text-foreground">📄 Photo 2 : Bon de livraison</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Bon physique reçu avec le livreur</p>
                </div>
                <div className="p-3">
                  {photoBon ? (
                    <div className="flex items-center gap-3">
                      <img src={URL.createObjectURL(photoBon)} className="w-16 h-16 rounded-lg object-cover" alt="bon" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{photoBon.name}</p>
                        <button onClick={() => setPhotoBon(null)} className="text-xs text-destructive mt-0.5">Supprimer</button>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Prendre / choisir une photo</span>
                      <input
                        ref={photoBonRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && setPhotoBon(e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 — Saisie quantités */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Étape 2 — Quantités reçues</p>
              {receiptItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground">Commandé : {item.orderedQty} {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.receivedQty}
                      onChange={(e) => updateQty(idx, e.target.value)}
                      className={`w-16 text-center px-2 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none focus:border-primary bg-background ${
                        item.receivedQty !== item.orderedQty ? 'border-amber-400 text-amber-600' : 'border-border text-foreground'
                      }`}
                    />
                    <span className="text-[11px] text-muted-foreground">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ÉTAPE 3 — Rapport */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Étape 3 — Rapport de livraison</p>

              {/* Header rapport */}
              <div className={`rounded-xl border p-4 ${globalStatus === 'conforme' ? 'border-emerald-300 bg-emerald-50/50' : 'border-orange-300 bg-orange-50/50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {globalStatus === 'conforme' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                  )}
                  <span className={`text-sm font-bold ${globalStatus === 'conforme' ? 'text-emerald-700' : 'text-orange-700'}`}>
                    {globalStatus === 'conforme' ? 'LIVRAISON CONFORME' : 'LIVRAISON INCOMPLÈTE'}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {itemsOk > 0 && <span className="text-emerald-600">✅ {itemsOk} OK</span>}
                  {itemsPartial > 0 && <span className="text-amber-600">⚠️ {itemsPartial} partiel</span>}
                  {itemsMissing > 0 && <span className="text-red-600">❌ {itemsMissing} manquant</span>}
                </div>
              </div>

              {/* Détail */}
              <div className="space-y-2">
                {receiptItems.map((it, i) => {
                  const isOk = it.receivedQty === it.orderedQty;
                  const isMissing = it.receivedQty === 0;
                  const isPartial = !isOk && !isMissing;
                  const diff = it.receivedQty - it.orderedQty;
                  return (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                      isOk ? 'bg-emerald-50 text-emerald-700' :
                      isMissing ? 'bg-red-50 text-red-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      <span className="flex items-center gap-1.5 font-medium">
                        {isOk ? '✅' : isMissing ? '❌' : '⚠️'}
                        {it.productName}
                      </span>
                      <span className="font-mono">
                        {isOk
                          ? `${it.receivedQty} / ${it.orderedQty} ${it.unit}`
                          : isMissing
                          ? `NON LIVRÉ (${it.orderedQty} ${it.unit})`
                          : `${it.receivedQty}/${it.orderedQty} ${it.unit} (manque ${Math.abs(diff)})`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Note / commentaire (optionnel)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Remarques sur la livraison…"
                  className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground resize-none focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* ÉTAPE 4 — Confirmation finale */}
          {step === 4 && (
            <div className="space-y-4 text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${globalStatus === 'conforme' ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                {globalStatus === 'conforme' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-orange-500" />
                )}
              </div>
              <div>
                <p className="font-bold text-foreground">{globalStatus === 'conforme' ? 'Livraison conforme' : 'Livraison incomplète'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Après validation PIN : commande validée, stock mis à jour, +15 pts attribués.
                  {globalStatus === 'incomplete' && ' Un incident sera créé automatiquement.'}
                </p>
              </div>
              <button
                onClick={() => setShowPin(true)}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Saisir le PIN pour valider
              </button>

              <button
                onClick={() => {
                  if (order.orderNumber && receiptItems.length > 0) {
                    exportDeliveryPDF(order, receiptItems, globalStatus, note, currentUser?.name || '');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exporter le rapport PDF
              </button>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex gap-3 p-5 border-t border-border flex-shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-medium text-muted-foreground"
            >
              Retour
            </button>
          ) : (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-medium text-muted-foreground">
              Annuler
            </button>
          )}

          {step < 4 && (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
              disabled={step === 1 && (!photoCmd || !photoBon)}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {step === 1 && (!photoCmd || !photoBon) ? (
                <span className="text-xs">2 photos requises</span>
              ) : (
                <>Suivant <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" /></>
              )}
            </button>
          )}
        </div>
      </div>

      {showPin && (
        <PinModal
          onConfirm={handlePinValidate}
          onClose={() => setShowPin(false)}
        />
      )}
    </div>
  );
}

// ─── Validation modal ─────────────────────────────────────────────────────────
function ValidationModal({ order, onClose, onValidate, canManage }: {
  order: Order; onClose: () => void;
  onValidate: (approved: boolean, reason?: string) => void;
  canManage: boolean;
}) {
  const [reason, setReason] = useState('');
  const [refusing, setRefusing] = useState(false);
  if (!canManage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-5 w-full max-w-sm shadow-xl animate-slide-up">
        <h3 className="text-sm font-bold text-foreground mb-1">Valider la commande</h3>
        <p className="text-xs text-muted-foreground mb-4">{order.orderNumber} · {order.supplier}</p>

        {refusing ? (
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif du refus (obligatoire)…"
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground resize-none focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button onClick={() => setRefusing(false)} className="flex-1 py-2 rounded-xl bg-secondary text-sm font-medium">Annuler</button>
              <button
                onClick={() => reason.trim() && onValidate(false, reason.trim())}
                disabled={!reason.trim()}
                className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-50"
              >Refuser</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-secondary text-sm font-medium">Annuler</button>
            <button onClick={() => setRefusing(true)} className="flex-1 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold">Refuser</button>
            <button onClick={() => onValidate(true)} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Valider</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Import orders modal ──────────────────────────────────────────────────────
interface ImportOrderRow {
  productName: string;
  ref: string;
  quantity: number;
  unit: OrderUnit;
  unitPrice?: number;
  supplier: string;
  matchStatus: 'matched' | 'unmatched' | 'invalid';
  matchedProductId?: string;
}

function ImportOrderModal({
  rows,
  products,
  supplier,
  setSupplier,
  onConfirm,
  onCancel,
  loading,
  onRowOverride,
}: {
  rows: ImportOrderRow[];
  products: { id: string; name: string; supplier?: string }[];
  supplier: string;
  setSupplier: (s: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  onRowOverride: (idx: number, productId: string) => void;
}) {
  const validRows = rows.filter((r) => r.matchStatus !== 'invalid');
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-lg border border-border shadow-xl animate-slide-up max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-foreground">Aperçu — Import commande</h3>
            <p className="text-xs text-muted-foreground">{validRows.length} lignes valides sur {rows.length}</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {/* Fournisseur */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Fournisseur *</label>
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Metro, Transgourmet…"
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border text-xs ${
                  row.matchStatus === 'matched' ? 'border-emerald-300 bg-emerald-50/50' :
                  row.matchStatus === 'invalid' ? 'border-red-200 bg-red-50/50 opacity-60' :
                  'border-amber-300 bg-amber-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">
                    {row.matchStatus === 'matched' ? '✅' : row.matchStatus === 'invalid' ? '❌' : '⚠️'}
                  </span>
                  <span className="font-semibold text-foreground">{row.productName}</span>
                  <span className="text-muted-foreground ml-auto">{row.quantity} {row.unit}</span>
                </div>
                {row.matchStatus === 'unmatched' && (
                  <select
                    className="w-full mt-1.5 px-2 py-1 rounded-lg bg-background border border-amber-300 text-xs focus:outline-none"
                    onChange={(e) => onRowOverride(i, e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>Sélectionner dans le catalogue…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                {row.matchStatus === 'invalid' && (
                  <p className="text-red-500 mt-1">Ligne ignorée (données invalides)</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-border flex-shrink-0">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-medium text-muted-foreground">Annuler</button>
          <button
            onClick={onConfirm}
            disabled={loading || !supplier.trim() || validRows.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
            Créer la commande
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order card ───────────────────────────────────────────────────────────────
function OrderCard({
  order, canManage, isChefRole, onValidate, onReceive, onExpand, expanded,
}: {
  order: Order; canManage: boolean; isChefRole: boolean;
  onValidate: (order: Order) => void; onReceive: (order: Order) => void;
  onExpand: () => void; expanded: boolean;
}) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['draft'];
  const total = totalEstimate(order.items);

  return (
    <div className="glass-card rounded-xl border border-border overflow-hidden">
      <button onClick={onExpand} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono font-semibold text-muted-foreground">{order.orderNumber}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              {order.isRecurring && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <RotateCcw className="w-2.5 h-2.5" /> Récurrent
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground">{order.supplier || 'Fournisseur non défini'}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <p className="text-xs text-muted-foreground">Par {order.createdByName} · {new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
              {(order.items?.length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">{order.items!.length} article{order.items!.length > 1 ? 's' : ''}</p>
              )}
              {total > 0 && (
                <p className="text-xs font-semibold text-foreground">{total.toFixed(2)} €</p>
              )}
              {order.deliveryDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Clock className="w-3 h-3" /> Livr. le {new Date(order.deliveryDate).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 space-y-3 animate-slide-up">
          {order.items && order.items.length > 0 && (
            <div className="space-y-1.5 pt-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-foreground font-medium">{item.productName}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="font-mono">{item.quantity} {item.unit}</span>
                    {item.unitPrice && <span>{(item.quantity * item.unitPrice).toFixed(2)} €</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {order.notes && <div className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">📝 {order.notes}</div>}
          {order.status === 'rejected' && order.rejectionReason && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex gap-2">
              <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{order.rejectionReason}</span>
            </div>
          )}

          {/* Chef: approve pending */}
          {isChefRole && order.status === 'pending' && (
            <button onClick={() => onValidate(order)} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2">
              <ChefHat className="w-3.5 h-3.5" /> Approuver (Chef)
            </button>
          )}
          {/* Manager: confirm after chef */}
          {canManage && order.status === 'chef_approved' && (
            <button onClick={() => onValidate(order)} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2">
              <Check className="w-3.5 h-3.5" /> Confirmer (Manager)
            </button>
          )}
          {/* Manager: direct validation */}
          {canManage && order.status === 'pending' && (
            <button onClick={() => onValidate(order)} className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2">
              <Check className="w-3.5 h-3.5" /> Valider directement
            </button>
          )}
          {/* Receive — trigger delivery flow */}
          {(order.status === 'validated' || order.status === 'waiting' || order.status === 'in_transit') && (
            <button onClick={() => onReceive(order)} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2">
              <Truck className="w-3.5 h-3.5" /> Réceptionner la livraison
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create order form ────────────────────────────────────────────────────────
function CreateOrderForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { currentUser, products } = useApp();
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [items, setItems] = useState<OrderItem[]>([{ productName: '', quantity: 1, unit: 'pcs' }]);
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState<string[]>(['']);

  const addItem = () => {
    setItems((prev) => [...prev, { productName: '', quantity: 1, unit: 'pcs' }]);
    setProductSearch((prev) => [...prev, '']);
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setProductSearch((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const selectProduct = (idx: number, product: { id: string; name: string; supplier?: string }) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, productId: product.id, productName: product.name } : it));
    if (!supplier && product.supplier) setSupplier(product.supplier);
    setProductSearch((prev) => prev.map((s, i) => i === idx ? '' : s));
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    const validItems = items.filter((it) => it.productName.trim());
    if (!supplier.trim() || validItems.length === 0) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00`);
      const orderNumber = generateOrderNumber(supplier, (count ?? 0) + 1);

      const { data: order, error } = await supabase.from('orders').insert([{
        order_number: orderNumber,
        supplier: supplier.trim(),
        status: 'pending' as const,
        created_by: currentUser.id,
        created_by_name: currentUser.name,
        notes: notes.trim() || null,
        delivery_date: deliveryDate || null,
        is_recurring: isRecurring,
        recurrence_freq: isRecurring ? recurrenceFreq : null,
      }]).select().single();

      if (error || !order) throw error;

      await supabase.from('order_items').insert(
        validItems.map((it) => ({
          order_id: order.id,
          product_id: it.productId ?? null,
          product_name: it.productName.trim(),
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unitPrice ?? null,
        }))
      );

      onCreated();
      onClose();
    } catch (err) {
      console.error('Create order error:', err);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-5 w-full max-w-lg shadow-xl animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h3 className="text-sm font-bold text-foreground">Nouvelle commande</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-4">
          {/* Supplier */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fournisseur *</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="ex: Metro, Transgourmet…"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Delivery date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
              <Clock className="w-3 h-3" /> Date de livraison prévue (optionnel)
            </label>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Produits *</label>
              <button onClick={addItem} className="text-xs text-primary font-semibold flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const srch = productSearch[idx] || '';
                const matches = srch.length >= 2 ? products.filter((p) => p.name.toLowerCase().includes(srch.toLowerCase())).slice(0, 5) : [];
                return (
                  <div key={idx} className="p-3 rounded-xl bg-secondary space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          value={item.productName || srch}
                          onChange={(e) => { setProductSearch((prev) => prev.map((s, i) => i === idx ? e.target.value : s)); updateItem(idx, 'productName', e.target.value); }}
                          placeholder="Nom du produit"
                          className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:border-primary"
                        />
                        {matches.length > 0 && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                            {matches.map((p) => (
                              <button key={p.id} onClick={() => selectProduct(idx, p)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors flex items-center gap-2">
                                <Package className="w-3 h-3 text-muted-foreground" />
                                <span className="font-medium">{p.name}</span>
                                {p.supplier && <span className="text-muted-foreground ml-auto">{p.supplier}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input type="number" min="0" step="0.1" value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2.5 py-2 rounded-lg bg-background border border-border text-xs text-center focus:outline-none focus:border-primary" />
                      <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value as OrderUnit)}
                        className="flex-1 px-2.5 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:border-primary">
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" value={item.unitPrice ?? ''} placeholder="Prix/u"
                        onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || undefined)}
                        className="w-20 px-2.5 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Instructions spéciales…"
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs resize-none focus:outline-none focus:border-primary" />
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
            <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
            <label htmlFor="recurring" className="text-xs font-medium text-foreground flex-1">Commande récurrente</label>
            {isRecurring && (
              <select value={recurrenceFreq} onChange={(e) => setRecurrenceFreq(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="px-2 py-1 rounded-lg bg-background border border-border text-xs focus:outline-none">
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdo</option>
                <option value="monthly">Mensuel</option>
              </select>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-medium">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !supplier.trim() || items.every((it) => !it.productName.trim())}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────
interface OrdersModuleProps {
  canManage?: boolean;
  isChef?: boolean;
}

export function OrdersModule({ canManage = false, isChef = false }: OrdersModuleProps) {
  const isChefRole = isChef && !canManage;
  const { currentUser, products } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [validateTarget, setValidateTarget] = useState<Order | null>(null);
  const [deliveryTarget, setDeliveryTarget] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Import order state
  const [importOrderRows, setImportOrderRows] = useState<ImportOrderRow[]>([]);
  const [importOrderSupplier, setImportOrderSupplier] = useState('');
  const [importOrderLoading, setImportOrderLoading] = useState(false);
  const [importOrderError, setImportOrderError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items(*)`)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setOrders(data.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        supplier: o.supplier,
        status: o.status as OrderStatus,
        createdByName: o.created_by_name,
        createdBy: o.created_by ?? undefined,
        approvedByChefName: (o as Record<string, unknown>).approved_by_chef_name as string | undefined,
        validatedByName: o.validated_by_name ?? undefined,
        validatedAt: o.validated_at ?? undefined,
        rejectionReason: o.rejection_reason ?? undefined,
        notes: o.notes ?? undefined,
        deliveryDate: (o as Record<string, unknown>).delivery_date as string | undefined,
        isRecurring: o.is_recurring,
        recurrenceFreq: o.recurrence_freq ?? undefined,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        items: ((o as Record<string, unknown>).order_items as Array<{
          id: string; product_id: string | null; product_name: string;
          quantity: number; unit: string; unit_price: number | null;
        }> ?? []).map((it) => ({
          id: it.id,
          productId: it.product_id ?? undefined,
          productName: it.product_name,
          quantity: it.quantity,
          unit: it.unit as OrderUnit,
          unitPrice: it.unit_price ?? undefined,
        })),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  // ─── Parse rows from text (PDF/Word extraction) ───────────────────────────
  const parseTextToRows = (text: string): ImportOrderRow[] => {
    const validUnits: OrderUnit[] = ['kg', 'g', 'L', 'cL', 'pcs', 'carton', 'caisse'];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: ImportOrderRow[] = [];

    for (const line of lines) {
      // Try tab / semicolon / comma separated
      const parts = line.split(/\t|;|,/).map((p) => p.trim());
      if (parts.length < 2) continue;
      const productName = parts[0];
      if (!productName || productName.length < 2) continue;

      const qtyRaw = parseFloat(parts[1]?.replace(',', '.') ?? '');
      if (isNaN(qtyRaw) || qtyRaw <= 0) continue;

      const unitRaw = (parts[2] ?? 'pcs').toLowerCase().trim() as OrderUnit;
      const unit = validUnits.includes(unitRaw) ? unitRaw : 'pcs';
      const unitPrice = parts[3] ? parseFloat(parts[3].replace(',', '.')) : undefined;

      const matched = products.find((p) => p.name.toLowerCase() === productName.toLowerCase());
      parsed.push({
        productName,
        ref: '',
        quantity: qtyRaw,
        unit,
        unitPrice: unitPrice && !isNaN(unitPrice) ? unitPrice : undefined,
        supplier: '',
        matchStatus: matched ? 'matched' : 'unmatched',
        matchedProductId: matched?.id,
      });
    }
    return parsed;
  };

  // ─── Import orders (CSV / Excel / PDF / Word) ─────────────────────────────
  const handleOrderFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportOrderError('');

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    // ── Word (.docx) ──
    if (ext === 'docx' || ext === 'doc') {
      const arrayBuffer = await file.arrayBuffer();
      try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        if (!text.trim()) {
          setImportOrderError("Ce fichier semble être un scan. L'import automatique n'est pas disponible. Veuillez utiliser un fichier CSV ou Excel.");
          e.target.value = '';
          return;
        }
        const parsed = parseTextToRows(text);
        if (parsed.length === 0) {
          setImportOrderError('Aucune ligne exploitable trouvée dans le document. Vérifiez le format (colonnes : Produit ; Quantité ; Unité).');
          e.target.value = '';
          return;
        }
        setImportOrderRows(parsed);
      } catch {
        setImportOrderError('Impossible de lire le fichier Word.');
      }
      e.target.value = '';
      return;
    }

    // ── PDF ──
    if (ext === 'pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        // Dynamic import to avoid bundling pdfjs in main chunk
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          fullText += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n';
        }
        if (!fullText.trim()) {
          setImportOrderError("Ce fichier semble être un scan. L'import automatique n'est pas disponible. Veuillez utiliser un fichier CSV ou Excel.");
          e.target.value = '';
          return;
        }
        const parsed = parseTextToRows(fullText);
        if (parsed.length === 0) {
          setImportOrderError('Aucune ligne exploitable trouvée dans le PDF. Vérifiez le format (colonnes : Produit ; Quantité ; Unité).');
          e.target.value = '';
          return;
        }
        setImportOrderRows(parsed);
      } catch {
        setImportOrderError('Impossible de lire le fichier PDF.');
      }
      e.target.value = '';
      return;
    }

    // ── CSV / Excel ──
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rows || rows.length < 2) { setImportOrderError('Fichier vide.'); return; }

        const parsed: ImportOrderRow[] = [];
        const validUnits: OrderUnit[] = ['kg', 'g', 'L', 'cL', 'pcs', 'carton', 'caisse'];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          const productName = String(row[0] ?? '').trim();
          const ref = String(row[1] ?? '').trim();
          const quantity = parseFloat(String(row[2] ?? '0'));
          const unit = String(row[3] ?? 'pcs').trim() as OrderUnit;
          const unitPrice = row[4] != null ? parseFloat(String(row[4])) : undefined;
          const supplier = String(row[5] ?? '').trim();

          if (!productName || isNaN(quantity) || quantity <= 0) {
            if (productName) parsed.push({ productName, ref, quantity: 0, unit: 'pcs', supplier, matchStatus: 'invalid' });
            continue;
          }

          const safeUnit = validUnits.includes(unit) ? unit : 'pcs';
          const matched = products.find(
            (p) => p.name.toLowerCase() === productName.toLowerCase() ||
              (p as unknown as { supplierRef?: string }).supplierRef?.toLowerCase() === ref.toLowerCase()
          );

          parsed.push({
            productName, ref, quantity, unit: safeUnit,
            unitPrice: unitPrice && !isNaN(unitPrice) ? unitPrice : undefined,
            supplier,
            matchStatus: matched ? 'matched' : 'unmatched',
            matchedProductId: matched?.id,
          });
        }

        if (!importOrderSupplier && parsed.find((r) => r.supplier)) {
          setImportOrderSupplier(parsed.find((r) => r.supplier)!.supplier);
        }
        setImportOrderRows(parsed);
      } catch {
        setImportOrderError('Impossible de lire le fichier.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleRowOverride = (idx: number, productId: string) => {
    setImportOrderRows((prev) => prev.map((r, i) => i === idx ? { ...r, matchStatus: 'matched', matchedProductId: productId } : r));
  };

  const handleImportOrderConfirm = async () => {
    if (!currentUser || !importOrderSupplier.trim()) return;
    const validRows = importOrderRows.filter((r) => r.matchStatus !== 'invalid');
    if (validRows.length === 0) return;
    setImportOrderLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00`);
      const orderNumber = generateOrderNumber(importOrderSupplier, (count ?? 0) + 1);

      const { data: order, error } = await supabase.from('orders').insert([{
        order_number: orderNumber,
        supplier: importOrderSupplier.trim(),
        status: 'pending' as const,
        created_by: currentUser.id,
        created_by_name: currentUser.name,
      }]).select().single();

      if (error || !order) throw error;

      await supabase.from('order_items').insert(
        validRows.map((r) => ({
          order_id: order.id,
          product_id: r.matchedProductId ?? null,
          product_name: r.productName,
          quantity: r.quantity,
          unit: r.unit,
          unit_price: r.unitPrice ?? null,
        }))
      );

      setImportOrderRows([]);
      setImportOrderSupplier('');
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
    setImportOrderLoading(false);
  };

  // ─── Validate / approve ───────────────────────────────────────────────────
  const handleChefApprove = async (approved: boolean, reason?: string) => {
    if (!validateTarget || !currentUser) return;
    if (approved) {
      await supabase.from('orders').update({
        status: 'chef_approved' as unknown as 'pending',
        approved_by_chef: currentUser.id,
        approved_by_chef_name: currentUser.name,
        chef_approved_at: new Date().toISOString(),
      } as Record<string, unknown>).eq('id', validateTarget.id);
      await notifyByRole('manager', '📦 Commande à confirmer', `"${validateTarget.supplier}" approuvée par ${currentUser.name}`, validateTarget.id);
      await logAudit(currentUser.id, currentUser.name, 'order_approved_chef', 'order', validateTarget.id, { order: validateTarget.orderNumber } as Json);
    } else {
      await supabase.from('orders').update({ status: 'rejected', rejection_reason: reason }).eq('id', validateTarget.id);
      if (validateTarget.createdBy) {
        await supabase.from('notifications').insert({ user_id: validateTarget.createdBy, type: 'order', title: '❌ Commande refusée', body: `Refusée par ${currentUser.name}`, ref_type: 'order', ref_id: validateTarget.id });
      }
      await logAudit(currentUser.id, currentUser.name, 'order_rejected', 'order', validateTarget.id, { order: validateTarget.orderNumber } as Json);
    }
    setValidateTarget(null);
    fetchOrders();
  };

  const handleManagerConfirm = async (approved: boolean, reason?: string) => {
    if (!validateTarget || !currentUser) return;
    if (approved) {
      await supabase.from('orders').update({
        status: 'validated' as const,
        approved_by_manager: currentUser.id,
        approved_by_manager_name: currentUser.name,
        manager_confirmed_at: new Date().toISOString(),
        validated_by: currentUser.id,
        validated_by_name: currentUser.name,
        validated_at: new Date().toISOString(),
      }).eq('id', validateTarget.id);
      if (validateTarget.createdBy) {
        await supabase.from('notifications').insert({ user_id: validateTarget.createdBy, type: 'order', title: '✅ Commande confirmée', body: `Validée par ${currentUser.name}`, ref_type: 'order', ref_id: validateTarget.id });
      }
      await logAudit(currentUser.id, currentUser.name, 'order_confirmed_manager', 'order', validateTarget.id, { order: validateTarget.orderNumber } as Json);
    } else {
      await supabase.from('orders').update({ status: 'rejected', rejection_reason: reason }).eq('id', validateTarget.id);
      if (validateTarget.createdBy) {
        await supabase.from('notifications').insert({ user_id: validateTarget.createdBy, type: 'order', title: '❌ Commande refusée', body: `Refusée par ${currentUser.name}`, ref_type: 'order', ref_id: validateTarget.id });
      }
      await logAudit(currentUser.id, currentUser.name, 'order_rejected', 'order', validateTarget.id, { order: validateTarget.orderNumber } as Json);
    }
    setValidateTarget(null);
    fetchOrders();
  };

  const handleValidate = (approved: boolean, reason?: string) => {
    if (isChefRole) return handleChefApprove(approved, reason);
    return handleManagerConfirm(approved, reason);
  };

  // ─── Filtered orders ──────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = !search || o.supplier.toLowerCase().includes(search.toLowerCase()) || o.orderNumber.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pendingCount = orders.filter((o) => o.status === 'pending' || o.status === 'chef_approved').length;
  const waitingCount = orders.filter((o) => o.status === 'waiting').length;

  const statusTabs = [
    { id: 'all', label: 'Toutes' },
    { id: 'draft', label: 'Brouillons' },
    { id: 'waiting', label: 'En attente', count: waitingCount },
    { id: 'in_transit', label: 'En cours' },
    { id: 'delivered', label: 'Livrées' },
    { id: 'validated', label: 'Validées' },
    { id: 'rejected', label: 'Refusées' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Commandes</h2>
          {pendingCount > 0 && canManage && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/25">
              {pendingCount} à valider
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchOrders} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Import commande */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-foreground text-xs font-semibold cursor-pointer hover:bg-muted border border-border">
            <Upload className="w-3.5 h-3.5" /> Importer commande
            <input ref={importRef} type="file" accept=".csv,.xlsx,.xls,.pdf,.docx,.doc" className="hidden" onChange={handleOrderFileImport} />
          </label>

          {importOrderError && <p className="text-xs text-destructive">{importOrderError}</p>}

          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> Créer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher fournisseur, numéro…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:border-primary placeholder:text-muted-foreground" />
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
              filterStatus === tab.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                filterStatus === tab.id ? 'bg-primary-foreground/20' : 'bg-orange-500/20 text-orange-600'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Chargement…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Aucune commande</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Créez votre première commande</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              canManage={canManage}
              isChefRole={isChefRole}
              onValidate={setValidateTarget}
              onReceive={setDeliveryTarget}
              onExpand={() => setExpandedId(expandedId === order.id ? null : order.id)}
              expanded={expandedId === order.id}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateOrderForm onClose={() => setShowCreate(false)} onCreated={fetchOrders} />}

      {validateTarget && (
        <ValidationModal order={validateTarget} canManage={canManage} onClose={() => setValidateTarget(null)} onValidate={handleValidate} />
      )}

      {deliveryTarget && (
        <DeliveryModal
          order={deliveryTarget}
          items={deliveryTarget.items ?? []}
          onClose={() => setDeliveryTarget(null)}
          onValidated={() => { setDeliveryTarget(null); fetchOrders(); }}
        />
      )}

      {importOrderRows.length > 0 && (
        <ImportOrderModal
          rows={importOrderRows}
          products={products.map((p) => ({ id: p.id, name: p.name, supplier: p.supplier }))}
          supplier={importOrderSupplier}
          setSupplier={setImportOrderSupplier}
          onConfirm={handleImportOrderConfirm}
          onCancel={() => { setImportOrderRows([]); setImportOrderError(''); }}
          loading={importOrderLoading}
          onRowOverride={handleRowOverride}
        />
      )}
    </div>
  );
}
