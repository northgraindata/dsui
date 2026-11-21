import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const id = "virtual:dsui-pro";
const resolvedId = `\0${id}`;
/** Private source stays in the local checkout; the default build has no Pro imports. */
export function proPlugin(directory?: string): Plugin {
  const base = directory
    ? resolve(directory, "packages/plugin-ai-diagnostics-pro/src")
    : undefined;
  if (base && !existsSync(resolve(base, "model.ts")))
    throw new Error(
      "DSUI_PRO_DIR must point to a dsui-pro checkout containing plugin-ai-diagnostics-pro.",
    );
  return {
    name: "dsui-pro-lab",
    resolveId(source) {
      if (source === id) return resolvedId;
    },
    load(source) {
      if (source !== resolvedId) return;
      if (!base)
        return "export const available = false; export function ProView() { return null; }";
      const file = (path: string) => JSON.stringify(resolve(base, path));
      return `
import * as React from 'react';
import { initializeReact } from ${file("components/react.ts")};
import { overviewSchema, runSchema } from ${file("model.ts")};
import { styles } from ${file("components/styles.ts")};
import { Investigations } from ${file("pages/investigations.tsx")};
import { Workflows } from ${file("pages/workflows.tsx")};
import { Settings } from ${file("pages/settings.tsx")};
import { RunView } from ${file("pages/run.tsx")};
import { Manual } from ${file("components/investigate.tsx")};
import { ReportPreview } from ${file("pages/report-preview.tsx")};
import { FindingReport } from ${file("components/finding-report.tsx")};
import { InvestigationProgress } from ${file("components/investigation-progress.tsx")};
import { InvestigationEvidence } from ${file("components/investigation-evidence.tsx")};
import { ReportTable } from ${file("components/report-table.tsx")};
import { ReportLog } from ${file("components/report-log.tsx")};
import { InvestigationTimeline } from ${file("components/investigation-timeline.tsx")};
initializeReact(React);
export const available = true;
export function ProView({view,state,fixtures,client,renderNode,onDone}) {
  const h = React.createElement;
  const data = overviewSchema.parse(fixtures.overview);
  let content;
  if (view === 'run') content = h(RunView,{runId:fixtures.run.id,overview:data,client,renderNode});
  else if (view === 'investigations') content = h(Investigations,{data,client,renderNode,refresh:onDone});
  else if (view === 'settings' || view === 'channels') content = h(Settings,{data,client,onDone,initialSection:view === 'channels'?'channels':'agent'});
  else if (view === 'workflows') content = h(Workflows,{data,client,refresh:onDone});
  else if (view === 'manual') content = h(Manual,{data,client,onDone,serviceId:state==='empty'?undefined:'airflow',initialPrompt:state==='empty'?'':fixtures.prompt});
  else if (view === 'finding') content = h(FindingReport,{run:runSchema.parse(fixtures.run),client,services:data.services,patches:[],onBrowse:()=>onDone(),refresh:onDone,canUpdateIncident:state!=='readonly'});
  else if (view === 'report') content = h(ReportPreview,{data,onClose:onDone});
  else if (view === 'evidence') content = h(InvestigationEvidence,{run:runSchema.parse(fixtures.run),client});
  else if (view === 'progress') content = h(InvestigationProgress,{iconUrl:data.services[0]?.iconUrl,phase:state==='queued'?'evidence':state,queued:state==='queued',withChange:true,activity:fixtures.prompt,sources:state==='queued'?0:12});
  else if (view === 'table') content = h(ReportTable,{columns:['order_id','customer_id','amount','currency'],rows:fixtures.tableRows,caption:'Recorded orders sample · fixture data'});
  else if (view === 'log') content = h(ReportLog,{entries:fixtures.logs,label:'Airflow task log · fixture data'});
  else if (view === 'timeline') content = h(InvestigationTimeline,{events:fixtures.timeline});
  else throw new Error('Unknown Pro preview: '+view);
  return h('div',{className:'ap-screen'},h('style',null,styles),content);
}`;
    },
  };
}
