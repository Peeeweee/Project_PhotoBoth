export async function waitForExport(node: HTMLElement) {
  const started = Date.now();
  while (node.dataset.exportReady !== "true") {
    if (Date.now() - started > 10000)
      throw new Error("Your photos are still rendering. Please retry.");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) => img.decode()),
  );
  if (!node.offsetWidth)
    throw new Error("Strip preview is not visible. Please retry.");
}
