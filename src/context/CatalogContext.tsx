import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getProducts, getCategories } from "../services/catalog";
import { supabase } from "../lib/supabase";
import { errorMessage } from "../lib/format";
import type { Product } from "../types";
const Context = createContext<{
  products: Product[];
  categories: string[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}>({
  categories: [],
  products: [],
  loading: true,
  error: "",
  refresh: async () => {},
});
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [items, sections] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(items);
      setCategories(sections);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel("catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => {
          void refresh();
        },
      )
      .subscribe();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  return (
    <Context.Provider value={{ categories, products, loading, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useCatalog = () => useContext(Context);
