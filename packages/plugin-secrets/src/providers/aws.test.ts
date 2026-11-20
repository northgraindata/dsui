import { describe, expect, test } from "bun:test";
import {
  createAwsProvider,
  type ListSecretNames,
  type ReadSecretString,
} from "./aws";
import { parseReference } from "./aws-reference";

const resolve = (read: ReadSecretString, reference: string) =>
  createAwsProvider({ id: "aws", label: "AWS" }, read).resolve(reference, {});

describe("parseReference", () => {
  test("a name alone", () => {
    expect(parseReference("prod/airflow")).toEqual({
      secretId: "prod/airflow",
    });
  });

  test("a name and a key", () => {
    expect(parseReference("prod/airflow#password")).toEqual({
      secretId: "prod/airflow",
      key: "password",
    });
  });

  test("an ARN with a key", () => {
    const arn =
      "arn:aws:secretsmanager:eu-west-1:123456789012:secret:prod/pg-AbCdEf";
    expect(parseReference(`${arn}#user`)).toEqual({
      secretId: arn,
      key: "user",
    });
  });

  test.each(["", "  ", "#key", "name#"])("refuses %p", (reference) => {
    expect(() => parseReference(reference)).toThrow();
  });
});

describe("AWS Secrets Manager provider", () => {
  test("returns a plain-text secret as it is", async () => {
    expect(await resolve(async () => "hunter2", "prod/pg")).toBe("hunter2");
  });

  test("asks for the secret by the name given, without the key", async () => {
    const asked: string[] = [];
    await resolve(async (id) => {
      asked.push(id);
      return '{"password":"p"}';
    }, "prod/pg#password");
    expect(asked).toEqual(["prod/pg"]);
  });

  test("reads one field of a JSON secret", async () => {
    expect(
      await resolve(
        async () => '{"user":"u","password":"p"}',
        "prod/pg#password",
      ),
    ).toBe("p");
  });

  test("passes the abort signal to the read", async () => {
    const controller = new AbortController();
    let received: AbortSignal | undefined;
    await createAwsProvider(
      { id: "aws", label: "AWS" },
      async (_id, signal) => {
        received = signal;
        return "v";
      },
    ).resolve("x", { signal: controller.signal });
    expect(received).toBe(controller.signal);
  });

  test("a missing field names the field, not the secret's contents", async () => {
    const failure = resolve(async () => '{"user":"u"}', "prod/pg#password");
    await expect(failure).rejects.toThrow(
      'the secret has no text field "password"',
    );
    await failure.catch((error: Error) =>
      expect(error.message).not.toContain('"u"'),
    );
  });

  test("a non-string field is refused", async () => {
    await expect(
      resolve(async () => '{"port":5432}', "prod/pg#port"),
    ).rejects.toThrow('no text field "port"');
  });

  test("a key on a secret that is not JSON is refused without echoing it", async () => {
    const failure = resolve(
      async () => "not-json-secret-value",
      "prod/pg#password",
    );
    await expect(failure).rejects.toThrow("the secret is not JSON");
    await failure.catch((error: Error) =>
      expect(error.message).not.toContain("not-json-secret-value"),
    );
  });

  test("a key on a JSON array is refused", async () => {
    await expect(
      resolve(async () => "[1]", "prod/pg#password"),
    ).rejects.toThrow("not a JSON object");
  });

  test("a binary secret is refused", async () => {
    await expect(resolve(async () => undefined, "prod/pg")).rejects.toThrow(
      "binary",
    );
  });

  test("a failure from AWS passes through for the host to report", async () => {
    await expect(
      resolve(async () => {
        throw new Error("AccessDeniedException");
      }, "prod/pg"),
    ).rejects.toThrow("AccessDeniedException");
  });
});

describe("AWS Secrets Manager suggestions", () => {
  const provider = (list: ListSecretNames) =>
    createAwsProvider({ id: "aws", label: "AWS" }, async () => "unused", list);

  test("offers search only when the secrets can be listed", () => {
    expect(
      createAwsProvider({ id: "aws", label: "AWS" }, async () => "x").search,
    ).toBeUndefined();
    expect(provider(async () => []).search).toBeDefined();
  });

  test("maps secrets to suggestions", async () => {
    const found = await provider(async () => [
      { name: "prod/airflow", description: "Airflow login" },
      { name: "prod/pg" },
    ]).search?.("prod/", {});
    expect(found).toEqual([
      { reference: "prod/airflow", description: "Airflow login" },
      { reference: "prod/pg" },
    ]);
  });

  test("searches by the secret's name, ignoring a field typed after #", async () => {
    const asked: string[] = [];
    await provider(async (prefix) => {
      asked.push(prefix);
      return [];
    }).search?.("prod/airflow#pass", {});
    await provider(async (prefix) => {
      asked.push(prefix);
      return [];
    }).search?.("", {});
    expect(asked).toEqual(["prod/airflow", ""]);
  });

  test("a denied listing passes through for the host to remember", async () => {
    await expect(
      provider(async () => {
        throw new Error("AccessDeniedException");
      }).search?.("", {}),
    ).rejects.toThrow("AccessDeniedException");
  });
});
