"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function CopyButton({
  text,
  label = "Copy",
  toastText,
}: {
  text: string;
  label?: string;
  toastText: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(toastText);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed. Select the text manually.");
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className="hit h-7 gap-1.5" onClick={copy}>
      <span aria-hidden className="relative inline-block size-4">
        <Copy
          className="absolute inset-0 transition-[opacity,scale,filter] duration-200 ease-out"
          style={{
            opacity: copied ? 0 : 1,
            scale: copied ? 0.25 : 1,
            filter: copied ? "blur(4px)" : "blur(0px)",
          }}
        />
        <Check
          className="absolute inset-0 transition-[opacity,scale,filter] duration-200 ease-out"
          style={{
            opacity: copied ? 1 : 0,
            scale: copied ? 1 : 0.25,
            filter: copied ? "blur(0px)" : "blur(4px)",
          }}
        />
      </span>
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}
