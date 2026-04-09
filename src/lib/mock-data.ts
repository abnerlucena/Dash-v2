export const MACHINES = [
  { id: 1, name: "HORIZONTAL 1", defaultMeta: 500 },
  { id: 2, name: "HORIZONTAL 2", defaultMeta: 500 },
  { id: 3, name: "VERTICAL PLACAS / SUP. 1", defaultMeta: 400 },
  { id: 4, name: "VERTICAL PLACAS / SUP. 2", defaultMeta: 400 },
  { id: 5, name: "VERTICAL MÓDULOS 1", defaultMeta: 350 },
  { id: 6, name: "VERTICAL MÓDULOS 2", defaultMeta: 350 },
  { id: 7, name: "A GRANEL", defaultMeta: 600 },
  { id: 8, name: "MÁQUINA INTERRUPTOR", defaultMeta: 300 },
  { id: 9, name: "TESTE INTERRUPTORES", defaultMeta: 250 },
  { id: 10, name: "MANUAL INTERRUPTOR", defaultMeta: 200 },
  { id: 11, name: "MONTAGEM DIVERSOS", defaultMeta: 150 },
  { id: 12, name: "MONTAGEM PLACA REFINATTO", defaultMeta: 180 },
];

export const TURNOS = ["TURNO 1", "TURNO 2", "TURNO 3"];

function randomProd(meta: number) {
  const factor = 0.6 + Math.random() * 0.6;
  return Math.round(meta * factor);
}

export function generateMockData() {
  const today = new Date();
  const records: Array<{
    machineId: number;
    machineName: string;
    date: string;
    turno: string;
    producao: number;
    meta: number;
    savedBy: string;
    obs?: string;
  }> = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - dayOffset);
    const dateStr = d.toISOString().slice(0, 10);

    for (const machine of MACHINES) {
      for (const turno of TURNOS) {
        const prod = randomProd(machine.defaultMeta);
        records.push({
          machineId: machine.id,
          machineName: machine.name,
          date: dateStr,
          turno,
          producao: prod,
          meta: machine.defaultMeta,
          savedBy: ["Carlos", "Ana", "Pedro", "Maria"][Math.floor(Math.random() * 4)],
          obs: Math.random() > 0.85 ? "Parada para manutenção" : undefined,
        });
      }
    }
  }

  return records;
}

export function aggregateByMachine(records: ReturnType<typeof generateMockData>) {
  const agg: Record<number, { totalProd: number; totalMeta: number; days: Set<string> }> = {};
  
  for (const r of records) {
    if (!agg[r.machineId]) {
      agg[r.machineId] = { totalProd: 0, totalMeta: 0, days: new Set() };
    }
    agg[r.machineId].totalProd += r.producao;
    agg[r.machineId].totalMeta += r.meta;
    agg[r.machineId].days.add(r.date);
  }

  return MACHINES.map(m => {
    const a = agg[m.id];
    const totalProd = a?.totalProd ?? 0;
    const totalMeta = a?.totalMeta ?? 0;
    const pct = totalMeta > 0 ? Math.round(totalProd / totalMeta * 100) : 0;
    return {
      id: m.id,
      name: m.name,
      totalProd,
      totalMeta,
      pct,
      days: a?.days.size ?? 0,
    };
  });
}

export function aggregateByDay(records: ReturnType<typeof generateMockData>) {
  const agg: Record<string, { totalProd: number; totalMeta: number }> = {};
  
  for (const r of records) {
    if (!agg[r.date]) {
      agg[r.date] = { totalProd: 0, totalMeta: 0 };
    }
    agg[r.date].totalProd += r.producao;
    agg[r.date].totalMeta += r.meta;
  }

  return Object.entries(agg)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date: date.slice(5),
      producao: d.totalProd,
      meta: d.totalMeta,
    }));
}

export function aggregateByTurno(records: ReturnType<typeof generateMockData>) {
  const agg: Record<string, number> = {};
  for (const r of records) {
    agg[r.turno] = (agg[r.turno] ?? 0) + r.producao;
  }
  return TURNOS.map(t => ({
    name: t,
    value: agg[t] ?? 0,
  }));
}
