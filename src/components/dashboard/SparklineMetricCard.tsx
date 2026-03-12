import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineMetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  sparkData?: number[];
  sparkColor?: string;
  onClick?: () => void;
}

export function SparklineMetricCard({
  icon: Icon,
  label,
  value,
  color,
  sparkData,
  sparkColor = "hsl(217, 91%, 60%)",
  onClick,
}: SparklineMetricCardProps) {
  const chartData = sparkData?.map((v, i) => ({ v, i })) || [];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl glass p-5 transition-all duration-300 hover:glow hover:border-primary/30 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold text-foreground">{value}</p>
          </div>
        </div>
        {chartData.length > 1 && (
          <div className="h-10 w-20 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={1200}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
