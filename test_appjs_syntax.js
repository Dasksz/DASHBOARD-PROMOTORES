const fs = require('fs');

const code = fs.readFileSync('/app/js/app/app_part3.js', 'utf8');
if (code.includes('renderCategoryRadarChart(radarData);')) {
   console.log("Found call");
} else {
   console.log("Not found call");
}
