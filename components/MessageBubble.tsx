import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  children: ReactNode;
};

export function MessageBubble({ role, children }: Props) {
  const isUser = role === "user";
  return (
    <div className={cn("flex w-full mb-3", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-4 py-2 text-sm shadow-sm border",
          isUser
            ? "bg-accent text-white border-accentSoft"
            : "bg-card/60 border-gray-800 text-gray-100"
        )}
      >
        {children}
      </div>
    </div>
  );
}

