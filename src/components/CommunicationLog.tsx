import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, Mail, MessageSquare, Calendar, StickyNote,
  Send, Loader2, ArrowDownLeft, ArrowUpRight, Clock, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const typeConfig = {
  call: { icon: Phone, label: "Call", color: "bg-success/20 text-success" },
  email: { icon: Mail, label: "Email", color: "bg-primary/20 text-primary" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "bg-accent/20 text-accent" },
  meeting: { icon: Calendar, label: "Meeting", color: "bg-warning/20 text-warning" },
  note: { icon: StickyNote, label: "Note", color: "bg-muted text-muted-foreground" },
} as const;

type CommType = keyof typeof typeConfig;

interface CommunicationLogProps {
  entityType: "lead" | "client";
  entityId: string;
}

export const CommunicationLog = ({ entityType, entityId }: CommunicationLogProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const [type, setType] = useState<CommType>("call");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [duration, setDuration] = useState("");

  const queryKey = ["communication-logs", entityType, entityId];

  const { data: logs = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_logs")
        .select("*, profiles!communication_logs_created_by_fkey(name)")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addLog = useMutation({
    mutationFn: async () => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const payload: Record<string, unknown> = {
        entity_type: entityType,
        entity_id: entityId,
        type,
        direction,
        subject: subject.trim() || null,
        content: trimmed,
        created_by: profile?.id,
      };

      if (type === "call" || type === "meeting") {
        payload.duration_minutes = duration ? parseInt(duration, 10) || null : null;
      }

      const { error } = await supabase.from("communication_logs").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setContent("");
      setSubject("");
      setDuration("");
      toast({ title: "Communication logged" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to log", description: err.message, variant: "destructive" });
    },
  });

  const deleteLog = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from("communication_logs").delete().eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Log deleted" });
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
        Communication Log
      </h2>

      {/* Add Form */}
      <div className="mb-6 rounded-lg border border-border bg-muted/20 p-3">
        {/* Type selector */}
        <div className="mb-2 flex flex-wrap gap-2">
          {(Object.entries(typeConfig) as [CommType, typeof typeConfig[CommType]][]).map(([key, conf]) => {
            const Icon = conf.icon;
            return (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  type === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {conf.label}
              </button>
            );
          })}
        </div>

        {/* Direction + Duration row */}
        <div className="mb-2 flex gap-2">
          <Select value={direction} onValueChange={(v) => setDirection(v as "inbound" | "outbound")}>
            <SelectTrigger className="h-8 w-[130px] border-border bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outbound">
                <span className="flex items-center gap-1.5"><ArrowUpRight className="h-3 w-3" /> Outbound</span>
              </SelectItem>
              <SelectItem value="inbound">
                <span className="flex items-center gap-1.5"><ArrowDownLeft className="h-3 w-3" /> Inbound</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {(type === "call" || type === "meeting") && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                placeholder="min"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-8 w-[70px] border-border bg-background text-xs"
              />
            </div>
          )}
        </div>

        {/* Subject */}
        <Input
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mb-2 h-8 border-border bg-background text-sm"
        />

        {/* Content */}
        <Textarea
          placeholder={`Describe the ${typeConfig[type].label.toLowerCase()}...`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[60px] border-border bg-background text-sm"
          maxLength={2000}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">{content.length}/2000</span>
          <Button
            size="sm"
            onClick={() => addLog.mutate()}
            disabled={!content.trim() || addLog.isPending}
            className="gap-1.5"
          >
            {addLog.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Log
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No communications logged yet.
        </p>
      ) : (
        <div className="space-y-0">
          {logs.map((log: any, idx: number) => {
            const conf = typeConfig[log.type as CommType] || typeConfig.note;
            const Icon = conf.icon;
            const authorName = log.profiles?.name || "System";
            const isLast = idx === logs.length - 1;
            return (
              <div key={log.id} className="group relative flex gap-3 pb-4">
                {!isLast && (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                )}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border ${conf.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground">{authorName}</span>
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${conf.color}`}>
                      {conf.label}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {log.direction === "inbound" ? "↙ IN" : "↗ OUT"}
                    </span>
                    {log.duration_minutes && (
                      <span className="font-mono text-[9px] text-muted-foreground">{log.duration_minutes}m</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString("en-IN", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })
                        : ""}
                    </span>
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => deleteLog.mutate(log.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                  {log.subject && (
                    <p className="mt-0.5 text-xs font-medium text-foreground/70">{log.subject}</p>
                  )}
                  <p className="mt-1 text-sm text-foreground/80">{log.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
