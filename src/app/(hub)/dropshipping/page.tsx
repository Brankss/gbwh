"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Empty, Field, List, Modal, PageBody, PageHeader, Pills, Stat, StatGrid, Tabs, inputClass } from "@/components/kit";
import { MediaPicker, Thumb } from "@/components/media-grid";
import { eur, send, useApi } from "@/lib/client";
import { AD_PLATFORMS, AD_STATUS, PRODUCT_STATUS, type Ad, type MediaRef, type Product } from "@/lib/schemas";

const roas = (spend?: number, revenue?: number) => (spend && revenue !== undefined ? revenue / spend : undefined);
const fmtRoas = (r?: number) => (r === undefined ? "—" : `${r.toLocaleString("it-IT", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}×`);
const margin = (p: Product) => (p.price !== undefined && p.cost !== undefined ? p.price - p.cost : undefined);

export default function DropshippingPage() {
  const products = useApi<{ items: Product[] }>("/api/c/products");
  const ads = useApi<{ items: Ad[] }>("/api/c/ads");
  const [tab, setTab] = useState<"prodotti" | "pubblicita">("prodotti");
  const [editProduct, setEditProduct] = useState<Product | "new" | null>(null);
  const [editAd, setEditAd] = useState<Ad | "new" | null>(null);

  const productList = products.data?.items ?? [];
  const adList = ads.data?.items ?? [];
  const live = adList.filter((a) => a.status === "attiva");
  const spend = adList.reduce((s, a) => s + (a.spend ?? 0), 0);
  const revenue = adList.reduce((s, a) => s + (a.revenue ?? 0), 0);

  return (
    <>
      <PageHeader
        wide
        title="Dropshipping"
        subtitle="Prodotti e pubblicità, collegati"
        actions={
          <Button icon="plus" onClick={() => (tab === "prodotti" ? setEditProduct("new") : setEditAd("new"))}>
            {tab === "prodotti" ? "Prodotto" : "Pubblicità"}
          </Button>
        }
      />
      <PageBody wide>
        <StatGrid>
          <Stat label="Prodotti" value={productList.length} hint={`${productList.filter((p) => p.status === "vincente").length} vincenti`} />
          <Stat label="Ads attive" value={live.length} hint={`${adList.length} in totale`} />
          <Stat label="Spesa totale" value={eur(spend)} hint="tutte le ads" />
          <Stat label="ROAS totale" value={fmtRoas(roas(spend, revenue))} hint={`ricavi ${eur(revenue)}`} />
        </StatGrid>

        <div className="space-y-4">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "prodotti", label: "Prodotti", count: productList.length },
              { value: "pubblicita", label: "Pubblicità", count: adList.length },
            ]}
          />

          {tab === "prodotti" ? (
            <ProductList products={productList} ads={adList} loading={!products.data} onOpen={setEditProduct} />
          ) : (
            <AdList ads={adList} products={productList} loading={!ads.data} onOpen={setEditAd} />
          )}
        </div>
      </PageBody>

      {editProduct && <ProductEditor product={editProduct === "new" ? undefined : editProduct} ads={adList} onClose={() => setEditProduct(null)} />}
      {editAd && <AdEditor ad={editAd === "new" ? undefined : editAd} products={productList} onClose={() => setEditAd(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

function ProductList({ products, ads, loading, onOpen }: { products: Product[]; ads: Ad[]; loading: boolean; onOpen: (p: Product) => void }) {
  const [status, setStatus] = useState<"tutti" | Product["status"]>("tutti");
  if (loading) return <div className="skeleton h-40 rounded-2xl" />;
  if (!products.length) return <Empty icon="cart" title="Nessun prodotto">Aggiungi i prodotti che stai valutando o testando.</Empty>;
  const shown = status === "tutti" ? products : products.filter((p) => p.status === status);

  return (
    <>
      <Pills
        label="Filtra per stato"
        value={status}
        onChange={setStatus}
        options={[{ value: "tutti" as const, label: "Tutti" }, ...PRODUCT_STATUS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), count: products.filter((p) => p.status === s).length }))]}
      />
      <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => {
          const own = ads.filter((a) => a.productId === p.id);
          const s = own.reduce((n, a) => n + (a.spend ?? 0), 0);
          const r = own.reduce((n, a) => n + (a.revenue ?? 0), 0);
          const cover = p.media[0];
          return (
            <button key={p.id} onClick={() => onOpen(p)} className="panel lift flex flex-col rounded-2xl text-left">
              <div className="flex w-full gap-3 p-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                  {cover ? <Thumb item={cover} /> : <span className="grid size-full place-items-center text-muted"><Icon name="cart" /></span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-xs text-muted first-letter:uppercase">{p.status}</div>
                  <div className="mt-1.5 text-sm tabular-nums">
                    {eur(p.price)} <span className="text-muted">· margine {eur(margin(p))}</span>
                  </div>
                </div>
              </div>
              <div className="mt-auto flex w-full justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
                <span>
                  {own.length} ads · {p.media.length} media
                </span>
                <span className="tabular-nums">ROAS {fmtRoas(roas(s, r))}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function AdList({ ads, products, loading, onOpen }: { ads: Ad[]; products: Product[]; loading: boolean; onOpen: (a: Ad) => void }) {
  const [status, setStatus] = useState<"tutte" | Ad["status"]>("tutte");
  if (loading) return <div className="skeleton h-40 rounded-2xl" />;
  if (!ads.length) return <Empty icon="spark" title="Nessuna pubblicità">Crea una pubblicità e collegala a un prodotto e ai video dei bot.</Empty>;
  const shown = status === "tutte" ? ads : ads.filter((a) => a.status === status);

  return (
    <>
      <Pills
        label="Filtra per stato"
        value={status}
        onChange={setStatus}
        options={[{ value: "tutte" as const, label: "Tutte" }, ...AD_STATUS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), count: ads.filter((a) => a.status === s).length }))]}
      />
      <List className="stagger">
        {shown.map((a) => {
          const product = products.find((p) => p.id === a.productId);
          return (
            <button key={a.id} onClick={() => onOpen(a)} className="row-link flex w-full items-center gap-3 px-4 py-3 text-left">
              <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                {a.media[0] ? <Thumb item={a.media[0]} /> : <span className="grid size-full place-items-center text-muted"><Icon name="spark" /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.name}</div>
                <div className="truncate text-xs text-muted">
                  {a.platform} · {a.status}
                  {product ? ` · ${product.name}` : ""}
                </div>
              </div>
              <div className="text-right text-sm tabular-nums">
                <div className="font-medium">{fmtRoas(roas(a.spend, a.revenue))}</div>
                <div className="text-xs text-muted">{eur(a.spend)}</div>
              </div>
            </button>
          );
        })}
      </List>
    </>
  );
}

/* ------------------------------------------------------------------ */

const toNum = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
const numStr = (n?: number) => (n === undefined ? "" : String(n));

function MediaField({ value, onChange }: { value: MediaRef[]; onChange: (v: MediaRef[]) => void }) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-soft">Media collegati</div>
      <div className="grid grid-cols-4 gap-2">
        {value.map((m) => (
          <div key={m.id} className="relative">
            <Thumb item={m} />
            <button
              type="button"
              aria-label="Togli"
              onClick={() => onChange(value.filter((x) => x.id !== m.id))}
              className="hit absolute! -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-white text-black shadow-[0_0_0_2px_#0a0a0a]"
            >
              <Icon name="close" className="size-3" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setPicking(true)} className="grid aspect-square place-items-center rounded-xl border border-dashed border-white/15 text-muted transition-colors hover:border-white/30 hover:text-fg" aria-label="Aggiungi media">
          <Icon name="plus" />
        </button>
      </div>
      {picking && <MediaPicker value={value} onChange={onChange} onClose={() => setPicking(false)} />}
    </div>
  );
}

function useSave(onClose: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

function ProductEditor({ product, ads, onClose }: { product?: Product; ads: Ad[]; onClose: () => void }) {
  const [f, setF] = useState({
    name: product?.name ?? "",
    status: product?.status ?? "idea",
    cost: numStr(product?.cost),
    price: numStr(product?.price),
    supplierUrl: product?.supplierUrl ?? "",
    storeUrl: product?.storeUrl ?? "",
    notes: product?.notes ?? "",
  });
  const [media, setMedia] = useState<MediaRef[]>(product?.media ?? []);
  const { error, busy, run } = useSave(onClose);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const own = product ? ads.filter((a) => a.productId === product.id) : [];
  const m = toNum(f.price) !== undefined && toNum(f.cost) !== undefined ? toNum(f.price)! - toNum(f.cost)! : undefined;

  const body = { ...f, cost: toNum(f.cost), price: toNum(f.price), media };
  const refresh = ["/api/c/products", "/api/c/ads"];

  return (
    <Modal
      title={product ? product.name : "Nuovo prodotto"}
      onClose={onClose}
      footer={
        <>
          {product && (
            <span className="mr-auto">
              <Button variant="danger" small icon="trash" label="Elimina prodotto" onClick={() => confirm("Eliminare il prodotto?") && run(() => send("DELETE", `/api/c/products/${product.id}`, undefined, refresh))} />
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button
            disabled={!f.name.trim() || busy}
            onClick={() => run(() => (product ? send("PATCH", `/api/c/products/${product.id}`, body, refresh) : send("POST", "/api/c/products", body, refresh)))}
          >
            Salva
          </Button>
        </>
      }
    >
      <Field label="Nome">
        <input className={inputClass} value={f.name} onChange={set("name")} autoFocus={!product} />
      </Field>
      <div className="grid grid-cols-3 items-end gap-3">
        <Field label="Stato">
          <select className={inputClass} value={f.status} onChange={set("status")}>
            {PRODUCT_STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Costo €">
          <input className={inputClass} inputMode="decimal" value={f.cost} onChange={set("cost")} />
        </Field>
        <Field label="Prezzo €" hint={m !== undefined ? `margine ${eur(m)}` : undefined}>
          <input className={inputClass} inputMode="decimal" value={f.price} onChange={set("price")} />
        </Field>
      </div>
      <Field label="Link fornitore">
        <input className={inputClass} value={f.supplierUrl} onChange={set("supplierUrl")} placeholder="https://…" />
      </Field>
      <Field label="Link nello store">
        <input className={inputClass} value={f.storeUrl} onChange={set("storeUrl")} placeholder="https://…" />
      </Field>
      <MediaField value={media} onChange={setMedia} />
      <Field label="Note">
        <textarea className={`${inputClass} min-h-20 resize-y`} value={f.notes} onChange={set("notes")} />
      </Field>
      {own.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-soft">Pubblicità di questo prodotto</div>
          {own.map((a) => (
            <div key={a.id} className="flex justify-between text-sm">
              <span className="truncate">{a.name} <span className="text-muted">· {a.status}</span></span>
              <span className="tabular-nums">{fmtRoas(roas(a.spend, a.revenue))}</span>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}

function AdEditor({ ad, products, onClose }: { ad?: Ad; products: Product[]; onClose: () => void }) {
  const [f, setF] = useState({
    name: ad?.name ?? "",
    productId: ad?.productId ?? "",
    platform: ad?.platform ?? "TikTok",
    status: ad?.status ?? "bozza",
    budget: numStr(ad?.budget),
    spend: numStr(ad?.spend),
    revenue: numStr(ad?.revenue),
    clicks: numStr(ad?.clicks),
    purchases: numStr(ad?.purchases),
    notes: ad?.notes ?? "",
  });
  const [media, setMedia] = useState<MediaRef[]>(ad?.media ?? []);
  const { error, busy, run } = useSave(onClose);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const body = {
    ...f,
    budget: toNum(f.budget),
    spend: toNum(f.spend),
    revenue: toNum(f.revenue),
    clicks: toNum(f.clicks),
    purchases: toNum(f.purchases),
    media,
  };
  const refresh = ["/api/c/ads", "/api/c/products"];
  const r = roas(toNum(f.spend), toNum(f.revenue));

  return (
    <Modal
      title={ad ? ad.name : "Nuova pubblicità"}
      onClose={onClose}
      footer={
        <>
          {ad && (
            <span className="mr-auto">
              <Button variant="danger" small icon="trash" label="Elimina pubblicità" onClick={() => confirm("Eliminare la pubblicità?") && run(() => send("DELETE", `/api/c/ads/${ad.id}`, undefined, refresh))} />
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button
            disabled={!f.name.trim() || busy}
            onClick={() => run(() => (ad ? send("PATCH", `/api/c/ads/${ad.id}`, body, refresh) : send("POST", "/api/c/ads", body, refresh)))}
          >
            Salva
          </Button>
        </>
      }
    >
      <Field label="Nome">
        <input className={inputClass} value={f.name} onChange={set("name")} autoFocus={!ad} placeholder="Es. Hook 3s – UGC" />
      </Field>
      <Field label="Prodotto">
        <select className={inputClass} value={f.productId} onChange={set("productId")}>
          <option value="">— nessuno —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Piattaforma">
          <select className={inputClass} value={f.platform} onChange={set("platform")}>
            {AD_PLATFORMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Stato">
          <select className={inputClass} value={f.status} onChange={set("status")}>
            {AD_STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 items-end gap-3">
        <Field label="Budget €">
          <input className={inputClass} inputMode="decimal" value={f.budget} onChange={set("budget")} />
        </Field>
        <Field label="Spesa €">
          <input className={inputClass} inputMode="decimal" value={f.spend} onChange={set("spend")} />
        </Field>
        <Field label="Ricavi €" hint={r !== undefined ? `ROAS ${fmtRoas(r)}` : undefined}>
          <input className={inputClass} inputMode="decimal" value={f.revenue} onChange={set("revenue")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Click">
          <input className={inputClass} inputMode="numeric" value={f.clicks} onChange={set("clicks")} />
        </Field>
        <Field label="Acquisti">
          <input className={inputClass} inputMode="numeric" value={f.purchases} onChange={set("purchases")} />
        </Field>
      </div>
      <MediaField value={media} onChange={setMedia} />
      <Field label="Note">
        <textarea className={`${inputClass} min-h-20 resize-y`} value={f.notes} onChange={set("notes")} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
