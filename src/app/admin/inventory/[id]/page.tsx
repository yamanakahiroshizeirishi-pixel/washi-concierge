import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { InventoryItem } from "@/lib/types";
import { getSettings } from "@/lib/settings";
import { LedgerClient } from "./ledger-client";

export const metadata = { title: "在庫台帳" };

export default async function InventoryLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: item }, settings] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("id", id).maybeSingle(),
    getSettings(),
  ]);

  if (!item) notFound();

  return (
    <LedgerClient
      item={item as InventoryItem}
      fiscalYearStartMonth={settings.fiscal_year_start_month}
    />
  );
}
