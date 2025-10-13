// Script to analyze temple data and find missing information
const fs = require('fs');

// Load the temple data from file
const templeDataFile = fs.readFileSync('./temple-data.js', 'utf8');

// Extract the JSON array from the file content
const jsonMatch = templeDataFile.match(/window\.divyaDesams\s*=\s*(\[[\s\S]*?\]);/);
if (!jsonMatch) {
  console.error('Could not find temple data in file');
  process.exit(1);
}

const templeData = JSON.parse(jsonMatch[1]);

// Function to check if a value is missing
function isMissing(value) {
  return value === null ||
         value === undefined ||
         value === '' ||
         value === 'Unknown' ||
         (typeof value === 'string' && value.trim() === '') ||
         (Array.isArray(value) && value.length === 0);
}

// Function to check if coordinates are invalid
function hasInvalidCoordinates(lat, lng) {
  return lat === 0 && lng === 0;
}

// Analyze each temple
const missingDataReport = {
  totalTemples: templeData.length,
  templesWithMissingData: [],
  summary: {
    missingPerumal: 0,
    missingThaayaar: 0,
    missingDistrict: 0,
    missingWikidata: 0,
    missingLocality: 0,
    invalidCoordinates: 0
  }
};

templeData.forEach((temple, index) => {
  const missingFields = [];

  if (isMissing(temple.perumal)) {
    missingFields.push('perumal');
    missingDataReport.summary.missingPerumal++;
  }

  if (isMissing(temple.thaayaar)) {
    missingFields.push('thaayaar');
    missingDataReport.summary.missingThaayaar++;
  }

  if (isMissing(temple.district)) {
    missingFields.push('district');
    missingDataReport.summary.missingDistrict++;
  }

  if (isMissing(temple.wikidata_qid)) {
    missingFields.push('wikidata_qid');
    missingDataReport.summary.missingWikidata++;
  }

  if (isMissing(temple.locality)) {
    missingFields.push('locality');
    missingDataReport.summary.missingLocality++;
  }

  if (hasInvalidCoordinates(temple.lat, temple.lng)) {
    missingFields.push('coordinates');
    missingDataReport.summary.invalidCoordinates++;
  }

  if (missingFields.length > 0) {
    missingDataReport.templesWithMissingData.push({
      index: index + 1,
      name: temple.name,
      displayName: temple.displayName,
      missingFields: missingFields,
      currentData: {
        perumal: temple.perumal,
        thaayaar: temple.thaayaar,
        district: temple.district,
        locality: temple.locality,
        wikidata_qid: temple.wikidata_qid,
        coordinates: `${temple.lat}, ${temple.lng}`
      }
    });
  }
});

// Output the report
console.log('=== TEMPLE DATA ANALYSIS REPORT ===\n');
console.log(`Total temples analyzed: ${missingDataReport.totalTemples}`);
console.log(`Temples with missing data: ${missingDataReport.templesWithMissingData.length}\n`);

console.log('=== SUMMARY OF MISSING DATA ===');
console.log(`Temples missing perumal: ${missingDataReport.summary.missingPerumal}`);
console.log(`Temples missing thaayaar: ${missingDataReport.summary.missingThaayaar}`);
console.log(`Temples missing district: ${missingDataReport.summary.missingDistrict}`);
console.log(`Temples missing wikidata_qid: ${missingDataReport.summary.missingWikidata}`);
console.log(`Temples missing locality: ${missingDataReport.summary.missingLocality}`);
console.log(`Temples with invalid coordinates: ${missingDataReport.summary.invalidCoordinates}\n`);

console.log('=== DETAILED LIST OF TEMPLES WITH MISSING DATA ===\n');

missingDataReport.templesWithMissingData.forEach((temple, idx) => {
  console.log(`${idx + 1}. ${temple.displayName}`);
  console.log(`   Missing fields: ${temple.missingFields.join(', ')}`);
  console.log(`   Current data:`);
  console.log(`     - Perumal: ${temple.currentData.perumal}`);
  console.log(`     - Thaayaar: ${temple.currentData.thaayaar}`);
  console.log(`     - District: ${temple.currentData.district}`);
  console.log(`     - Locality: ${temple.currentData.locality}`);
  console.log(`     - Wikidata QID: ${temple.currentData.wikidata_qid}`);
  console.log(`     - Coordinates: ${temple.currentData.coordinates}`);
  console.log('');
});

// Save detailed report to file
const reportFileName = 'missing-data-report.json';
fs.writeFileSync(reportFileName, JSON.stringify(missingDataReport, null, 2));
console.log(`\nDetailed report saved to: ${reportFileName}`);
