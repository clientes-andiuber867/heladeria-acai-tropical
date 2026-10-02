import ExcelJS from "exceljs";
import type { Sale } from "../../types";
import type { SalesExportFilters } from "../../services/salesExport";
import { orderCode, stamp } from "../../lib/format";

const purple = "542468",
  green = "EAF1DD",
  ink = "292331";
const currency = '"Bs "#,##0.00;[Red]-"Bs "#,##0.00';
export async function buildSalesWorkbook(
  sales: Sale[],
  filters: SalesExportFilters,
  logo: ArrayBuffer,
) {
  const book = new ExcelJS.Workbook();
  book.views = [
    {
      x: 0,
      y: 0,
      width: 16000,
      height: 9000,
      visibility: "visible",
      activeTab: 0,
      firstSheet: 0,
    },
  ];
  book.creator = "Açaí Tropical";
  book.created = new Date();
  book.calcProperties.fullCalcOnLoad = true;
  const image = book.addImage({ buffer: logo, extension: "png" });
  const filterLabel = `${filters.from} — ${filters.to} | Pago: ${filters.method || "Todos"} | Estado: ${filters.status === "completed" ? "Completadas" : filters.status === "voided" ? "Anuladas" : "Todos"}`;
  function sheet(name: string, headers: string[], widths: number[]) {
    const s = book.addWorksheet(name, {
      views: [
        {
          state: "frozen",
          ySplit: 7,
          showGridLines: true,
          xSplit: name === "Resumen" ? 0 : 1,
        },
      ],
      properties: { tabColor: { argb: purple } },
      pageSetup: {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: "1:7",
      },
    });
    s.columns = widths.map((width) => ({ width }));
    const bannerEnd = Math.min(headers.length, 11);
    for (let r = 1; r <= 3; r++)
      for (let c = 1; c <= headers.length; c++) {
        s.getCell(r, c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: purple },
        };
      }
    s.mergeCells("A1:A3");
    s.mergeCells(1, 2, 2, bannerEnd);
    s.getCell("B1").value = "AÇAÍ TROPICAL";
    s.getCell("B1").font = {
      name: "Calibri",
      size: 23,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    s.getCell("B1").alignment = { vertical: "middle", indent: 1 };
    s.mergeCells(3, 2, 3, bannerEnd);
    s.getCell("B3").value = `${name.toUpperCase()}  /  REPORTE DE VENTAS`;
    s.getCell("B3").font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: "D6E7A5" },
    };
    s.getCell("B3").alignment = { indent: 2, vertical: "middle" };
    s.addImage(image, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 64, height: 64 },
    });
    s.getRow(1).height = 24;
    s.getRow(2).height = 20;
    s.getRow(3).height = 22;
    s.mergeCells(4, 1, 4, bannerEnd);
    s.getCell("A4").value = filterLabel;
    s.getCell("A4").font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: purple },
    };
    s.getCell("A4").alignment = {
      vertical: "middle",
      indent: 1,
      wrapText: true,
    };
    s.getCell("A4").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: green },
    };
    s.mergeCells(5, 1, 5, bannerEnd);
    s.getCell("A5").value =
      `Emitido: ${stamp(book.created!.toISOString())}  |  Bolivia  |  BOB (Bs)`;
    s.getCell("A5").font = {
      name: "Calibri",
      size: 10,
      color: { argb: "63566E" },
    };
    s.getCell("A5").alignment = { vertical: "middle", indent: 1 };
    s.getRow(4).height = 25;
    s.getRow(5).height = 21;
    s.getRow(6).height = 8;
    s.getRow(7).values = headers;
    s.getRow(7).height = 44;
    s.getRow(7).eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: purple } };
      c.font = {
        bold: true,
        color: { argb: "FFFFFF" },
        name: "Calibri",
        size: 11,
      };
      c.alignment = { vertical: "middle", wrapText: true };
      const edge = { style: "thin" as const, color: { argb: "9B81AB" } };
      c.border = { top: edge, bottom: edge, left: edge, right: edge };
    });
    s.headerFooter.oddFooter = "Açaí Tropical | &P de &N";
    return s;
  }
  const measure = document.createElement("canvas").getContext("2d");
  if (measure) measure.font = "11pt Calibri, Arial, sans-serif";
  function wrapText(text: string, width: number): string[] {
    const max = Math.max(28, width * 7 - 16),
      result: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/(?<=\s)/)) {
        if (
          line &&
          (measure?.measureText(line + word).width ||
            (line + word).length * 7) > max
        ) {
          result.push(line.trimEnd());
          line = "";
        }
        for (const ch of word) {
          if (
            line &&
            (measure?.measureText(line + ch).width || (line + ch).length * 7) >
              max
          ) {
            result.push(line.trimEnd());
            line = "";
          }
          line += ch;
        }
      }
      result.push(line.trimEnd());
    }
    return result;
  }
  function finish(s: ExcelJS.Worksheet, numeric: number[]) {
    for (let n = 8; n <= s.rowCount; n++) {
      const row = s.getRow(n);
      let lines = 1;
      const overflow: Record<number, string[]> = {};
      for (let col = 1; col <= s.columnCount; col++) {
        const value = row.getCell(col).value;
        if (typeof value !== "string") continue;
        const wrapped = wrapText(value, s.getColumn(col).width || 12);
        lines = Math.max(lines, Math.min(24, wrapped.length));
        if (wrapped.length > 24) {
          row.getCell(col).value = wrapped.slice(0, 24).join("\n");
          overflow[col] = wrapped.slice(24);
        }
      }
      // Excel limits row height: very long text continues on a separate row.
      // Monetary values and status remain only on the original sale row.
      if (Object.keys(overflow).length) {
        const values: (string | null)[] = Array(s.columnCount).fill(null);
        values[0] = `${row.getCell(1).text} (continúa)`;
        for (const [col, text] of Object.entries(overflow))
          values[Number(col) - 1] = text.join("\n");
        s.insertRow(n + 1, values);
      }
      row.height = Math.max(26, lines * 14 + 10);
      for (let col = 1; col <= s.columnCount; col++) {
        const c = row.getCell(col);
        const edge = { style: "thin" as const, color: { argb: "CEC4D6" } };
        c.border = { top: edge, bottom: edge, left: edge, right: edge };
        c.font = { name: "Calibri", size: 11, color: { argb: ink } };
        c.alignment = { vertical: "middle", wrapText: true };
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: n % 2 === 0 ? "F4F0F7" : "FFFFFF" },
        };
        if (numeric.includes(col)) {
          c.numFmt = currency;
          c.alignment = { vertical: "middle", horizontal: "right" };
        }
      }
    }
    s.autoFilter = {
      from: { row: 7, column: 1 },
      to: { row: Math.max(7, s.rowCount), column: s.columnCount },
    };
  }
  const orders = sheet(
    "Ventas",
    [
      "Pedido",
      "Fecha",
      "Hora",
      "Responsable",
      "Estado",
      "Forma de pago",
      "Total venta",
      "Efectivo aplicado",
      "QR",
      "Efectivo recibido",
      "Cambio",
      "Productos vendidos (cantidad × nombre)",
      "Observación",
      "Motivo anulación",
    ],
    [15, 12, 11, 23, 14, 14, 16, 16, 16, 16, 16, 44, 36, 36],
  );
  const items = sheet(
    "Detalle de productos",
    [
      "Pedido",
      "Fecha",
      "Hora",
      "Responsable",
      "Estado",
      "Producto",
      "Cantidad",
      "Precio unitario",
      "Subtotal",
    ],
    [15, 12, 11, 23, 14, 36, 11, 16, 16],
  );
  const summary = sheet(
    "Resumen",
    ["Indicador", "Valor", "Detalle"],
    [30, 23, 64],
  );
  for (const sale of sales) {
    // Excel dates have no timezone: encode the Bolivia wall-clock as UTC fields.
    const local = new Date(new Date(sale.created_at).getTime() - 4 * 3600000);
    const date = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
    );
    const time =
      (local.getUTCHours() * 3600 +
        local.getUTCMinutes() * 60 +
        local.getUTCSeconds()) /
      86400;
    const state = sale.status === "completed" ? "Completada" : "Anulada";
    orders.addRow([
      orderCode(sale),
      date,
      time,
      sale.cashier_name,
      state,
      sale.payment_method,
      sale.total,
      sale.cash_amount,
      sale.qr_amount,
      sale.cash_received,
      sale.cash_amount > 0 ? (sale.cash_received || 0) - sale.cash_amount : 0,
      sale.sale_items
        .map((i) => `${i.quantity} × ${i.product_name}`)
        .join("\n"),
      sale.note || "",
      sale.void_reason || "",
    ]);
    for (const item of sale.sale_items) {
      const r = items.addRow([
        orderCode(sale),
        date,
        time,
        sale.cashier_name,
        state,
        item.product_name,
        item.quantity,
        item.unit_price,
        null,
      ]);
      r.getCell(9).value = {
        formula: `G${r.number}*H${r.number}`,
        result: Math.round(item.quantity * item.unit_price * 100) / 100,
      };
    }
  }
  finish(orders, [7, 8, 9, 10, 11]);
  finish(items, [8, 9]);
  for (let n = 8; n <= items.rowCount; n++) {
    const row = items.getRow(n);
    if (
      typeof row.getCell(7).value === "number" &&
      typeof row.getCell(8).value === "number"
    )
      row.getCell(9).value = {
        formula: `G${n}*H${n}`,
        result:
          Math.round(
            Number(row.getCell(7).value) * Number(row.getCell(8).value) * 100,
          ) / 100,
      };
  }
  for (const s of [orders, items])
    for (let n = 8; n <= s.rowCount; n++) {
      s.getCell(n, 2).numFmt = "dd/mm/yyyy";
      s.getCell(n, 3).numFmt = "hh:mm:ss";
      if (s.getCell(n, 5).value === "Anulada")
        s.getCell(n, 5).font = { color: { argb: "A52C47" }, bold: true };
    }
  const completed = sales.filter((s) => s.status === "completed");
  const end = Math.max(8, orders.rowCount);
  const total = (key: "total" | "cash_amount" | "qr_amount") =>
    Math.round(completed.reduce((a, s) => a + s[key], 0) * 100) / 100;
  summary.addRow([
    "Ventas exportadas",
    sales.length,
    "Todas las ventas que coinciden con los filtros, sin límite de página.",
  ]);
  summary.addRow([
    "Ventas completadas",
    {
      formula: `COUNTIFS('Ventas'!E8:E${end},"Completada")`,
      result: completed.length,
    },
    "Operaciones cobradas.",
  ]);
  summary.addRow([
    "Ventas anuladas",
    {
      formula: `COUNTIFS('Ventas'!E8:E${end},"Anulada")`,
      result: sales.length - completed.length,
    },
    "Conservadas en el detalle y excluidas de los cobros.",
  ]);
  for (const [label, col, key] of [
    ["Ingresos cobrados", "G", "total"],
    ["Efectivo neto de cambio", "H", "cash_amount"],
    ["Registrado por QR", "I", "qr_amount"],
  ] as const) {
    const row = summary.addRow([
      label,
      {
        formula: `SUMIFS('Ventas'!${col}8:${col}${end},'Ventas'!E8:E${end},"Completada")`,
        result: total(key),
      },
      key === "qr_amount"
        ? "Contrastarlo con los abonos del banco."
        : "Solo ventas completadas.",
    ]);
    row.getCell(2).numFmt = currency;
  }
  summary.addRow([
    "Detalle de productos",
    "Una fila por producto",
    "Los importes de cada pedido figuran una sola vez en Ventas para evitar duplicarlos.",
  ]);
  summary.addRow([
    "Fuente",
    "Historial de ventas · Supabase",
    "Reporte interno. No sustituye una factura fiscal ni un arqueo de caja.",
  ]);
  finish(summary, []);
  summary.autoFilter = undefined;
  for (let r = 11; r <= 13; r++) {
    summary.getCell(r, 2).numFmt = currency;
    summary.getRow(r).eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
      c.font = {
        name: "Calibri",
        bold: true,
        size: 12,
        color: { argb: purple },
      };
    });
  }
  return book;
}

export async function downloadSalesWorkbook(
  sales: Sale[],
  filters: SalesExportFilters,
) {
  const response = await fetch("/logo.png");
  if (!response.ok)
    throw new Error("No se pudo cargar el logo. Intenta de nuevo.");
  const book = await buildSalesWorkbook(
    sales,
    filters,
    await response.arrayBuffer(),
  );
  const buffer = await book.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Acai_Tropical_Ventas_${filters.from}_${filters.to}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
