import { ProductForm } from "../product-form";

export const metadata = { title: "商品新規登録" };

export default function NewProductPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-xl font-semibold">商品新規登録</h1>
      <ProductForm product={null} />
    </div>
  );
}
