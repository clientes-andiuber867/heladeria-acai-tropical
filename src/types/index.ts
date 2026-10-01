export type Role = "admin" | "cashier";
export type Profile = {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  active: boolean;
  must_change_password: boolean;
};
export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string | null;
  available: boolean;
  archived: boolean;
  updated_at: string;
};
export type ProductInput = Pick<
  Product,
  "name" | "description" | "price" | "category" | "image" | "available"
>;
export type SaleItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
};
export type Sale = {
  id: string;
  created_at: string;
  cashier_id: string;
  cashier_name: string;
  payment_method: "Efectivo" | "QR" | "Mixto";
  cash_amount: number;
  qr_amount: number;
  qr_recipient: string | null;
  qr_path: string | null;
  total: number;
  cash_received: number | null;
  note: string;
  status: "completed" | "voided";
  void_reason: string | null;
  sale_items: SaleItem[];
};
export type AuditEvent = {
  id: string;
  created_at: string;
  actor_name: string;
  action: string;
  entity_id: string;
  detail: Record<string, any>;
  total_count?: number;
};
export type CartItem = { product: Product; quantity: number };
export type DashboardData = {
  revenue: number;
  orders: number;
  cash: number;
  qr: number;
  voided: number;
  series: { label: string; total: number }[];
  popular: { name: string; quantity: number; total: number }[];
  recent: Sale[];
};
