// Stand-in for jsPDF's optional add-ons (html2canvas, dompurify, canvg).
// They power jsPDF's .html() and SVG features, which this app never uses
// (charts are drawn with rectangles and text), so they're kept out of the
// bundle entirely. See resolve.alias in vite.config.ts.
export default {};
