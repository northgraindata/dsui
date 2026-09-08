import { expect, test } from "bun:test";
import { type ActionRuntimeContext, defineAction } from "../action/index";
import { ActionExecutor } from "./action-executor";

test("an already aborted action returns an error without running its side effect", async () => {
  let calls = 0;
  const action = defineAction({
    id: "mutate",
    run: () => {
      calls++;
    },
  });
  const reason = new Error("Caller cancelled");
  const executor = new ActionExecutor({}, () => {});
  const result = await executor.execute(action(), {
    signal: AbortSignal.abort(reason),
  });
  expect(result.status).toBe("error");
  if (result.status === "error") expect(result.error).toBe(reason);
  expect(calls).toBe(0);
});

test("an action receives the caller signal and cooperatively cancels ongoing work", async () => {
  const controller = new AbortController();
  let started: (() => void) | undefined;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  const action = defineAction({
    id: "wait",
    run: (_input: undefined, ctx: ActionRuntimeContext) =>
      new Promise<void>((_resolve, reject) => {
        expect(ctx.signal).toBe(controller.signal);
        ctx.signal?.addEventListener(
          "abort",
          () => reject(ctx.signal?.reason),
          {
            once: true,
          },
        );
        started?.();
      }),
  });
  const executor = new ActionExecutor({}, () => {});
  const pending = executor.execute(action(), { signal: controller.signal });
  await running;
  const reason = new Error("Stop ongoing work");
  controller.abort(reason);
  const result = await pending;
  expect(result.status).toBe("error");
  if (result.status === "error") expect(result.error).toBe(reason);
});
