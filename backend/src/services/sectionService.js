// Matches numbered headings like "1.0 Introduction" or
// "1.1 Background of the Study" on their own line.
const HEADING_PATTERN = /^\d+(?:\.\d+)*\s+[A-Z][A-Za-z0-9 ,'()-]{2,80}$/;

// Detects one section label per page using a simple heuristic: scan each
// page's lines for a numbered heading, and carry the most recently seen
// heading forward across pages that don't start a new one. This is an
// approximation - a heading appearing partway down a page still tags that
// whole page - but every label comes from real text in the document,
// never invented.
function detectPageSections(pageTexts) {
  const sections = [];
  let currentSection = null;

  for (const page of pageTexts) {
    const lines = page.text.split("\n").map((line) => line.trim());
    const headingsOnPage = lines.filter((line) => HEADING_PATTERN.test(line));

    if (headingsOnPage.length > 0) {
      currentSection = headingsOnPage[headingsOnPage.length - 1];
    }

    sections.push(currentSection);
  }

  return sections;
}

module.exports = {
  detectPageSections,
};
