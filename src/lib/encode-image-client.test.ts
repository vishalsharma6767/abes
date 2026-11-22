import { describe, expect, it, vi } from "vitest";
import {
  createImageEncodingTask,
  type EncodeWorkerLike,
  type EncodeWorkerResponse,
} from "./encode-image-client";
import type { PayloadInput } from "./image-message-engine";

const payload: PayloadInput = {
  version: 1,
  messageType: "preset",
  message: "need-help",
};
const passphrase = "a sample passphrase for tests";

function createWorker(
  postMessage: EncodeWorkerLike["postMessage"] = () => undefined,
) {
  const worker: EncodeWorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage,
    terminate: vi.fn(),
  };
  return worker;
}

function send(worker: EncodeWorkerLike, data: EncodeWorkerResponse) {
  worker.onmessage?.({ data } as MessageEvent<EncodeWorkerResponse>);
}

describe("createImageEncodingTask", () => {
  it("reports progress and resolves the worker encoding result", async () => {
    let worker: EncodeWorkerLike;
    const blob = new Blob(["png"], { type: "image/png" });
    const progress = vi.fn();
    const task = createImageEncodingTask(blob, payload, passphrase, progress, () => {
      worker = createWorker();
      return worker;
    });

    send(worker!, {
      type: "progress",
      progress: { stage: "checking", percent: 30 },
    });
    send(worker!, {
      type: "result",
      result: {
        ok: true,
        image: blob,
        format: "png",
        payload: { ...payload, integrity: "1234abcd" },
      },
    });

    await expect(task.promise).resolves.toMatchObject({
      ok: true,
      format: "png",
      payload: { message: "need-help" },
    });
    expect(progress).toHaveBeenCalledWith({
      stage: "checking",
      percent: 30,
    });
    expect(worker!.terminate).toHaveBeenCalledOnce();
  });

  it("terminates worker work when cancelled", async () => {
    const worker = createWorker();
    const task = createImageEncodingTask(
      new Blob(["png"]),
      payload,
      passphrase,
      () => undefined,
      () => worker,
    );

    const rejection = expect(task.promise).rejects.toMatchObject({
      name: "AbortError",
    });
    task.cancel();

    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("returns a typed result when a worker cannot be created", async () => {
    const task = createImageEncodingTask(
      new Blob(["png"]),
      payload,
      passphrase,
      () => undefined,
      () => {
        throw new Error("worker unavailable");
      },
    );

    await expect(task.promise).resolves.toMatchObject({
      ok: false,
      error: { message: "Image processing is unavailable in this browser." },
    });
  });
});
