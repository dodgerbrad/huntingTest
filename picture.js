const scriptURL = 'https://script.google.com/macros/s/AKfycbxK4yBRIrkGPSV2eqjKkE2UnpU5pu8Kaxt9VuIcnKXLzq0KX6uuxSmpN1Iz8WA42rmG/exec'; 
const form = document.getElementById('huntForm');
const submitButton = document.querySelector('.btn-submit');

// --- 1. FORM SUBMISSION LOGIC ---
form.addEventListener('submit', e => {
    e.preventDefault();

    // 1. Get the latest values directly from the inputs
    const photoLinkValue = document.getElementById('photoLink').value;
    const huntDate = document.getElementById('huntDate').value;
    const blind = document.getElementById('blindLocation').value;
    const ducks = document.getElementById('ducks').value;
    const geese = document.getElementById('geese').value;
    const weather = document.getElementById('weather').value;
    const notes = document.getElementById('notes').value;

    // 2. Safety Check: If a photo was taken but hasn't finished uploading
    if (document.getElementById('photoCapture').files.length > 0 && !photoLinkValue) {
        alert("Please wait for the photo to finish uploading (Look for the ✅ Ready message).");
        return;
    }

    // 3. Visual feedback: Disable button
    submitButton.disabled = true;
    submitButton.innerText = "Submitting to Log...";

    // 4. OPTIMISTIC UI: Add the row to the table immediately so the user sees it
    const historyBody = document.getElementById('historyBody');
    const tempRow = document.createElement('tr');
    tempRow.id = "temp-row";
    tempRow.style.opacity = '0.5';

    // Format date for the pending row
    const displayDate = huntDate.split('-').slice(1).join('/') + '/' + huntDate.split('-')[0].slice(-2);
    const photoPreview = photoLinkValue ? "📸 Uploading..." : "—";

    tempRow.innerHTML = `
      <td style="font-weight:bold; color:#f6f0d7;">${displayDate}</td>
      <td>${blind}</td>
      <td style="text-align:center;">${ducks}</td>
      <td style="text-align:center;">${geese}</td>
      <td style="text-align:center;">${photoPreview}</td>
      <td class="notes-cell">${weather}</td>
      <td class="notes-cell">${notes}</td>
    `;
    historyBody.prepend(tempRow);

    // 5. Build the data package for Google Sheets
    // We use URLSearchParams because it is the most reliable format for Safari 2026
    const params = new URLSearchParams();
    params.append('huntDate', huntDate);
    params.append('blindLocation', blind);
    params.append('ducks', ducks);
    params.append('geese', geese);
    params.append('photoLink', photoLinkValue); // The ImgBB link
    params.append('weather', weather);
    params.append('notes', notes);

    // 6. Send to Google Sheets
    fetch(scriptURL, { 
        method: 'POST', 
        mode: 'no-cors', // Essential for Google Apps Script redirects
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString() 
    })
    .then(() => {
        // success (no-cors always assumes success if the network doesn't crash)
        alert('Hunt Recorded Successfully!');
        
        // Reset the form and the photo UI
        form.reset();
        document.getElementById('photoPreviewBox').style.display = 'none';
        document.getElementById('photoLink').value = ""; // Clear for next entry
        
        submitButton.disabled = false;
        submitButton.innerText = "Submit Hunt to Log";

        // Remove the "pending" row and refresh the actual data
        if (document.getElementById('temp-row')) {
            document.getElementById('temp-row').remove();
        }
        loadHistory();
    })
    .catch(error => {
        alert('Submission Failed. Check your cellular signal.');
        console.error('Submission Error:', error);
        
        // Highlight the pending row as an error
        if (document.getElementById('temp-row')) {
            document.getElementById('temp-row').style.color = "red";
            document.getElementById('temp-row').style.opacity = "1";
        }
        
        submitButton.disabled = false;
        submitButton.innerText = "Retry Submission";
    });
});


// --- 2. DATA LOADING & FILTERING ---
let allHunts = []; 

function loadHistory() {
    const historyBody = document.getElementById('historyBody');
    const cacheBuster = `?t=${new Date().getTime()}`;

    fetch(scriptURL + cacheBuster, { method: "GET", redirect: "follow" })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // 1. Validate that we received an array of hunts
            if (Array.isArray(data)) {
                allHunts = data;
                // Sort oldest to newest for totals calculation logic
                allHunts.sort((a, b) => new Date(a.huntDate) - new Date(b.huntDate));
            } else {
                console.error("Received unexpected data format (not an array):", data);
                allHunts = []; 
            }

            // 2. Build the Season Filter dropdown
            const filter = document.getElementById('seasonFilter');
            const seasons = [...new Set(allHunts.map(h => getSeason(h.huntDate)))];
            
            let options = '<option value="all">All Time (Grand Total)</option>';
            seasons.sort().reverse().forEach(s => {
                if (s !== "Invalid Date" && s !== "Unknown") {
                    options += `<option value="${s}">${s} Season</option>`;
                }
            });
            filter.innerHTML = options;

            // 3. Auto-select the current 2025-2026 season
            const currentSeasonStr = getSeason(new Date().toISOString());
            if (seasons.includes(currentSeasonStr)) {
                filter.value = currentSeasonStr;
            } else {
                filter.value = seasons[0] || "all";
            }

            // 4. Draw the table
            renderTable(allHunts, filter.value);
        })
        .catch(error => {
            console.error('Error loading history:', error);
            historyBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Failed to load logs. Check your Spreadsheet ID.</td></tr>';
        });
}

function getSeason(dateString) {
    if (!dateString) return "Unknown";
    const date = new Date(dateString.toString().split('T')[0].replace(/-/g, '/'));
    if (isNaN(date.getTime())) return "Invalid Date";
    const month = date.getMonth();
    const year = date.getFullYear();
    const startYear = (month >= 8) ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
}

// --- 3. TABLE RENDERING ---
function renderTable(hunts, filterValue) {
    const historyBody = document.getElementById('historyBody');
    historyBody.innerHTML = '';
    const filteredData = (filterValue === 'all') ? hunts : hunts.filter(h => getSeason(h.huntDate) === filterValue);
    const displayData = [...filteredData].sort((a,b) => new Date(b.huntDate) - new Date(a.huntDate));

    let totalDucks = 0, totalGeese = 0;

    displayData.forEach(row => { 
        totalDucks += parseInt(row.ducks || 0);
        totalGeese += parseInt(row.geese || 0);
        const photoCell = row.photoLink ? `<button onclick="window.open('${row.photoLink}', '_blank')" style="cursor:pointer;">📸 View</button>` : '—';
        const tr = document.createElement('tr');
        let d = row.huntDate ? row.huntDate.toString().split('T')[0].split('-') : null;
        let displayDate = d ? `${parseInt(d[1])}/${parseInt(d[2])}/${d[0].slice(-2)}` : "N/A";

        tr.innerHTML = `
            <td>${displayDate}</td>
            <td>${row.blindLocation || 'N/A'}</td>
            <td style="text-align:center;">${row.ducks || 0}</td>
            <td style="text-align:center;">${row.geese || 0}</td>
            <td style="text-align:center;">${photoCell}</td>
            <td class="expandable-cell">${row.weather || ''}</td>
            <td class="expandable-cell">${row.notes || ''}</td>
        `;

        tr.querySelectorAll('.expandable-cell').forEach(cell => {
            cell.addEventListener('click', function() {
                if (this.innerText.trim() === "") return;
                document.getElementById('modalContent').innerText = this.innerText;
                document.getElementById('noteModal').showModal();
            });
        });
        historyBody.appendChild(tr);
    });

    const totalsRow = document.createElement('tr');
    totalsRow.id = "totals-row"; 
    totalsRow.innerHTML = `
        <td colspan="2" style="font-weight:bold; color:orange;">TOTALS</td>
        <td style="text-align:center; font-weight:bold; color:orange;">${totalDucks}</td>
        <td style="text-align:center; font-weight:bold; color:orange;">${totalGeese}</td>
        <td colspan="3"></td> 
    `;
    historyBody.appendChild(totalsRow);
}

// --- 4. PHOTO UPLOAD & RESIZING ---
const photoInput = document.getElementById('photoCapture');
const photoLinkInput = document.getElementById('photoLink');
const previewImg = document.getElementById('imagePreview');
const statusText = document.getElementById('uploadStatus');

photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    statusText.innerText = "Processing...";
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; 
        let scale = Math.min(MAX_WIDTH / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
            statusText.innerText = "Uploading (Small Size)...";
            const formData = new FormData();
            formData.append('image', blob, "harvest.jpg");
            try {
                const apiKey = 'c35b3973813bbd067239a605b612f231';
                // FIXED URL: Added /1/upload and ${} syntax
                const response = await fetch(`https://api.imgbb.com{apiKey}`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    photoLinkInput.value = data.data.url;
                    statusText.innerHTML = `✅ Ready: <a href="${data.data.url}" target="_blank">View Photo</a>`;
                } else {
                    statusText.innerText = "❌ API Error.";
                }
            } catch (err) {
                statusText.innerText = "❌ Network Error.";
                console.error(err);
            }
        }, 'image/jpeg', 0.7);
    };
});

// --- 5. INITIALIZATION & UTILS ---
document.getElementById('seasonFilter').addEventListener('change', (e) => renderTable(allHunts, e.target.value));

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        setTimeout(() => loadHistory(), 300);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('huntDate')) document.getElementById('huntDate').value = new Date().toISOString().split('T')[0];
    if (document.getElementById('ducks')) document.getElementById('ducks').setAttribute('inputmode', 'numeric');
    if (document.getElementById('geese')) document.getElementById('geese').setAttribute('inputmode', 'numeric');
    loadHistory();
});
