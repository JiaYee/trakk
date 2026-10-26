(function () {
  "use strict";

  function downloadPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library failed to load. Please refresh the page.");
      return;
    }

    var data = window.trakkLog && window.trakkLog.getExportData;
    if (!data) return;
    var exportData = window.trakkLog.getExportData();

    if (!exportData.rows.length) {
      alert("Select at least one commit type to export.");
      return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var margin = 14;
    var pageWidth = doc.internal.pageSize.getWidth();
    var contentWidth = pageWidth - margin * 2;
    var y = margin;

    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    var titleLines = doc.splitTextToSize(exportData.title, contentWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7 + 4;

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    var typesLine = "Types shown: " + exportData.typesLabel;
    doc.text(typesLine, margin, y);
    y += 8;

    var body = exportData.rows.map(function (row) {
      return [row.date, row.task, row.hours];
    });

    doc.autoTable({
      startY: y,
      head: [["Date", "Task", "Hours"]],
      body: body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [96, 96, 96], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: contentWidth - 22 - 18 },
        2: { cellWidth: 18, halign: "right" },
      },
    });

    y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    var totalLine = "Total hours: " + exportData.filteredTotal;
    if (exportData.isFiltered) {
      totalLine +=
        " (" + exportData.fullTotal + " including hidden types)";
    }
    doc.text(totalLine, margin, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    var generated = "Generated from Trakk · " + new Date().toISOString().slice(0, 10);
    doc.text(generated, margin, y);

    doc.save(exportData.filename);
  }

  window.trakkLog = window.trakkLog || {};
  window.trakkLog.downloadPdf = downloadPdf;
})();
