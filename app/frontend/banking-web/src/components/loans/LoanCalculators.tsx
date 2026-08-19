import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { calculateEMI, calculateTotalInterest } from "@/lib/loanCenterService";

export function LoanCalculators() {
  const [amount, setAmount] = useState(500000);
  const [rate, setRate] = useState(10.5);
  const [tenure, setTenure] = useState(36);

  const emi = useMemo(() => calculateEMI(amount, rate, tenure), [amount, rate, tenure]);
  const totalInterest = useMemo(() => calculateTotalInterest(amount, rate, tenure), [amount, rate, tenure]);
  const totalRepayment = amount + totalInterest;

  const donutData = [
    { name: "Principal", value: amount, color: "hsl(var(--primary))" },
    { name: "Interest", value: totalInterest, color: "#f59e0b" },
  ];
  const principalPct = totalRepayment > 0 ? (amount / totalRepayment) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* EMI Calculator */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-foreground">EMI Calculator</h3>
          <p className="text-xs text-muted-foreground">See what your monthly payment could look like.</p>

          <div className="mt-4 space-y-5">
            <SliderField label="Loan Amount" value={amount} onChange={setAmount} min={10000} max={5000000} step={10000} format={(v) => `₹${v.toLocaleString()}`} />
            <SliderField label="Interest Rate" value={rate} onChange={setRate} min={5} max={20} step={0.05} format={(v) => `${v.toFixed(2)}%`} />
            <SliderField label="Loan Tenure" value={tenure} onChange={setTenure} min={6} max={360} step={1} format={(v) => `${v} months`} />
          </div>

          <div className="mt-5 rounded-lg border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Monthly EMI</p>
            <p className="text-3xl font-bold text-foreground tabular-nums">₹{Math.round(emi).toLocaleString()}</p>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">Principal</p>
                <p className="font-medium text-foreground">₹{amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Total Interest</p>
                <p className="font-medium text-foreground">₹{Math.round(totalInterest).toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] text-muted-foreground">Total Repayment</p>
                <p className="font-medium text-foreground">₹{Math.round(totalRepayment).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interest Calculator */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-foreground">Interest Calculator</h3>
          <p className="text-xs text-muted-foreground">Understand total interest over tenure.</p>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value">
                    {donutData.map((d) => <Cell key={d.name} fill={d.color} stroke="white" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${Math.round(v).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-lg font-bold text-foreground">{principalPct.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">Principal</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <LegendRow color="hsl(var(--primary))" label="Principal" value={`${principalPct.toFixed(0)}%`} />
              <LegendRow color="#f59e0b" label="Interest" value={`${(100 - principalPct).toFixed(0)}%`} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-border/60 p-4 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Principal</p>
              <p className="font-semibold text-foreground">₹{amount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Interest</p>
              <p className="font-semibold text-foreground">₹{Math.round(totalInterest).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Total repayment</p>
              <p className="font-semibold text-foreground">₹{Math.round(totalRepayment).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, step, format }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <Input
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-7 w-28 text-right text-xs"
        />
      </div>
      <Slider className="mt-2" value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
      <p className="mt-1 text-[11px] text-muted-foreground">{format(value)}</p>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-muted-foreground">{label}</span>
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
