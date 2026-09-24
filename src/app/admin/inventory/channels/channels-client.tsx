"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { InventoryChannelInputSchema } from "@/lib/inventory-schema";
import type { InventoryChannel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Trash2 } from "lucide-react";

type Raw = { name: string; channel_type: "external" | "internal"; display_order: string };

export function ChannelsClient() {
  const [channels, setChannels] = useState<InventoryChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const { register, handleSubmit, reset } = useForm<Raw>({
    defaultValues: { name: "", channel_type: "external", display_order: "0" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("inventory_channels")
      .select("*")
      .order("display_order")
      .order("name");
    if (error) setMessage(`読み込みに失敗しました: ${error.message}`);
    setChannels((data ?? []) as InventoryChannel[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (raw: Raw) => {
    setErrors([]);
    const parsed = InventoryChannelInputSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("inventory_channels").insert(parsed.data);
    if (error) {
      setErrors([
        error.code === "23505"
          ? "同じ名前のチャンネルが既に存在します。"
          : `登録に失敗しました: ${error.message}`,
      ]);
      return;
    }
    reset();
    load();
  };

  const remove = async (channel: InventoryChannel) => {
    if (!window.confirm(`「${channel.name}」を削除します。よろしいですか？`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("inventory_channels").delete().eq("id", channel.id);
    if (error) {
      setMessage(`削除に失敗しました: ${error.message}（このチャンネルを使った入出庫履歴が残っている可能性があります）`);
      return;
    }
    setChannels((prev) => prev.filter((c) => c.id !== channel.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-semibold">出荷先チャンネル管理</h1>
        <Button variant="outline" render={<Link href="/admin/inventory" />}>
          <ArrowLeft aria-hidden className="size-4" />
          在庫管理へ戻る
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        出荷先（支店・卸先・ECなど）とテスター・商品見本などの社内消化先を登録します。
        「internal（社内消化）」に設定したチャンネルへの出荷は、在庫台帳で見本品費として自動集計されます。
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新規登録</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <Input placeholder="チャンネル名（例: 井田両国堂、BASE）" {...register("name")} className="bg-card" />
            <select
              {...register("channel_type")}
              className="h-9 rounded-lg border bg-card px-3 text-sm"
            >
              <option value="external">external（卸先・支店・ECなど）</option>
              <option value="internal">internal（テスター・見本・広告など社内消化）</option>
            </select>
            <Input
              type="number"
              placeholder="表示順"
              {...register("display_order")}
              className="w-24 bg-card"
            />
            <Button type="submit">追加</Button>
          </form>
          {errors.length > 0 && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm">
              <ul className="list-inside list-disc">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {message && <p className="rounded-md bg-secondary p-2 text-sm">{message}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>表示順</TableHead>
                <TableHead>チャンネル名</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.display_order}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    {c.channel_type === "internal" ? (
                      <Badge variant="secondary">internal（社内消化）</Badge>
                    ) : (
                      <Badge variant="outline">external</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(c)}
                      aria-label={`${c.name}を削除`}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {channels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    チャンネルが登録されていません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
