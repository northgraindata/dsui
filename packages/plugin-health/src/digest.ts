import type { PluginContext } from "@northgraindata/dsui-plugin-sdk";
import type { HealthConfig } from "./config.js";
import { openHealthDb } from "./db.js";
import { buildReport, summaryLine } from "./report.js";
import { WEEKLY_REPORT, type WeeklyReportPayload } from "./signals.js";
import { listServices } from "./view.js";

type DigestContext = Pick<
  PluginContext<HealthConfig>,
  "config" | "services" | "storage" | "events"
>;

/** The weekly report as a signal payload. */
export function weeklyPayload(
  context: Pick<DigestContext, "storage">,
  services: Parameters<typeof buildReport>[1],
  now: number,
): WeeklyReportPayload {
  const report = buildReport(openHealthDb(context.storage), services, 7, now);
  return {
    days: report.days,
    from: report.current.from,
    to: now,
    availability: report.current.availability,
    previousAvailability: report.previous.availability,
    incidentsOpened: report.current.incidentsOpened,
    incidentsResolved: report.current.incidentsResolved,
    meanTimeToResolveMs: report.current.meanTimeToResolveMs,
    lowest: report.services
      .filter((service) => service.availability !== null)
      .slice(0, 3)
      .map(({ id, name, availability, incidents }) => ({
        id,
        name,
        availability,
        incidents,
      })),
    summary: summaryLine(report),
  };
}

/**
 * Publishes the weekly reliability summary as a signal.
 *
 * Delivery is not this plugin's business: anything subscribed to signals can
 * turn it into a message. With no subscriber it is simply recorded.
 */
export async function emitWeeklyReport(
  context: DigestContext,
  now = Date.now(),
): Promise<WeeklyReportPayload> {
  const services = await listServices(
    context.services,
    context.config.maxServices,
  );
  const payload = weeklyPayload(context, services, now);
  await context.events.emit(
    WEEKLY_REPORT.id,
    payload,
    undefined,
    WEEKLY_REPORT.type,
  );
  return payload;
}
