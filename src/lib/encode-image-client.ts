import type {
  EncodingProgress,
  EncodingResult,
  PayloadInput,
} from "./image-message-engine";

export type EncodeWorkerResponse =
  | { type: "progress"; progress: EncodingProgress }
  | { type: "result"; result: EncodingResult };

export type EncodeWorkerLike = {
  onmessage: ((event: MessageEvent<EncodeWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (message: {
    image: Blob;
    payload: PayloadInput;
    passphrase: string;
  }) => void;
  terminate: () => void;
};

export type ImageEncodingTask = {
  promise: Promise<EncodingResult>;
  cancel: () => void;
};

export function createImageEncodingTask(
  image: Blob,
  payload: PayloadInput,
  passphrase: string,
  onProgress: (progress: EncodingProgress) => void,
  createWorker: () => EncodeWorkerLike = () =>
    new Worker(
      new URL("../workers/encode.worker.ts", import.meta.url),
      { type: "module" },
    ) as EncodeWorkerLike,
): ImageEncodingTask {
  let worker: EncodeWorkerLike;
  try {
    worker = createWorker();
  } catch {
    return {
      promise: Promise.resolve({
        ok: false,
        error: {
          code: "corrupted-image",
          message: "Image processing is unavailable in this browser.",
        },
      }),
      cancel: () => undefined,
    };
  }

  let settled = false;
  let rejectPromise: (reason: DOMException) => void = () => undefined;
  const promise = new Promise<EncodingResult>((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = ({ data }) => {
      if (settled) return;
      if (data.type === "progress") {
        onProgress(data.progress);
        return;
      }
      settled = true;
      worker.terminate();
      resolve(data.result);
    };
    worker.onerror = () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve({
        ok: false,
        error: {
          code: "corrupted-image",
          message: "The image could not be encoded. Choose a valid PNG and try again.",
        },
      });
    };

    try {
      worker.postMessage({ image, payload, passphrase });
    } catch {
      settled = true;
      worker.terminate();
      resolve({
        ok: false,
        error: {
          code: "corrupted-image",
          message: "The image could not be sent to the local processing worker.",
        },
      });
    }
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectPromise(new DOMException("Encoding was cancelled.", "AbortError"));
    },
  };
}

export function createEncodedImageUrl(result: EncodingResult): string | null {
  if (!result.ok) return null;
  return URL.createObjectURL(result.image);
}

export function revokeEncodedImageUrl(url: string): void {
  URL.revokeObjectURL(url);
}
