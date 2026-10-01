import { useState } from "react";
import { periodDates } from "../lib/format";
export function DateFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [period, setPeriod] = useState("today");
  return (
    <div className="period">
      <span>Período</span>
      <select
        aria-label="Período"
        value={period}
        onChange={(e) => {
          setPeriod(e.target.value);
          if (e.target.value !== "custom") {
            const d = periodDates(e.target.value);
            onChange(d.from, d.to);
          }
        }}
      >
        <option value="today">Hoy</option>
        <option value="month">Este mes</option>
        <option value="lastmonth">Mes anterior</option>
        <option value="custom">Personalizado</option>
      </select>
      {period === "custom" && (
        <>
          <input
            aria-label="Desde"
            type="date"
            value={from}
            max={to}
            onChange={(e) => onChange(e.target.value, to)}
          />
          <span>hasta</span>
          <input
            aria-label="Hasta"
            type="date"
            value={to}
            min={from}
            onChange={(e) => onChange(from, e.target.value)}
          />
        </>
      )}
    </div>
  );
}
