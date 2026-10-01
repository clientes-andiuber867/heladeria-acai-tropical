import QRCode from "qrcode";

export async function generateBrandedQRCard(url: string): Promise<string> {
  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = 1800;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar el renderizador.");

  // 1. Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#32123d");
  bgGrad.addColorStop(0.5, "#481b59");
  bgGrad.addColorStop(1, "#280b32");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Decorative ambient glow top-right
  const glow1 = ctx.createRadialGradient(width, 0, 50, width, 0, 700);
  glow1.addColorStop(0, "rgba(163, 77, 183, 0.35)");
  glow1.addColorStop(1, "rgba(163, 77, 183, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  // Decorative ambient glow bottom-left
  const glow2 = ctx.createRadialGradient(0, height, 50, 0, height, 650);
  glow2.addColorStop(0, "rgba(85, 131, 35, 0.2)");
  glow2.addColorStop(1, "rgba(85, 131, 35, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // 2. Load Logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    logoImg.src = "/logo.png";
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve(); // continue even if logo fails
    });

    if (logoImg.complete && logoImg.naturalWidth > 0) {
      const logoSize = 130;
      const logoX = 260;
      const logoY = 130;

      // Draw circular clipped logo
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        logoX + logoSize / 2,
        logoY + logoSize / 2,
        logoSize / 2,
        0,
        Math.PI * 2,
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();

      // Brand Title next to logo
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 52px Outfit, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Açaí Tropical", logoX + logoSize + 25, logoY + 45);

      ctx.fillStyle = "#d2bde0";
      ctx.font = "bold 18px 'DM Sans', sans-serif";
      ctx.fillText(
        "SABOR QUE TE HACE FELIZ",
        logoX + logoSize + 28,
        logoY + 92,
      );
    }
  } catch {
    // Continue
  }

  // 3. Eyebrow
  ctx.fillStyle = "#b9dc86";
  ctx.font = "bold 22px 'DM Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("E S C A N E A ,   E L I G E   Y   D I S F R U T A", width / 2, 380);

  // 4. Headline
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px Outfit, sans-serif";
  ctx.fillText("Tu próximo favorito", width / 2, 465);
  ctx.fillText("está aquí.", width / 2, 540);

  // 5. White Rounded Box for QR Code
  const qrBoxSize = 780;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = 640;
  const radius = 40;

  // Box Shadow
  ctx.save();
  ctx.shadowColor = "rgba(18, 5, 26, 0.4)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;

  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // 6. Generate QR inside white box
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 1200,
    margin: 1,
    errorCorrectionLevel: "H",
    color: {
      dark: "#45204F",
      light: "#ffffff",
    },
  });

  const qrImg = new Image();
  qrImg.src = qrDataUrl;
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve();
  });

  const qrPadding = 45;
  ctx.drawImage(
    qrImg,
    qrBoxX + qrPadding,
    qrBoxY + qrPadding,
    qrBoxSize - qrPadding * 2,
    qrBoxSize - qrPadding * 2,
  );

  // 7. Footer Caption
  ctx.fillStyle = "#f5d36e";
  ctx.font = "bold 44px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Nuestra carta digital", width / 2, 1530);

  // 8. Categories Footer
  ctx.fillStyle = "#d0bcdb";
  ctx.font = "500 26px 'DM Sans', sans-serif";
  ctx.fillText("Açaí · Helados · Comida · Postres · Bebidas", width / 2, 1610);

  return canvas.toDataURL("image/png");
}
