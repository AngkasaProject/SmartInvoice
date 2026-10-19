import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface GeneratedPdfResult {
  fileName: string;
  base64DataUri: string;
  blob: Blob;
}

/**
 * Renders an HTML element as high-resolution PDF and returns Base64 & Blob
 */
export async function generateInvoicePdf(
  elementId: string,
  fileName: string = 'Invoice.pdf'
): Promise<GeneratedPdfResult> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Elemen invoice dengan ID "${elementId}" tidak ditemukan.`);
  }

  // Clone or capture with high scale for high-DPI crisp rendering
  const canvas = await html2canvas(element, {
    scale: 2.2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // A4 dimensions in mm: 210 x 297
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  // If height exceeds A4, add pages or fit
  if (pdfHeight <= pdf.internal.pageSize.getHeight()) {
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  } else {
    // Multi-page slicing if invoice is very long
    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = position - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }
  }

  const base64DataUri = pdf.output('datauristring');
  const blob = pdf.output('blob');

  return {
    fileName,
    base64DataUri,
    blob,
  };
}

/**
 * Triggers direct browser file download of the PDF
 */
export async function downloadInvoicePdf(elementId: string, fileName: string): Promise<void> {
  const result = await generateInvoicePdf(elementId, fileName);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(result.blob);
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
