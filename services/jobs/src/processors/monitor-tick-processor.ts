export interface MonitorSummary {
  id: string;
  status: string;
}

export interface MonitorCheckOutcome {
  monitorId: string;
  triggered: boolean;
  error?: string;
}

export interface MonitorTickPorts {
  listMonitors: () => Promise<{ items: MonitorSummary[] }>;
  checkMonitor: (id: string) => Promise<{ triggered: boolean }>;
}

export interface MonitorTickResult {
  checked: number;
  triggered: number;
  skipped: number;
  outcomes: MonitorCheckOutcome[];
}

export async function runMonitorTickProcessor(
  ports: MonitorTickPorts,
): Promise<MonitorTickResult> {
  const { items } = await ports.listMonitors();
  const outcomes: MonitorCheckOutcome[] = [];
  let triggered = 0;
  let skipped = 0;
  let checked = 0;

  for (const monitor of items) {
    if (monitor.status !== "active") {
      skipped += 1;
      continue;
    }

    checked += 1;
    try {
      const result = await ports.checkMonitor(monitor.id);
      if (result.triggered) {
        triggered += 1;
      }
      outcomes.push({ monitorId: monitor.id, triggered: result.triggered });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({
        monitorId: monitor.id,
        triggered: false,
        error: message,
      });
    }
  }

  return { checked, triggered, skipped, outcomes };
}
