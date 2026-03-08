import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const SOURCE_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
  "hsl(0, 84%, 60%)",
  "hsl(215, 25%, 53%)",
];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(218, 49%, 13%)",
  border: "1px solid hsl(213, 50%, 24%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(214, 32%, 91%)",
};

interface SourceData {
  name: string;
  value: number;
}

interface LeadSourceChartProps {
  data: SourceData[];
}

export function LeadSourceChart({ data }: LeadSourceChartProps) {
  const hasData = data.some((d) => d.value > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
        Lead Sources
      </h2>
      {!hasData ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No lead source data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
