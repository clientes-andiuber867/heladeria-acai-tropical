import receiptCss from "../features/sales/receipt.css?inline";

/** Only the receipt enters the print document; the app layout cannot add pages. */
export async function printReceipt(element: HTMLElement): Promise<void> {
  const frame = document.createElement("iframe");
  frame.title = "Imprimir comprobante";
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante Açaí Tropical</title></head><body></body></html>',
    );
    doc.close();
    const style = doc.createElement("style");
    style.textContent =
      receiptCss +
      "\n@page{size:A4;margin:12mm} body{margin:0;background:white} .sale-document{padding:0;width:100%;max-width:none}";
    doc.head.appendChild(style);
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("img").forEach((img) => {
      img.src = new URL(img.getAttribute("src")!, location.href).href;
    });
    doc.body.appendChild(clone);
    await Promise.all(
      Array.from(doc.images).map((img) => img.decode().catch(() => {})),
    );
    await doc.fonts.ready;
    frame.contentWindow!.addEventListener(
      "afterprint",
      () => setTimeout(() => frame.remove(), 1000),
      { once: true },
    );
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 120000);
  } catch (error) {
    frame.remove();
    throw error;
  }
}
