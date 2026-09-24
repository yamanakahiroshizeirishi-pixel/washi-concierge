import { ItemForm } from "../item-form";

export const metadata = { title: "在庫品目の登録" };

export default function NewInventoryItemPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-xl font-semibold">在庫品目の登録</h1>
      <ItemForm item={null} />
    </div>
  );
}
