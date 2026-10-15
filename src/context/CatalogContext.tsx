import { branchId } from "../lib/branch";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { getProducts, getCategories } from "../services/catalog";
import { supabase } from "../lib/supabase";
import { errorMessage } from "../lib/format";
import type { Product } from "../types";
import { useDocumentVisible } from "../lib/visibility";
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
  const visible = useDocumentVisible();
  const revision = useRef(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    try {
      const [items, sections] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      if (request !== revision.current) return;
      setProducts(items);
      setCategories(sections);
      setError("");
    } catch (e) {
      if (request !== revision.current) return;
      setError(errorMessage(e));
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!visible) return;
    void refresh();
    let timer: ReturnType<typeof setTimeout>;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refresh();
      }, 100);
    };
    const ch = supabase
      .channel("catalog-" + branchId())
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `branch_id=eq.${branchId()}`,
        },
        changed,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
          filter: `branch_id=eq.${branchId()}`,
        },
        changed,
      )
      .subscribe();
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(ch);

      window.removeEventListener("focus", focus);
    };
  }, [refresh, visible]);
  return (
    <Context.Provider value={{ categories, products, loading, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useCatalog = () => useContext(Context);
