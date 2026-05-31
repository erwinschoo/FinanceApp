import { Ic } from "./Ic";
import { Spark } from "../charts/Spark";

interface Props {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  delta?: number | null;
  deltaNote?: string;
  spark?: number[];
  sparkColor?: string;
  phone?: boolean;
}

export function KpiCard({ icon, iconColor, iconBg, label, value, delta, deltaNote, spark, sparkColor, phone }: Props) {
  const deltaEl = delta != null && (
    <span className={"delta " + (delta >= 0 ? "up" : "down")}>
      <Ic name={delta >= 0 ? "arrowUp" : "arrowDown"} size={13} />
      {Math.abs(delta).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%
    </span>
  );

  // Mobiel: links titel + bedrag/percentage, rechts een grotere spark die de
  // tile-hoogte vult en verticaal centreert. Geen delta-subtekst (bespaart ruimte).
  if (phone) {
    return (
      <div className="card kpi kpi-m">
        <div className="kpi-m-main">
          <div className="k-top">
            <span className="k-ic" style={{ background: iconBg, color: iconColor }}><Ic name={icon} /></span>
            <span className="k-lbl">{label}</span>
          </div>
          <div className="k-row2">
            <div className="k-val tnum">{value}</div>
            {deltaEl}
          </div>
        </div>
        {spark && <Spark data={spark} color={sparkColor} w={88} h={52} />}
      </div>
    );
  }

  return (
    <div className="card kpi">
      <div className="k-top">
        <span className="k-ic" style={{ background: iconBg, color: iconColor }}><Ic name={icon} /></span>
        <span className="k-lbl">{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div className="k-val tnum">{value}</div>
        {spark && <Spark data={spark} color={sparkColor} />}
      </div>
      {delta != null && (
        <div className="k-foot">
          {deltaEl}
          <span className="delta-note">{deltaNote}</span>
        </div>
      )}
    </div>
  );
}
