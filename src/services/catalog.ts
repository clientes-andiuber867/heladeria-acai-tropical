import { supabase } from "../lib/supabase";
import { generateUUID } from "../lib/uuid";
import type { Product, ProductInput } from "../types";
export async function getProducts(includeArchived = false): Promise<Product[]> {
  let query = supabase.from("products").select("*").order("created_at");
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
export async function saveProduct(input: ProductInput, id?: string) {
  const query = id
    ? supabase.from("products").update(input).eq("id", id)
    : supabase.from("products").insert(input);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data as Product;
}
export async function setProductState(
  id: string,
  patch: { available?: boolean; archived?: boolean },
) {
  if (patch.available !== undefined && patch.archived === undefined) {
    const { error: rpcError } = await supabase.rpc(
      "toggle_product_availability",
      {
        p_id: id,
        p_available: patch.available,
      },
    );
    if (rpcError) throw rpcError;
    return { id, available: patch.available };
  }

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
export async function uploadProductImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Usa una imagen JPG, PNG o WebP.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("La imagen debe pesar menos de 5 MB.");
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `products/${generateUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "3600", contentType: file.type });
  if (error) throw error;
  return {
    path,
    url: supabase.storage.from("product-images").getPublicUrl(path).data
      .publicUrl,
  };
}
export async function removeUploadedImage(path: string) {
  const { error } = await supabase.storage
    .from("product-images")
    .remove([path]);
  if (error) throw error;
}

export async function getCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data || []).map((c) => c.name);
}
export async function saveCategory(name: string, previous?: string) {
  const query = previous
    ? supabase
        .from("categories")
        .update({ name: name.trim() })
        .eq("name", previous)
    : supabase.from("categories").insert({ name: name.trim() });
  const { error } = await query.select().single();
  if (error) throw error;
}
export async function deleteCategory(name: string, replacement: string) {
  const { error } = await supabase.rpc("delete_category", {
    p_name: name,
    p_replacement: replacement || null,
  });
  if (error) throw error;
}
