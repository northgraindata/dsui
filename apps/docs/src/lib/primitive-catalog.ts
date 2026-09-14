import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import * as ts from "typescript";

export interface PrimitivePropDoc {
  name: string;
  required: boolean;
  type: string;
}

export interface PrimitiveTypeDoc {
  declaration: string;
  name: string;
}

export interface PrimitiveDoc {
  componentName: string;
  id: string;
  props: PrimitivePropDoc[];
  propsName: string;
  sourcePath: string;
  supportingTypes: PrimitiveTypeDoc[];
}

const primitiveDirectory = resolve(
  process.cwd(),
  "../../packages/adapter-sdk/src/components/primitives",
);

export async function getPrimitiveDocs(): Promise<PrimitiveDoc[]> {
  const files = (await readdir(primitiveDirectory))
    .filter((file) => file.endsWith(".ts"))
    .sort();
  const docs = await Promise.all(
    files.map(async (file) =>
      extractPrimitiveDoc(
        file,
        await readFile(join(primitiveDirectory, file), "utf8"),
      ),
    ),
  );
  return docs.filter((doc): doc is PrimitiveDoc => doc !== null);
}

export function extractPrimitiveDoc(
  file: string,
  sourceText: string,
): PrimitiveDoc | null {
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const componentName = basename(file, ".ts")
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
  const propsName = `${componentName}Props`;
  const propsInterface = source.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === propsName,
  );
  if (!propsInterface) return null;

  const component = source.statements.find(
    (statement): statement is ts.VariableStatement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === componentName,
      ),
  );
  if (!component) return null;

  const id = findComponentId(component) ?? basename(file, ".ts");
  const supportingTypes = source.statements.flatMap((statement) => {
    if (
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name.text !== propsName &&
      !statement.name.text.endsWith("Node")
    ) {
      return [
        {
          name: statement.name.text,
          declaration: statement.getText(source),
        },
      ];
    }
    return [];
  });

  return {
    componentName,
    id,
    propsName,
    props: propsInterface.members.flatMap((member) => {
      if (!ts.isPropertySignature(member) || !member.type || !member.name)
        return [];
      return [
        {
          name: propertyName(member.name, source),
          required: member.questionToken === undefined,
          type: member.type.getText(source),
        },
      ];
    }),
    supportingTypes,
    sourcePath: `packages/adapter-sdk/src/components/primitives/${file}`,
  };
}

function findComponentId(statement: ts.VariableStatement): string | null {
  for (const declaration of statement.declarationList.declarations) {
    if (
      !declaration.initializer ||
      !ts.isCallExpression(declaration.initializer)
    )
      continue;
    const config = declaration.initializer.arguments[0];
    if (!config || !ts.isObjectLiteralExpression(config)) continue;
    const id = config.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === "id",
    );
    if (id && ts.isStringLiteral(id.initializer)) return id.initializer.text;
  }
  return null;
}

function propertyName(name: ts.PropertyName, source: ts.SourceFile): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return name.getText(source);
}
