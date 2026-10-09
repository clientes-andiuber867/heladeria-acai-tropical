import { useEffect, useState } from "react";
import {
  Leaf,
  Heart,
  ShoppingBag,
  ArrowRight,
  ScanLine,
  MessageCircle,
} from "lucide-react";
import { PublicOrder } from "./PublicOrder";
import { orderTotal, type OrderLine } from "./orderHelpers";
import { money } from "../../lib/format";
import "./publicOrder.css";
import { Brand } from "../../components/Brand";
import { ProductCatalog } from "../catalog/ProductCatalog";
import { useCatalog } from "../../context/CatalogContext";
export function PublicMenu() {
  const { products, loading, refresh } = useCatalog();
  const [open, setOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [cart, setCart] = useState<OrderLine[]>(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("tropical-public-order") || "[]",
      );
      return Array.isArray(saved)
        ? saved
            .filter(
              (l) =>
                typeof l?.product?.id === "string" &&
                typeof l.product.name === "string" &&
                Number.isFinite(Number(l.product.price)) &&
                Number(l.product.price) >= 0 &&
                Number.isInteger(l.quantity) &&
                l.quantity > 0 &&
                l.quantity <= 99,
            )
            .slice(0, 50)
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("tropical-public-order", JSON.stringify(cart));
    } catch {
      /* Ordering also works without browser storage. */
    }
  }, [cart]);
  const lines = cart.map((line) => ({
    ...line,
    product: products.find((p) => p.id === line.product.id) || {
      ...line.product,
      available: loading && line.product.available,
    },
  }));
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  function quantity(id: string, value: number) {
    setCart((previous) =>
      previous
        .map((l) =>
          l.product.id === id ? { ...l, quantity: Math.min(99, value) } : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }
  return (
    <div className={`public-menu ${ordering ? "is-ordering" : ""}`}>
      <header>
        <a href="/menu" aria-label="Inicio de la carta">
          <Brand />
        </a>
        <span className="public-tag">
          <Leaf size={16} /> Fresco. Tropical. Delicioso.
        </span>
      </header>
      <section className="menu-hero">
        <div>
          <span className="eyebrow">BIENVENIDO A TU LUGAR FELIZ</span>
          <h1>
            Tu antojo.
            <br />
            <em>Tu momento tropical.</em>
          </h1>
          <p>
            Açaí, helados y algo más.
            <br />
            Descubre tu próximo favorito.
          </p>
          <a className="mango-button" href="#carta">
            Explorar la carta
          </a>
          <span className="hero-label">
            <Heart size={14} /> Preparado con amor, servido con alegría.
          </span>
        </div>
        <div className="menu-logo-wrap">
          <img src="/logo.png" alt="Tropical Açaí Super Food" />
          <span className="menu-sticker">
            ¡Date un
            <br />
            <b>gustito!</b>
          </span>
        </div>
      </section>
      <div className="flavor-strip" aria-hidden="true">
        <span>AÇAÍ CON ENERGÍA</span>
        <span>✦</span>
        <span>HELADOS CON ALEGRÍA</span>
        <span>✦</span>
        <span>MOMENTOS CON SABOR</span>
        <span>✦</span>
        <span>SIEMPRE TROPICAL</span>
      </div>
      <main id="carta">
        <div className="section-title">
          <div>
            <span className="eyebrow">NUESTRA CARTA</span>
            <h2>¿Qué se te antoja hoy?</h2>
          </div>
          <div className="public-menu-actions">
            <span className="muted">
              {products.filter((p) => p.available).length} disponibles · Precios
              en Bs
            </span>
            <button
              className={ordering ? "secondary" : "public-start-order"}
              onClick={() => {
                setOrdering(!ordering);
                setNotice("");
              }}
              aria-pressed={ordering}
            >
              <ShoppingBag size={18} />
              {ordering ? "Solo ver la carta" : "Hacer pedido"}
              {!ordering && <ArrowRight size={17} />}
            </button>
          </div>
        </div>
        {ordering && (
          <section
            className="public-order-guide"
            aria-label="Cómo hacer tu pedido"
          >
            <div className="order-guide-heading">
              <span className="order-guide-mark">
                <ShoppingBag size={24} />
              </span>
              <div>
                <span className="order-guide-kicker">
                  DE NUESTRA CARTA A TU MESA
                </span>
                <h3>Tu antojo, en tres pasos.</h3>
                <p>Elige lo que te gusta. Nosotros ponemos el sabor.</p>
              </div>
              <span className="order-guide-channel">
                <MessageCircle size={15} /> Pedidos por WhatsApp
              </span>
            </div>
            <ol className="order-guide-steps">
              <li>
                <span className="order-guide-number">01</span>
                <div>
                  <strong>Elige tus favoritos</strong>
                  <p>Usa el botón + y ajusta las cantidades en tu pedido.</p>
                </div>
                <ShoppingBag size={19} />
              </li>
              <li>
                <span className="order-guide-number">02</span>
                <div>
                  <strong>Revisa y paga con QR</strong>
                  <p>Abre «Ver mi pedido» para consultar el total y el QR.</p>
                </div>
                <ScanLine size={19} />
              </li>
              <li>
                <span className="order-guide-number">03</span>
                <div>
                  <strong>Envíalo por WhatsApp</strong>
                  <p>
                    Adjunta tu comprobante. Confirmaremos el pedido por el chat.
                  </p>
                </div>
                <MessageCircle size={19} />
              </li>
            </ol>
          </section>
        )}
        <ProductCatalog
          onAdd={
            ordering
              ? (product) => {
                  if (!product.available) return;
                  const existing = cart.find(
                    (l) => l.product.id === product.id,
                  );
                  if (existing && existing.quantity >= 99) {
                    setNotice("Puedes pedir hasta 99 unidades por producto.");
                    return;
                  }
                  if (!existing && cart.length >= 50) {
                    setNotice(
                      "Puedes incluir hasta 50 productos diferentes por pedido.",
                    );
                    return;
                  }
                  setCart((previous) =>
                    previous.some((l) => l.product.id === product.id)
                      ? previous.map((l) =>
                          l.product.id === product.id
                            ? {
                                ...l,
                                product,
                                quantity: Math.min(99, l.quantity + 1),
                              }
                            : l,
                        )
                      : [...previous, { product, quantity: 1 }],
                  );
                  setNotice(`${product.name} agregado a tu pedido`);
                }
              : undefined
          }
        />
        <p className="order-live-notice" role="status">
          {notice}
        </p>
      </main>
      <footer>
        <Brand />
        <p>Sabores que alegran tu día. ♥</p>
        <a className="text-button" href="/">
          Acceso al equipo
        </a>
      </footer>
      {ordering && (
        <button className="public-order-bar" onClick={() => setOpen(true)}>
          <span className="order-bag-count">
            <ShoppingBag size={21} />
            {count}
          </span>
          <span>
            Ver mi pedido<strong>{money(orderTotal(lines))}</strong>
          </span>
          <ArrowRight size={21} />
        </button>
      )}
      {open && (
        <PublicOrder
          lines={lines}
          onQuantity={quantity}
          onClose={() => setOpen(false)}
          refreshCatalog={refresh}
        />
      )}
    </div>
  );
}
