/* esphome_compact.js - Color script for v1 */
console.log("ESPHome Tracker V1 JS injected");

setInterval(function () {
    var rows = document.querySelectorAll('table#states tr');
    for (var i = 0; i < rows.length; i++) {
        var valCell = rows[i].querySelector('td:nth-child(2)');
        if (!valCell) continue;

        var text = valCell.textContent;
        // reset applied styling
        valCell.style.color = '#e5e7eb';
        valCell.style.borderLeft = 'none';
        valCell.style.paddingLeft = '0';
        valCell.style.fontWeight = 'normal';

        // Apply beautiful brand colors
        if (text.indexOf('[Apple') !== -1) {
            valCell.style.color = '#60a5fa'; // Blue
            valCell.style.fontWeight = 'bold';
        } else if (text.indexOf('[Samsung]') !== -1) {
            valCell.style.color = '#c084fc'; // Purple
            valCell.style.fontWeight = 'bold';
        } else if (text.indexOf('[Google') !== -1 || text.indexOf('[Android]') !== -1) {
            valCell.style.color = '#34d399'; // Green
            valCell.style.fontWeight = 'bold';
        } else if (text.indexOf('[Xiaomi]') !== -1 || text.indexOf('[Tile]') !== -1) {
            valCell.style.color = '#fb923c'; // Orange
            valCell.style.fontWeight = 'bold';
        } else if (text.indexOf('[Microsoft') !== -1) {
            valCell.style.color = '#38bdf8'; // Light Blue
            valCell.style.fontWeight = 'bold';
        } else if (text.indexOf('(Pas de Manuf)') !== -1) {
            valCell.style.color = '#6b7280'; // Dim Gray
        }

        // Apply Random MAC styling
        if (text.indexOf('[PRIVÉE/ALÉATOIRE]') !== -1) {
            valCell.style.borderLeft = '4px solid #f59e0b'; // Amber border
            valCell.style.paddingLeft = '12px';
        }
    }
}, 500);
