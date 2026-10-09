import compareServices from "./skills/compare-services.md" with {
  type: "text",
};
import diagnoseHealth from "./skills/diagnose-health.md" with { type: "text" };
import inspectCatalog from "./skills/inspect-catalog.md" with { type: "text" };
import responseFormat from "./skills/response-format.md" with { type: "text" };

export const responseFormatInstructions = responseFormat;

const skills = [
  {
    id: "diagnose-health",
    title: "Diagnose service health",
    description:
      "Investigate failures, unavailable services, runs, logs, and events.",
    instructions: diagnoseHealth,
  },
  {
    id: "inspect-catalog",
    title: "Inspect a data catalog",
    description:
      "Explore databases, tables, columns, schemas, and bounded samples.",
    instructions: inspectCatalog,
  },
  {
    id: "compare-services",
    title: "Compare services",
    description: "Compare evidence across multiple adapters and services.",
    instructions: compareServices,
  },
] as const;

export function listSkills() {
  return skills.map(({ id, title, description }) => ({
    id,
    title,
    description,
  }));
}

export function readSkill(id: string) {
  return skills.find((skill) => skill.id === id);
}
