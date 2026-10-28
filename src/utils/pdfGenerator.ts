import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export interface GeneratedPdfResult {
  fileName: string;
  base64DataUri: string;
  blob: Blob;
}

export async function generateInvoicePdf(
  elementId: string,
  fileName: string = "Invoice.pdf",
): Promise<GeneratedPdfResult> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(
      `Elemen invoice dengan ID "${elementId}" tidak ditemukan. Pastikan elemen tersebut ada di halaman.`,
    );
  }

  // 1. Beri sedikit waktu agar layout React selesai dirender
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    // 2. Render ke Canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Kualitas HD
      useCORS: true,
      logging: false, // Matikan log agar console bersih
      backgroundColor: "#ffffff",
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: 1200, // Paksa render seolah-olah layar desktop lebar
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error(
        "Elemen invoice tidak memiliki ukuran (0x0). Pastikan elemen terlihat di layar saat PDF dibuat.",
      );
    }

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Hitung tinggi gambar proporsional
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // Halaman pertama
    pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Halaman berikutnya (jika ada)
    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const base64DataUri = pdf.output("datauristring");
    const blob = pdf.output("blob");

    return {
      fileName,
      base64DataUri,
      blob,
    };
  } catch (error: any) {
    console.error("Error generate PDF:", error);
    throw new Error(
      `Gagal membuat PDF: ${error.message || "Terjadi kesalahan pada html2canvas."}`,
    );
  }
}

export async function generateMultiPagePdf(
  elementIds: string[],
  fileName: string,
): Promise<GeneratedPdfResult> {
  if (elementIds.length === 0) {
    throw new Error("Tidak ada dokumen yang dipilih untuk dibuat menjadi PDF.");
  }

  const elements = elementIds.map((elementId) => {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(
        `Elemen dokumen dengan ID "${elementId}" tidak ditemukan.`,
      );
    }
    return element;
  });

  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (const [index, element] of elements.entries()) {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: 1200,
      });

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error(
          `Dokumen dengan ID "${element.id}" tidak memiliki ukuran yang dapat dicetak.`,
        );
      }

      if (index > 0) {
        pdf.addPage();
      }

      const imageData = canvas.toDataURL("image/jpeg", 0.95);
      const scale = Math.min(
        pageWidth / canvas.width,
        pageHeight / canvas.height,
      );
      const imageWidth = canvas.width * scale;
      const imageHeight = canvas.height * scale;
      pdf.addImage(
        imageData,
        "JPEG",
        (pageWidth - imageWidth) / 2,
        (pageHeight - imageHeight) / 2,
        imageWidth,
        imageHeight,
      );
    }

    return {
      fileName,
      base64DataUri: pdf.output("datauristring"),
      blob: pdf.output("blob"),
    };
  } catch (error: any) {
    console.error("Error generate multi-page PDF:", error);
    throw new Error(
      `Gagal membuat PDF: ${error.message || "Terjadi kesalahan pada html2canvas."}`,
    );
  }
}

/**
 * Helper internal: memicu unduhan Blob di browser.
 * Tahan banting untuk Chrome, Firefox, Safari, Edge, dan WebView.
 */
function downloadBlob(blob: Blob, fileName: string): void {
  const safeName = fileName.toLowerCase().endsWith(".pdf")
    ? fileName
    : `${fileName}.pdf`;

  // Fallback legacy (IE / Edge lama)
  const nav = window.navigator as any;
  if (typeof nav.msSaveOrOpenBlob === "function") {
    nav.msSaveOrOpenBlob(blob, safeName);
    return;
  }
  if (typeof nav.msSaveBlob === "function") {
    nav.msSaveBlob(blob, safeName);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  // Jangan revoke langsung — beberapa browser (Safari/WebView) butuh jeda
  // agar proses unduhan sempat dimulai sebelum URL dihapus.
  setTimeout(() => {
    try {
      document.body.removeChild(link);
    } catch {
      /* sudah dilepas, abaikan */
    }
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Membuat PDF dari elemen lalu langsung memicu unduhan di browser.
 * Ini fungsi yang harus dipanggil oleh tombol "Unduh PDF".
 */
export async function downloadInvoicePdf(
  elementId: string,
  fileName: string,
): Promise<void> {
  const result = await generateInvoicePdf(elementId, fileName);
  downloadBlob(result.blob, result.fileName);
}

export async function downloadMultiPagePdf(
  elementIds: string[],
  fileName: string,
): Promise<void> {
  const result = await generateMultiPagePdf(elementIds, fileName);
  downloadBlob(result.blob, result.fileName);
}
