import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PurchaseOrder } from "@/lib/types";
import { PoDetailClient } from "./po-detail-client";

export const metadata = { title: "発注書詳細" };

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle();

  if (!data) notFound();

  return <PoDetailClient order={data as PurchaseOrder} />;
}
