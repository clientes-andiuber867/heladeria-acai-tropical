import { Leaf, Heart } from "lucide-react";
import { Brand } from "../../components/Brand";
import { ProductCatalog } from "../catalog/ProductCatalog";
import { useCatalog } from "../../context/CatalogContext";
export function PublicMenu() {
  const { products } = useCatalog();
  return (
    <div className="public-menu">
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
          <span className="muted">
            {products.filter((p) => p.available).length} disponibles · Precios
            en Bs
          </span>
        </div>
        <ProductCatalog />
      </main>
      <footer>
        <Brand />
        <p>Sabores que alegran tu día. ♥</p>
        <a className="text-button" href="/">
          Acceso al equipo
        </a>
      </footer>
    </div>
  );
}
