"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsClient() {
  const [storeName, setStoreName] = useState("");
  const [appName, setAppName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState("");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(10);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setStoreName(data.store_name ?? "");
        setAppName(data.app_name ?? "");
        setLogoUrl(data.logo_url);
        setAiNotes(data.ai_notes ?? "");
        setFiscalYearStartMonth(data.fiscal_year_start_month ?? 10);
      }
    })();
  }, []);

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `logo/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file);
      if (error) throw new Error(error.message);
      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (e) {
      setMessage(
        `ロゴのアップロードに失敗しました: ${e instanceof Error ? e.message : ""}`
      );
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({
        store_name: storeName || "和紙の店",
        app_name: appName || "AI和紙コンシェルジュ",
        logo_url: logoUrl,
        ai_notes: aiNotes || null,
        fiscal_year_start_month: fiscalYearStartMonth,
      })
      .eq("id", 1);
    setMessage(
      error ? `保存に失敗しました: ${error.message}` : "設定を保存しました。"
    );
    setSaving(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-serif text-xl font-semibold">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">店舗情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="store-name">店名</Label>
            <Input
              id="store-name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="mt-1 bg-card"
            />
          </div>
          <div>
            <Label htmlFor="app-name">アプリ名</Label>
            <Input
              id="app-name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="mt-1 bg-card"
            />
          </div>
          <div>
            <Label htmlFor="logo">ロゴ画像</Label>
            <div className="mt-1 flex items-center gap-3">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="現在のロゴ"
                  className="h-12 w-12 rounded-full border object-cover"
                />
              )}
              <Input
                id="logo"
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                  e.target.value = "";
                }}
                className="max-w-sm bg-card"
              />
              {logoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLogoUrl(null)}
                >
                  ロゴを外す
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AIが回答するときの注意事項</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            ここに書いた内容は、AI販売員への追加指示としてすべての回答に反映されます。
            （例：「当店では送料についての質問には『店舗までお問い合わせください』と答える」）
          </p>
          <Textarea
            value={aiNotes}
            onChange={(e) => setAiNotes(e.target.value)}
            rows={5}
            className="bg-card"
            aria-label="AIへの注意事項"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">在庫管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="fiscal-year-start-month">会計年度の開始月</Label>
          <p className="text-sm text-muted-foreground">
            在庫台帳（在庫管理の月次表）の年度区切りに使います。例: 10月始まりなら10月〜翌9月が1年度になります。
          </p>
          <select
            id="fiscal-year-start-month"
            value={fiscalYearStartMonth}
            onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
            className="h-9 w-32 rounded-lg border bg-card px-3 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {message && (
        <p className="rounded-md bg-secondary p-2 text-sm">{message}</p>
      )}

      <Button size="lg" onClick={save} disabled={saving}>
        {saving ? "保存中…" : "設定を保存する"}
      </Button>
    </div>
  );
}
