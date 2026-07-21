import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { ProductForm } from "../../product-form";
import { RelatedEditor } from "./related-editor";

export const metadata = { title: "商品編集" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const product = data as Product;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-semibold">
        商品編集: {product.name}
      </h1>
      <ProductForm product={product} />
      <RelatedEditor productId={product.id} />
    </div>
  );
}
