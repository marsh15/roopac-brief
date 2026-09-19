"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function CopyButton({ text, toastText }: { text: string; toastText: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(toastText);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed — select the text manually.");
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5" onClick={copy}>
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
