/// <reference lib="webworker" />

import {
  encodeImage,
  type EncodingProgress,
  type EncodingResult,
  type PayloadInput,
} from "../lib/image-message-engine";

type EncodeRequest = {
  image: Blob;
  payload: PayloadInput;
  passphrase: string;
};

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", async (event: MessageEvent<EncodeRequest>) => {
  try {
    const result = await encodeImage(
      event.data.image,
      event.data.payload,
      event.data.passphrase,
      {
        onProgress: (progress: EncodingProgress) =>
          workerScope.postMessage({ type: "progress", progress }),
      },
    );
    const response: { type: "result"; result: EncodingResult } = {
      type: "result",
      result,
    };
    workerScope.postMessage(response);
  } catch {
    workerScope.postMessage({
      type: "result",
      result: {
        ok: false,
        error: {
          code: "corrupted-image",
          message: "The image could not be encoded. Choose a valid PNG and try again.",
        },
      } satisfies EncodingResult,
    });
  }
});

export {};
