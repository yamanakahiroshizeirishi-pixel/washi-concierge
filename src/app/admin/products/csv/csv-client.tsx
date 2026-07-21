"use client";

import { useState } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import {
  ProductInputSchema,
  toDbRow,
  CSV_COLUMNS,
} from "@/lib/product-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload } from "lucide-react";

type RowError = { row: number; message: string };

export function CsvClient() {
  const [importing, setImporting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleImport = (file: File) => {
    setImporting(true);
    setSuccessCount(null);
    setRowErrors([]);
    setGlobalError(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const errors: RowError[] = [];
        let ok = 0;
        const supabase = createClient();

        for (let i = 0; i < result.data.length; i++) {
          const rowNumber = i + 2; // ヘッダーの次の行から
          const parsed = ProductInputSchema.safeParse(result.data[i]);
          if (!parsed.success) {
            errors.push({
              row: rowNumber,
              message: parsed.error.issues
                .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
                .join(" / "),
            });
            continue;
          }
          const { error } = await supabase
            .from("products")
            .upsert(toDbRow(parsed.data), { onConflict: "product_code" });
          if (error) {
            errors.push({ row: rowNumber, message: error.message });
          } else {
            ok++;
          }
        }
        setSuccessCount(ok);
        setRowErrors(errors);
        setImporting(false);
      },
      error: (err) => {
        setGlobalError(`CSVの読み込みに失敗しました: ${err.message}`);
        setImporting(false);
      },
    });
  };

  const handleExport = async () => {
    setGlobalError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("product_code");
    if (error) {
      setGlobalError(`エクスポートに失敗しました: ${error.message}`);
      return;
    }
    const rows = (data ?? []).map((p) => {
      const out: Record<string, unknown> = {};
      for (const col of CSV_COLUMNS) {
        const v = (p as Record<string, unknown>)[col];
        out[col] = Array.isArray(v) ? v.join(",") : (v ?? "");
      }
      return out;
    });
    const csv = Papa.unparse(rows, { columns: [...CSV_COLUMNS] });
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([
      {
        product_code: "WA-100",
        name: "サンプル和紙",
        short_description: "説明",
        detailed_description: "詳しい説明",
        category: "包装用和紙",
        usage_tags: "包装,ギフト",
        color_tags: "白",
        pattern_tags: "無地",
        material: "楮",
        production_method: "機械すき",
        origin: "岐阜県",
        manufacturer: "",
        width_mm: "640",
        height_mm: "940",
        thickness: "中厚",
        weight_gsm: "45",
        strength_level: "3",
        transparency_level: "2",
        texture: "",
        inkjet_compatible: "false",
        laser_printer_compatible: "false",
        calligraphy_compatible: "false",
        food_contact_compatible: "false",
        water_resistant: "false",
        heat_resistant: "false",
        indoor_compatible: "true",
        outdoor_compatible: "false",
        price: "300",
        tax_included_price: "330",
        stock_quantity: "10",
        low_stock_threshold: "5",
        minimum_order_quantity: "1",
        image_urls: "",
        purchase_url: "https://example.com/shop/WA-100",
        caution_notes: "",
        recommended_uses: "",
        prohibited_uses: "",
        is_published: "true",
      },
    ]);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-semibold">CSV一括登録・エクスポート</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">インポート</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            テンプレートと同じ列構成のCSV（UTF-8）をアップロードしてください。
            商品コードが既存と一致する行は上書き更新されます。
            タグ類はカンマ区切り、対応可否は true / false で指定します。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
              className="max-w-sm bg-card"
              aria-label="CSVファイルを選択"
            />
            <Button variant="outline" onClick={downloadTemplate}>
              <Download aria-hidden className="size-4" />
              テンプレートをダウンロード
            </Button>
          </div>
          {importing && (
            <p className="text-sm text-muted-foreground">
              <Upload aria-hidden className="mr-1 inline size-4" />
              取り込み中…
            </p>
          )}
          {successCount !== null && (
            <p className="rounded-md bg-secondary p-2 text-sm">
              {successCount}件を登録・更新しました。
              {rowErrors.length > 0 && `（エラー ${rowErrors.length}件）`}
            </p>
          )}
          {rowErrors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm">
              <p className="font-medium">エラーのあった行:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {rowErrors.map((e) => (
                  <li key={e.row}>
                    {e.row}行目: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">エクスポート</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            全商品（非公開含む）をCSVでダウンロードします。バックアップや一括編集にご利用ください。
          </p>
          <Button onClick={handleExport}>
            <Download aria-hidden className="size-4" />
            商品CSVをダウンロード
          </Button>
        </CardContent>
      </Card>

      {globalError && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm">{globalError}</p>
      )}
    </div>
  );
}
