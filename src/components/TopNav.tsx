import { LogOut, Search, Sun, Moon, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { useTheme } from "@/contexts/ThemeContext";
import { BRAND } from "@/lib/brand";

const roleBadgeVariant: Record<string, string> = {
  owner: "bg-destructive/15 text-destructive border border-destructive/20",
  admin: "bg-primary/15 text-primary border border-primary/20",
  team: "bg-success/15 text-success border border-success/20",
};

interface TopNavProps {
  onMenuClick?: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-3 sm:h-16 sm:px-6">
      {/* Left side */}
      <div className="flex items-center gap-2 sm:gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary font-display text-xs font-bold text-primary-foreground">
            A
          </div>
        </div>

        <div className="relative hidden sm:block sm:w-64 lg:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads, clients, systems..."
            className="h-9 border-border/50 bg-secondary/30 pl-9 text-sm placeholder:text-muted-foreground/60 focus:bg-secondary/50 transition-colors"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        <button className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground sm:hidden">
          <Search className="h-5 w-5" />
        </button>

        <button
          onClick={toggleTheme}
          className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-secondary/50 hover:text-foreground"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <NotificationDropdown />

        <div className="flex items-center gap-2.5 sm:gap-3 ml-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary font-display text-sm font-bold text-primary-foreground shadow-md shadow-primary/20">
            {profile?.name?.charAt(0) || "?"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none text-foreground">{profile?.name || "User"}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{BRAND.shortName} Workspace</p>
            <span className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${roleBadgeVariant[profile?.role || "team"]}`}>
              {profile?.role || "team"}
            </span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
