export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Extract headers from the keys of the first object
  const headers = Object.keys(data[0]);
  
  // Build CSV rows
  const csvRows = [];
  csvRows.push(headers.join(',')); // Header row

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] !== undefined && row[header] !== null ? row[header] : '';
      // Escape commas and quotes inside string values
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  // Create a Blob and trigger download
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}