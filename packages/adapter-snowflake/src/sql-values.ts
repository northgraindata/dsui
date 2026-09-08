import { z } from "@northgraindata/dsui-adapter-sdk";

/** Each part is a name returned by Snowflake, not an SQL expression. */
export function qualifiedName(...parts: string[]): string {
  return parts.map((part) => `"${part.replace(/"/g, '""')}"`).join(".");
}

const grants: Record<string, readonly string[]> = {
  DATABASE: ["USAGE", "MONITOR", "MODIFY", "CREATE SCHEMA"],
  SCHEMA: [
    "USAGE",
    "MONITOR",
    "MODIFY",
    "CREATE TABLE",
    "CREATE VIEW",
    "CREATE STAGE",
    "CREATE SEQUENCE",
    "CREATE STREAM",
    "CREATE TASK",
    "CREATE PROCEDURE",
    "CREATE FUNCTION",
    "CREATE FILE FORMAT",
    "CREATE PIPE",
    "CREATE DYNAMIC TABLE",
  ],
  TABLE: ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES"],
  VIEW: ["SELECT", "REFERENCES"],
  WAREHOUSE: ["USAGE", "OPERATE", "MONITOR", "MODIFY"],
  STAGE: ["USAGE", "READ", "WRITE"],
  SEQUENCE: ["USAGE"],
  STREAM: ["SELECT"],
  TASK: ["OPERATE", "MONITOR"],
  "DYNAMIC TABLE": ["SELECT", "OPERATE", "MONITOR"],
};

/** Parse the form's SQL-qualified name; uppercase only unquoted parts. */
function parseObjectName(value: string): string {
  const parts =
    value.trim().match(/"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*|\.|\s+|./g) ??
    [];
  const names: string[] = [];
  let expectName = true;
  for (const part of parts) {
    if (/^\s+$/.test(part)) continue;
    if (!expectName && part === ".") {
      expectName = true;
      continue;
    }
    if (!expectName) throw new Error("Invalid qualified object name");
    if (/^"(?:[^"]|"")+"$/.test(part))
      names.push(part.slice(1, -1).replace(/""/g, '"'));
    else if (/^[A-Za-z_][A-Za-z0-9_$]*$/.test(part))
      names.push(part.toUpperCase());
    else throw new Error("Invalid qualified object name");
    expectName = false;
  }
  if (expectName || names.length > 3)
    throw new Error("Invalid qualified object name");
  return qualifiedName(...names);
}

export function grantSql(
  command: "GRANT" | "REVOKE",
  input: { privilege: string; objectType: string; objectName: string },
  role: string,
): string {
  const privilege = input.privilege.trim().toUpperCase();
  const objectType = input.objectType.trim().toUpperCase();
  if (
    !Object.hasOwn(grants, objectType) ||
    !grants[objectType]?.includes(privilege)
  )
    throw new Error("Unsupported privilege or object type");
  if (!role) throw new Error("Role must not be empty");
  return `${command} ${privilege} ON ${objectType} ${parseObjectName(input.objectName)} ${command === "GRANT" ? "TO" : "FROM"} ROLE ${qualifiedName(role)}`;
}

const scalarArguments = z
  .array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()]))
  .max(100);

/** Empty input is retained for compatibility with no-argument procedures. */
export function procedureArguments(
  value: string,
): (string | number | boolean | null)[] {
  if (!value.trim()) return [];
  try {
    return scalarArguments.parse(JSON.parse(value));
  } catch {
    throw new Error(
      "Procedure arguments must be a JSON array of scalar values",
    );
  }
}
