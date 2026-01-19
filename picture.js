const scriptURL = 'https://script.google.com/macros/s/AKfycbyMd30Zx8_xiprvsX9s28g5dyaN8WKzRA-TaMoXooYVX0Hv28n5fCYsVaExJBnFHChx/exec'; // Paste your Deployment URL here
const form = document.getElementById('huntForm');
const submitButton = document.querySelector('.btn-submit');

form.addEventListener('submit', e => {
    e.preventDefault();

    // 1. Capture form data into our unused const
    const formData = new FormData(form);
    const newEntry = Object.fromEntries(formData.entries());

    // 2. Visual feedback
    submitButton.disabled = true;
    submitButton.innerText = "Submitting...";

    // 3. OPTIMISTIC UI: Add the row to the table immediately
    const historyBody = document.getElementById('historyBody');
    const tempRow = document.createElement('tr');
    tempRow.id = "temp-row"; // ID to find/remove it later
    tempRow.style.opacity = '0.5'; // Visual cue that it's "pending"

    // Simple formatting for the immediate display
    const displayDate = newEntry.huntDate.split('-').slice(1).join('/') + '/' + newEntry.huntDate.split('-')[0].slice(-2);

    tempRow.innerHTML = `
      <td style="font-weight:bold; color:#f6f0d7;">${displayDate} (Pending...)</td>
      <td>${newEntry.blindLocation}</td>
      <td style="text-align:center;">${newEntry.ducks}</td>
      <td style="text-align:center;">${newEntry.geese}</td>
      <td class="notes-cell">${newEntry.weather}</td>
      <td class="notes-cell">${newEntry.notes}</td>
  `;

    // Insert at the top of the history
    historyBody.prepend(tempRow);

    // 4. Send to Google Sheets
    fetch(scriptURL, { method: 'POST', body: formData })
        .then(response => {
            alert('Hunt Recorded Successfully!');
            submitButton.disabled = false;
            submitButton.innerText = "Submit Hunt to Log";
            form.reset();

            // Remove the "pending" row and refresh the full table
            if (document.getElementById('temp-row')) {
                document.getElementById('temp-row').remove();
            }
            loadHistory();
        })
        .catch(error => {
            alert('Error! Check signal. Your entry is still in the list for now.');
            console.error('Submission Error:', error.message);
            submitButton.disabled = false;
            submitButton.innerText = "Submit Hunt to Log";
        });
});


// Function to fetch and display the history
let allHunts = []; // Global store so we don't have to fetch every time we filter

// 1. Updated loadHistory: Sets default to current 2026 season
function loadHistory() {
    const historyBody = document.getElementById('historyBody');
    const cacheBuster = `?t=${new Date().getTime()}`;

    // Use a simple GET request without custom headers for best compatibility
    fetch(scriptURL + cacheBuster, {
        method: "GET",
        redirect: "follow"
    })
        .then(response => {
            // Check if the response is actually successful (Status 200-299)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })

        .then(data => {
            allHunts = data;
            allHunts.sort((a, b) => new Date(a.huntDate) - new Date(b.huntDate)); // Sort oldest to newest for totals

            const filter = document.getElementById('seasonFilter');
            const seasons = [...new Set(allHunts.map(h => getSeason(h.huntDate)))];

            // Rebuild the menu
            let options = '<option value="all">All Time (Grand Total)</option>';
            seasons.sort().reverse().forEach(s => {
                if (s !== "Invalid Date") {
                    options += `<option value="${s}">${s} Season</option>`;
                }
            });
            filter.innerHTML = options;

            // AUTO-SELECT CURRENT SEASON (2025-2026)
            const currentSeasonStr = getSeason(new Date().toISOString());
            if (seasons.includes(currentSeasonStr)) {
                filter.value = currentSeasonStr;
            } else {
                filter.value = seasons[0] || "all"; // Default to most recent if current season empty
            }

            renderTable(allHunts, filter.value);
        })
        .catch(error => {
            console.error('Error loading history:', error);
            historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Failed to load logs.</td></tr>';
        });
}

function getSeason(dateString) {
    if (!dateString) return "Unknown";

    // Replace hyphens with slashes to prevent timezone "day-shift" bugs
    const cleanDate = dateString.toString().split('T')[0].replace(/-/g, '/');
    const date = new Date(cleanDate);

    if (isNaN(date.getTime())) return "Invalid Date";

    const month = date.getMonth(); // 0 = Jan, 8 = Sept
    const year = date.getFullYear();

    // September (8) to December (11) starts the season
    // January (0) to August (7) is the second half of the previous year's season
    const startYear = (month >= 8) ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
}



function updateSeasonDropdown(hunts) {
    const filter = document.getElementById('seasonFilter');
    const existingValue = filter.value; // Save what the user already picked

    // Find all unique seasons in the data
    const seasons = [...new Set(hunts.map(h => getSeason(h.huntDate)))];
    seasons.sort().reverse(); // Show newest seasons at the top

    // Clear and rebuild the dropdown
    filter.innerHTML = '<option value="all">All Time (Grand Total)</option>';
    seasons.forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = `${s} Season`;
        filter.appendChild(option);
    });

    // Restore the user's previous selection if it still exists
    filter.value = existingValue || "all";
}


// Updated renderTable: Restores Modal Pop-up AND adds Totals Row
function renderTable(hunts, filterValue) {
    const historyBody = document.getElementById('historyBody');
    historyBody.innerHTML = '';
    
    const filteredData = (filterValue === 'all') 
        ? hunts 
        : hunts.filter(h => getSeason(h.huntDate) === filterValue);

    const displayData = [...filteredData].sort((a,b) => new Date(b.huntDate) - new Date(a.huntDate));

    let totalDucks = 0;
    let totalGeese = 0;

    displayData.forEach(row => { 
        totalDucks += parseInt(row.ducks || 0);
        totalGeese += parseInt(row.geese || 0);

        // Photo button logic
        const photoCell = row.photoLink 
            ? `<button onclick="window.open('${row.photoLink}', '_blank')" style="cursor:pointer;">📸 View</button>` 
            : '—';

        const tr = document.createElement('tr');

        // Date Formatting
        let displayDate = "N/A";
        if (row.huntDate) {
            const parts = row.huntDate.toString().split('T')[0].split('-');
            if (parts.length === 3) {
                displayDate = `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0].slice(-2)}`;
            } else {
                displayDate = row.huntDate;
            }
        }

        // Table Rows (7 Columns Total)
        tr.innerHTML = `
            <td>${displayDate}</td>
            <td>${row.blindLocation || 'N/A'}</td>
            <td style="text-align:center;">${row.ducks || 0}</td>
            <td style="text-align:center;">${row.geese || 0}</td>
            <td style="text-align:center;">${photoCell}</td>
            <td class="expandable-cell">${row.weather || ''}</td>
            <td class="expandable-cell">${row.notes || ''}</td>
        `;

        // Modal Logic
        tr.querySelectorAll('.expandable-cell').forEach(cell => {
            cell.addEventListener('click', function() {
                if (this.innerText.trim() === "") return;
                const modal = document.getElementById('noteModal');
                const content = document.getElementById('modalContent');
                content.innerText = this.innerText;
                modal.showModal();
            });
        });

        historyBody.appendChild(tr);
    });

    // --- FIXED TOTALS ROW ---
    const totalsRow = document.createElement('tr');
    totalsRow.id = "totals-row"; 
    // Updated colspan to "3" at the end to cover Photo, Weather, and Notes (1+1+1)
    totalsRow.innerHTML = `
        <td colspan="2" style="font-weight:bold; color:var(--safety-orange);">TOTALS</td>
        <td style="text-align:center; font-weight:bold; color:var(--safety-orange);">${totalDucks}</td>
        <td style="text-align:center; font-weight:bold; color:var(--safety-orange);">${totalGeese}</td>
        <td colspan="3"></td> 
    `;
    historyBody.appendChild(totalsRow);
}



// Separate helper for clean code
function formatDateForDisplay(dateString) {
    const parts = dateString.toString().split('T')[0].split('-');
    return parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0].slice(-2)}` : dateString;
}


// 5. Listener for when the user changes the dropdown
document.getElementById('seasonFilter').addEventListener('change', (e) => {
    renderTable(allHunts, e.target.value);
});



// Automatically refresh data when the app is resumed
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        console.log("App resumed: Refreshing logs...");

        // 1. Give the phone 300ms to reconnect to the cell tower
        setTimeout(() => {
            // 2. Call loadHistory which fetches fresh data and 
            // re-renders the table with the current filter applied.
            loadHistory();
        }, 300);
    }
});

// Set the date input to 'Today' by default for faster entry
document.addEventListener('DOMContentLoaded', () => {
    // 1. Set the date input to 'Today'
    const dateInput = document.getElementById('huntDate');
    if (dateInput) {
        // Correctly handles the YYYY-MM-DD format for 2026
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // 2. Force numeric keypad for bird counts (Big UX improvement for mobile)
    const ducksInput = document.getElementById('ducks');
    const geeseInput = document.getElementById('geese');

    if (ducksInput) ducksInput.setAttribute('inputmode', 'numeric');
    if (geeseInput) geeseInput.setAttribute('inputmode', 'numeric');

    // 3. Initial load of the history table
    loadHistory();
});

// Corrected Photo Input Logic for Golden Triangle Hunting Club (2026)
const photoInput = document.getElementById('photoCapture');
const photoLinkInput = document.getElementById('photoLink');
const previewImg = document.getElementById('imagePreview');
const statusText = document.getElementById('uploadStatus');

photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Show preview box and image immediately
    document.getElementById('photoPreviewBox').style.display = 'block';
    previewImg.src = URL.createObjectURL(file);
    statusText.innerText = "Uploading to cloud...";

    // 2. Prepare the data for ImgBB
    const formData = new FormData();
    formData.append('image', file);

    try {
        // Your specific ImgBB API Key
        const apiKey = 'c35b3973813bbd067239a605b612f231'; 

        // 3. The Fetch Call
        // FIX: Added /1/upload and the correct ?key= syntax using backticks
         const response = await fetch(`https://api.imgbb.com{apiKey}`, {
            method: 'POST',
            body: formData
        });

        // 4. Handle the response
        const data = await response.json();

        if (data.success) {
            const url = data.data.url;
            
            // Save the URL into the hidden input so Google Sheets gets it
            photoLinkInput.value = url; 
            
            // Success Message
            statusText.innerHTML = `✅ Link ready: <a href="${url}" target="_blank">View Photo</a>`;
        } else {
            console.error("ImgBB Error Response:", data);
            statusText.innerText = "❌ Upload error. Check API key.";
        }
    } catch (error) {
        // This usually catches DNS (Network) or CORS errors
        console.error("Detailed Fetch Error:", error);
        statusText.innerText = "❌ Connection error. Use GitHub HTTPS link.";
    }
});







// Initial load when page opens
loadHistory();
