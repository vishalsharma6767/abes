/// <reference lib="webworker" />

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", async (event: MessageEvent<File>) => {
  try {
    const bitmap = await createImageBitmap(event.data);
    const { width, height } = bitmap;
    bitmap.close();
    workerScope.postMessage({ type: "dimensions", width, height });
  } catch {
    workerScope.postMessage({ type: "error" });
  }
});

export {};
