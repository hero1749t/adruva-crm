import { Bell, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { currentUser } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";

const roleBadgeVariant: Record<string, string> = {
  owner: "bg-destructive/20 text-destructive",
  admin: "bg-primary/20 text-primary",
  team: "bg-success/20 text-success",
};

export function TopNav() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search leads, clients..."
          className="h-9 border-border bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 font-display text-sm font-bold text-primary">
            {currentUser.name.charAt(0)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none text-foreground">{currentUser.name}</p>
            <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${roleBadgeVariant[currentUser.role]}`}>
              {currentUser.role}
            </span>
          </div>
        </div>

        <button className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
