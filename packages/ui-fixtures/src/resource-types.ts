import { dirname, join } from "node:path";
import ts from "typescript";

/**
 * Finds every `defineResource` call in an adapter and records the output type
 * of its query. Resources carry no runtime output schema, so the TypeScript
 * type is the single source of truth for fixture shapes.
 */
export interface ResourceTypes {
  readonly checker: ts.TypeChecker;
  readonly outputs: ReadonlyMap<string, ts.Type>;
}

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

function queryOutput(
  checker: ts.TypeChecker,
  object: ts.ObjectLiteralExpression,
): ts.Type | undefined {
  const query = checker.getTypeAtLocation(object).getProperty("query");
  if (!query) return undefined;
  const signature = checker
    .getTypeOfSymbolAtLocation(query, object)
    .getCallSignatures()[0];
  if (!signature) return undefined;
  const returned = signature.getReturnType();
  return checker.getAwaitedType(returned) ?? returned;
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
    const outputs = new Map<string, ts.Type>();
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText() === "defineResource"
      ) {
        const [argument] = node.arguments;
        if (argument && ts.isObjectLiteralExpression(argument)) {
          const id = literalProperty(argument, "id");
          const output = queryOutput(checker, argument);
          if (id && output) outputs.set(id, output);
        }
      }
      ts.forEachChild(node, visit);
    };
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (source) visit(source);
    }
    return { checker, outputs };
  });
}
