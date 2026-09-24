import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { InventoryItem } from "@/lib/types";
import { ItemForm } from "../../item-form";

export const metadata = { title: "在庫品目の編集" };

export default async function EditInventoryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-xl font-semibold">在庫品目の編集</h1>
      <ItemForm item={data as InventoryItem} />
    </div>
  );
}
