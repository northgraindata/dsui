import { setTimeout as delay } from "node:timers/promises";
import JSONbig from "json-bigint";
import type { Config } from "./config";
import {
  type JsonObject,
  objectSchema,
  type QueryResult,
  type ResultPage,
  resultsSchema,
  TrinoError,
} from "./sql";

const parseJson = JSONbig({ storeAsString: true, strict: true }).parse;
export class TrinoClient {
  private cookies = new Map<string, string>();
  private login?: Promise<void>;
  private controllers = new Set<AbortController>();
  constructor(readonly config: Config) {}
  private url(path: string) {
    const base = new URL(
      this.config.url.endsWith("/") ? this.config.url : `${this.config.url}/`,
    );
    const result = new URL(path.replace(/^\//, ""), base);
    if (result.origin !== base.origin || result.username || result.password)
      throw new TrinoError("Coordinator returned an untrusted URL");
    return result;
  }
  private headers() {
    const headers = new Headers({
      "X-Trino-User": this.config.user,
      "X-Trino-Source": "dsui",
    });
    if (this.config.authentication === "password")
      headers.set(
        "Authorization",
        `Basic ${Buffer.from(`${this.config.user}:${this.config.password}`).toString("base64")}`,
      );
    if (this.config.authentication === "jwt")
      headers.set("Authorization", `Bearer ${this.config.token}`);
    return headers;
  }
  private async request(
    path: string,
    init: RequestInit = {},
    signal?: AbortSignal,
  ) {
    const boundedSignal = signal ?? AbortSignal.timeout(15000);
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      response = await fetch(this.url(path), {
        ...init,
        redirect: init.redirect ?? "error",
        signal: boundedSignal,
      });
      const retryable =
        response.status === 429 ||
        (init.method !== "POST" && [502, 503, 504].includes(response.status));
      if (!retryable || attempt >= 3) break;
      const seconds = Number(response.headers.get("Retry-After"));
      await response.body?.cancel();
      await delay(
        Math.max(
          100,
          Number.isFinite(seconds) ? Math.min(seconds * 1000, 10000) : 100,
        ),
        undefined,
        { signal: boundedSignal },
      );
    }
    if (
      !response.ok &&
      !(init.redirect === "manual" && response.status === 303)
    ) {
      await response.body?.cancel();
      const descriptions: Record<number, string> = {
        401: "Authentication failed",
        403: "Permission denied",
        410: "Query has expired from coordinator history",
        404: "Requested feature is unavailable",
        409: "Query has already finished",
      };
      const description =
        descriptions[response.status] ??
        `Trino returned HTTP ${response.status}`;
      throw new TrinoError(description, response.status);
    }
    return response;
  }
  private async json(response: Response): Promise<unknown> {
    try {
      return parseJson(await response.text());
    } catch {
      throw new TrinoError("Trino returned an invalid JSON response");
    }
  }
  private async authenticateUi() {
    if (this.config.authentication !== "none" || this.cookies.size) return;
    if (!this.login)
      this.login = (async () => {
        const info = objectSchema.parse(
          await this.json(
            await this.request("/ui/auth/info", { headers: this.headers() }),
          ),
        );
        if (info.authenticated === true) return;
        const response = await this.request("/ui/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: this.config.user }),
          redirect: "manual",
        });
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(";")[0];
          const index = pair.indexOf("=");
          if (index > 0)
            this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        await response.body?.cancel();
      })().finally(() => {
        this.login = undefined;
      });
    await this.login;
  }
  async ui(path: string, method = "GET", body?: string): Promise<unknown> {
    await this.authenticateUi();
    const headers = this.headers();
    if (this.cookies.size)
      headers.set(
        "Cookie",
        [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "),
      );
    if (body) headers.set("Content-Type", "text/plain");
    try {
      const response = await this.request(`/ui/api/${path}`, {
        method,
        headers,
        body,
      });
      if (response.status === 204 || method !== "GET") {
        await response.body?.cancel();
        return { accepted: true };
      }
      return await this.json(response);
    } catch (error) {
      if (error instanceof TrinoError && error.status === 401)
        this.cookies.clear();
      throw error;
    }
  }
  async execute(
    sql: string,
    options: {
      catalog?: string;
      schema?: string;
      maxRows?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<QueryResult> {
    const controller = new AbortController();
    this.controllers.add(controller);
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(this.config.timeoutMs),
      ...(options.signal ? [options.signal] : []),
    ]);
    const headers = this.headers();
    headers.set("Content-Type", "text/plain");
    const catalog = options.catalog ?? this.config.catalog;
    const schema = options.schema ?? this.config.schema;
    if (catalog) headers.set("X-Trino-Catalog", catalog);
    if (schema) headers.set("X-Trino-Schema", schema);
    let next: string | undefined;
    let page: ResultPage | undefined;
    const started = Date.now();
    const rows: JsonObject[] = [];
    let columns: { name: string; type: string }[] = [];
    const warnings = new Map<string, JsonObject>();
    const maxRows = options.maxRows ?? 1000;
    let truncated = false;
    const session = new Map<string, string>();
    const roles = new Map<string, string>();
    const prepared = new Map<string, string>();
    const updateMap = (
      response: Response,
      set: string,
      clear: string,
      map: Map<string, string>,
      request: string,
    ) => {
      for (const value of (response.headers.get(set) ?? "")
        .split(",")
        .filter(Boolean)) {
        const index = value.indexOf("=");
        if (index > 0)
          map.set(value.slice(0, index).trim(), value.slice(index + 1).trim());
      }
      for (const value of (response.headers.get(clear) ?? "")
        .split(",")
        .filter(Boolean))
        map.delete(value.trim());
      if (map.size)
        headers.set(
          request,
          [...map].map(([key, value]) => `${key}=${value}`).join(","),
        );
      else headers.delete(request);
    };
    try {
      let first = true;
      do {
        signal.throwIfAborted();
        const response = await this.request(
          first ? "/v1/statement" : (next ?? ""),
          {
            method: first ? "POST" : "GET",
            headers,
            body: first ? sql : undefined,
          },
          signal,
        );
        first = false;
        page = resultsSchema.parse(await this.json(response));
        next = page.nextUri;
        if (next) this.url(next);
        if (page.error) {
          const location = page.error.errorLocation;
          throw new TrinoError(
            `${page.error.message}${location ? ` (line ${location.lineNumber}, column ${location.columnNumber})` : ""}`,
            undefined,
            page.error.errorName,
          );
        }
        for (const key of ["Catalog", "Schema"]) {
          const value = response.headers.get(`X-Trino-Set-${key}`);
          if (value) headers.set(`X-Trino-${key}`, value);
        }
        updateMap(
          response,
          "X-Trino-Set-Session",
          "X-Trino-Clear-Session",
          session,
          "X-Trino-Session",
        );
        updateMap(
          response,
          "X-Trino-Set-Role",
          "X-Trino-Clear-Role",
          roles,
          "X-Trino-Role",
        );
        updateMap(
          response,
          "X-Trino-Added-Prepare",
          "X-Trino-Deallocated-Prepare",
          prepared,
          "X-Trino-Prepared-Statement",
        );
        const transaction = response.headers.get(
          "X-Trino-Started-Transaction-Id",
        );
        if (transaction) headers.set("X-Trino-Transaction-Id", transaction);
        if (response.headers.has("X-Trino-Clear-Transaction-Id"))
          headers.delete("X-Trino-Transaction-Id");
        if (page.columns) columns = page.columns;
        for (const warning of page.warnings ?? [])
          warnings.set(JSON.stringify(warning), warning);
        for (const values of page.data ?? []) {
          if (rows.length >= maxRows) {
            truncated = true;
            break;
          }
          const row: JsonObject = {};
          columns.forEach((column, index) => {
            let name = column.name;
            let suffix = 2;
            while (Object.hasOwn(row, name))
              name = `${column.name}_${suffix++}`;
            row[name] = values[index];
          });
          rows.push(row);
        }
        if (truncated) break;
      } while (next);
      if (!page) throw new TrinoError("No query response received");
      const names: string[] = [];
      for (const column of columns) {
        let name = column.name;
        let suffix = 2;
        while (names.includes(name)) name = `${column.name}_${suffix++}`;
        names.push(name);
      }

      return {
        columns: names,
        columnTypes: columns.map((column) => column.type),
        rows,
        rowCount: rows.length,
        queryId: page.id,
        elapsedMs: Date.now() - started,
        truncated,
        warnings: [...warnings.values()],
        ...(page.updateCount !== undefined
          ? { rowsChanged: page.updateCount }
          : {}),
        ...(page.updateType ? { updateType: page.updateType } : {}),
      };
    } finally {
      if (next) {
        try {
          const response = await this.request(
            next,
            { method: "DELETE", headers },
            AbortSignal.timeout(5000),
          );
          await response.body?.cancel();
        } catch {
          /* Best effort cleanup must not replace the query result or its original error. */
        }
      }
      this.controllers.delete(controller);
    }
  }
  async health() {
    return this.execute("SELECT version() AS version", { maxRows: 1 });
  }
  dispose() {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.cookies.clear();
  }
}
