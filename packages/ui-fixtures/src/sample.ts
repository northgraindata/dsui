import ts from "typescript";
import type { Shape } from "./types";
import { sampleNumber, sampleString } from "./values";

const MAX_DEPTH = 6;
const NESTED_ROWS = 3;

interface Walk {
  readonly checker: ts.TypeChecker;
  readonly shape: Shape;
  /** Row keys for lists whose item type declares no properties. */
  readonly columns: readonly string[];
}

interface Position {
  readonly name: string;
  readonly row: number;
  readonly depth: number;
  readonly listDepth: number;
}

function sampleUnion(walk: Walk, type: ts.UnionType, at: Position): unknown {
  const members = type.types.filter(
    (member) =>
      !(
        member.flags &
        (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)
      ),
  );
  if (members.length === 0) return null;
  if (members.every((member) => member.flags & ts.TypeFlags.BooleanLiteral))
    return at.row % 2 === 0;
  const literals = members.filter((member) => member.isStringLiteral());
  if (literals.length === members.length)
    return (literals[at.row % literals.length] as ts.StringLiteralType).value;
  const preferred =
    members.find((member) => member.flags & ts.TypeFlags.String) ??
    members.find((member) => member.flags & ts.TypeFlags.Number) ??
    members[0];
  return preferred ? sampleType(walk, preferred, at) : null;
}

function samplePrimitive(walk: Walk, type: ts.Type, at: Position): unknown {
  const { longText } = walk.shape;
  if (type.isStringLiteral() || type.isNumberLiteral()) return type.value;
  if (type.flags & ts.TypeFlags.StringLike)
    return sampleString(at.name, at.row, longText);
  if (type.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike))
    return sampleNumber(at.name, at.row, longText);
  if (type.flags & ts.TypeFlags.BooleanLiteral)
    return walk.checker.typeToString(type) === "true";
  if (type.flags & ts.TypeFlags.BooleanLike) return at.row % 2 === 0;
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
    return sampleString(at.name, at.row, longText);
  return undefined;
}

function sampleList(walk: Walk, item: ts.Type, at: Position): unknown[] {
  const rows =
    at.listDepth === 0
      ? walk.shape.rows
      : Math.min(walk.shape.rows, NESTED_ROWS);
  return Array.from({ length: rows }, (_, row) =>
    sampleType(walk, item, {
      ...at,
      row: at.listDepth === 0 ? row : at.row + row,
      depth: at.depth + 1,
      listDepth: at.listDepth + 1,
    }),
  );
}

function sampleObject(walk: Walk, type: ts.Type, at: Position): unknown {
  const properties = walk.checker.getPropertiesOfType(type);
  if (properties.length === 0) {
    const keys = walk.columns.length
      ? walk.columns
      : ["name", "status", "value"];
    return Object.fromEntries(
      keys.map((key) => [key, sampleString(key, at.row, walk.shape.longText)]),
    );
  }
  const result: Record<string, unknown> = {};
  for (const property of properties) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    const propertyType = declaration
      ? walk.checker.getTypeOfSymbolAtLocation(property, declaration)
      : walk.checker.getTypeOfSymbol(property);
    if (propertyType.getCallSignatures().length) continue;
    result[property.name] = sampleType(walk, propertyType, {
      ...at,
      name: property.name,
      depth: at.depth + 1,
    });
  }
  return result;
}

function sampleType(walk: Walk, type: ts.Type, at: Position): unknown {
  if (at.depth > MAX_DEPTH) return null;
  const primitive = samplePrimitive(walk, type, at);
  if (primitive !== undefined) return primitive;
  if (type.isUnion()) return sampleUnion(walk, type, at);
  if (walk.checker.isArrayType(type) || walk.checker.isTupleType(type)) {
    const items = walk.checker.getTypeArguments(type as ts.TypeReference);
    if (walk.checker.isTupleType(type))
      return items.map((item) =>
        sampleType(walk, item, { ...at, depth: at.depth + 1 }),
      );
    return items[0] ? sampleList(walk, items[0], at) : [];
  }
  if (type.symbol?.name === "Date") return "2026-01-15T10:15:00Z";
  return sampleObject(walk, type, at);
}

/** Builds deterministic sample data matching a TypeScript type. */
export function sampleFromType(
  checker: ts.TypeChecker,
  type: ts.Type,
  options: { shape: Shape; columns: readonly string[] },
): unknown {
  return sampleType({ checker, ...options }, type, {
    name: "",
    row: 0,
    depth: 0,
    listDepth: 0,
  });
}
