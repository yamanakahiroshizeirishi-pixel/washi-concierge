// データベースの行型とアプリ共通型

export type Product = {
  id: string;
  product_code: string;
  name: string;
  short_description: string | null;
  detailed_description: string | null;
  category: string;
  usage_tags: string[];
  color_tags: string[];
  pattern_tags: string[];
  material: string | null;
  production_method: string | null;
  origin: string | null;
  manufacturer: string | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness: string | null;
  weight_gsm: number | null;
  strength_level: number | null;
  transparency_level: number | null;
  texture: string | null;
  inkjet_compatible: boolean;
  laser_printer_compatible: boolean;
  calligraphy_compatible: boolean;
  food_contact_compatible: boolean;
  water_resistant: boolean;
  heat_resistant: boolean;
  indoor_compatible: boolean;
  outdoor_compatible: boolean;
  price: number;
  tax_included_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  minimum_order_quantity: number;
  image_urls: string[];
  purchase_url: string | null;
  caution_notes: string | null;
  recommended_uses: string[];
  prohibited_uses: string[];
  is_published: boolean;
  translations: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RelatedProductInfo = {
  id: string;
  name: string;
  category: string;
  tax_included_price: number;
  stock_quantity: number;
  purchase_url: string | null;
  relation_type: string;
};

export type ScoreBreakdown = {
  usage: number;
  size: number;
  budget: number;
  color: number;
  pattern: number;
  thickness: number;
  stock: number;
  total: number;
  reasons: string[];
};

export type QuantityEstimate = {
  sheets: number; // 予備込みの必要枚数
  perUnit: number | null; // 1個(1枚・1面)あたりの枚数
  explanation: string; // 計算方法と前提の説明
};

export type RecommendedItem = {
  product: Product;
  score: ScoreBreakdown;
  quantity: QuantityEstimate | null;
  estimatedTotal: number | null; // 概算金額(税込)
  lowStock: boolean;
  related: RelatedProductInfo[];
};

export type AppSettings = {
  id: number;
  store_name: string;
  app_name: string;
  logo_url: string | null;
  ai_notes: string | null;
  fiscal_year_start_month: number;
};

// ============ 在庫管理・発注管理 ============

export type InventoryChannel = {
  id: string;
  name: string;
  channel_type: "external" | "internal";
  display_order: number;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  sku: string | null;
  name: string;
  supplier_name: string | null;
  purchase_price: number;
  wholesale_price: number | null;
  low_stock_threshold: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type MovementType =
  | "incoming"
  | "shipment"
  | "return_in"
  | "return_disposal"
  | "return_tester"
  | "disposal";

export type InventoryMovement = {
  id: string;
  item_id: string;
  channel_id: string | null;
  movement_type: MovementType;
  quantity: number;
  occurred_on: string; // YYYY-MM-DD
  note: string | null;
  purchase_order_line_id: string | null;
  created_at: string;
};

export type PurchaseOrderStatus = "draft" | "confirmed" | "closed";

export type PurchaseOrder = {
  id: string;
  order_no: string | null;
  channel_id: string | null;
  order_date: string; // YYYY-MM-DD
  status: PurchaseOrderStatus;
  source_filename: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderLineStatus =
  | "pending"
  | "fulfilled"
  | "partial"
  | "carried_over";

export type PurchaseOrderLine = {
  id: string;
  purchase_order_id: string;
  item_id: string | null;
  raw_item_name: string;
  ordered_qty: number;
  fulfilled_qty: number;
  carried_over_qty: number;
  status: PurchaseOrderLineStatus;
  target_month: string | null; // YYYY-MM-01
  decision_note: string | null;
  decided_at: string | null;
  shipment_movement_id: string | null;
  created_at: string;
};

export type ConsultationLog = {
  id: string;
  session_id: string;
  source: string;
  customer_question: string | null;
  extracted_conditions: Record<string, unknown> | null;
  ai_response: string | null;
  recommended_product_ids: string[];
  recommendation_scores: unknown;
  could_not_answer: boolean;
  clicked_product_id: string | null;
  created_at: string;
};
