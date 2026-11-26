import { dirname, join } from "node:path";
import ts from "typescript";

/**
 * Finds every `defineResource` and `defineAction` call in an adapter and records
 * what its function returns. Neither carries a runtime output schema, so the
 * TypeScript type is the single source of truth for fixture shapes.
 */
export interface ResourceTypes {
  readonly checker: ts.TypeChecker;
  /** Query output per resource id. */
  readonly outputs: ReadonlyMap<string, ts.Type>;
  /** Run output per action id. */
  readonly actions: ReadonlyMap<string, ts.Type>;
}

type Property = "query" | "run";
type Found = Record<Property, Map<string, ts.Type>>;

/** The function whose return type describes each kind of definition. */
const DEFINITIONS: Readonly<Record<string, Property>> = {
  defineResource: "query",
  defineAction: "run",
};

function sourceFiles(directory: string): string[] {
  return ts.sys
    .readDirectory(directory, [".ts", ".tsx"])
    .filter((file) => !/\.(test|spec)\.tsx?$/.test(file));
}

function literalProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): string | undefined {
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      property.name.getText() === name &&
      ts.isStringLiteralLike(property.initializer)
    )
      return property.initializer.text;
  }
  return undefined;
}

function returnOutput(
  checker: ts.TypeChecker,
  object: ts.ObjectLiteralExpression,
  property: Property,
): ts.Type | undefined {
  const member = checker.getTypeAtLocation(object).getProperty(property);
  if (!member) return undefined;
  const signature = checker
    .getTypeOfSymbolAtLocation(member, object)
    .getCallSignatures()[0];
  if (!signature) return undefined;
  const returned = signature.getReturnType();
  return checker.getAwaitedType(returned) ?? returned;
}

function collect(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
  found: Found,
): void {
  const property = DEFINITIONS[call.expression.getText()];
  const [argument] = call.arguments;
  if (!property || !argument || !ts.isObjectLiteralExpression(argument)) return;
  const id = literalProperty(argument, "id");
  const output = returnOutput(checker, argument, property);
  if (id && output) found[property].set(id, output);
}

export function collectResourceTypes(
  repositoryRoot: string,
  adapterDirectories: readonly string[],
): ResourceTypes[] {
  const config = ts.readConfigFile(
    join(repositoryRoot, "tsconfig.json"),
    ts.sys.readFile,
  );
  const { options } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(join(repositoryRoot, "tsconfig.json")),
  );
  const filesByAdapter = adapterDirectories.map((directory) =>
    sourceFiles(join(directory, "src")),
  );
  const program = ts.createProgram({
    rootNames: filesByAdapter.flat(),
    options: { ...options, jsx: ts.JsxEmit.ReactJSX, noEmit: true },
  });
  const checker = program.getTypeChecker();
  return filesByAdapter.map((files) => {
    const found: Found = { query: new Map(), run: new Map() };
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) collect(checker, node, found);
      ts.forEachChild(node, visit);
    };
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (source) visit(source);
    }
    return { checker, outputs: found.query, actions: found.run };
  });
}
