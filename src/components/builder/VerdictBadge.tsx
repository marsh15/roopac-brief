import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CheckStatus } from "./types";

const TONE: Record<CheckStatus, { variant: "success" | "outline" | "destructive"; label: string; className?: string }> = {
  pass: { variant: "success", label: "pass" },
  review: { variant: "outline", label: "review", className: "border-accent/40 text-accent" },
  blocker: { variant: "destructive", label: "blocker" },
};

export default function VerdictBadge({ verdict, className }: { verdict: CheckStatus; className?: string }) {
  const tone = TONE[verdict];
  return (
    <Badge variant={tone.variant} className={cn(tone.className, className)}>
      {tone.label}
    </Badge>
  );
}
