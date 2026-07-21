import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ChatClient } from "./chat-client";

export const metadata = { title: "AIに相談する" };

export default function ChatPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <Suspense>
          <ChatClient />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
