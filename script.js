// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const fileInput = document.getElementById('file-input');
    const inputPreviewRow = document.getElementById('input-preview-row');
    const outputPreviewRow = document.getElementById('output-preview-row');
    const previewSection = document.getElementById('preview-section');
    const tableWrapper = document.getElementById('table-wrapper');
    const dataTableBody = document.getElementById('data-table-body');
    const hiddenCanvas = document.getElementById('hidden-canvas');
    const ctx = hiddenCanvas.getContext('2d');
    const loadingSpinner = document.getElementById('loading-spinner');
    const loadingText = document.getElementById('loading-text');

    // Controls
    const downloadZipBtn = document.getElementById('download-zip-btn');
    const zipFormatSelect = document.getElementById('zip-format-select');
    const resetBtn = document.getElementById('reset-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // --- Global State ---
    let qrDataList = []; // Stores all QR data objects
    let settingsCache = {}; // Caches settings for real-time updates

    // --- Settings Elements Map ---
    const settingsMap = {
        qrSize: {el: 'qr-size', type: 'number'},
        bgColor: {el: 'bg-color', type: 'value'},
        fgColor: {el: 'fg-color', type: 'value'},
        globalCaption: {el: 'global-caption', type: 'value'},
        
        codeFontFamily: {el: 'code-font-family', type: 'value'},
        codeFontSize: {el: 'code-font-size', type: 'number'},
        codeFontColor: {el: 'code-font-color', type: 'value'},
        codeGap: {el: 'code-gap', type: 'number'},
        codeBold: {el: 'code-bold', type: 'checked'},
        codeItalic: {el: 'code-italic', type: 'checked'},

        captionFontFamily: {el: 'caption-font-family', type: 'value'},
        captionFontSize: {el: 'caption-font-size', type: 'number'},
        captionFontColor: {el: 'caption-font-color', type: 'value'},
        captionGap: {el: 'caption-gap', type: 'number'},
        captionBold: {el: 'caption-bold', type: 'checked'},
        captionItalic: {el: 'caption-italic', type: 'checked'},

        showLine: {el: 'show-line', type: 'checked'},
        lineColor: {el: 'line-color', type: 'value'},
        lineThickness: {el: 'line-thickness', type: 'number'},
        lineWidth: {el: 'line-width', type: 'number'},
        lineGapCaption: {el: 'line-gap-caption', type: 'number'}
    };

    // --- Event Listeners ---
    fileInput.addEventListener('change', handleFileSelect);
    resetBtn.addEventListener('click', resetApp);
    downloadZipBtn.addEventListener('click', handleZipDownload);
    exportExcelBtn.addEventListener('click', exportToExcel);
    exportPdfBtn.addEventListener('click', exportToPDF);

    // Add listeners to all settings inputs for real-time updates
    Object.keys(settingsMap).forEach(key => {
        const inputEl = document.getElementById(settingsMap[key].el);
        if (inputEl) {
            inputEl.addEventListener('input', () => {
                readAllSettings();
                updateAllPreviews();
            });
        }
    });

    // Delegated event listener for table inputs
    dataTableBody.addEventListener('input', (e) => {
        if (e.target.matches('.caption-input') || e.target.matches('.feno-input')) {
            const index = e.target.dataset.index;
            if (qrDataList[index]) {
                if (e.target.matches('.caption-input')) {
                    qrDataList[index].caption = e.target.value;
                }
                if (e.target.matches('.feno-input')) {
                    qrDataList[index].feNo = e.target.value;
                }
                // Update just this one preview in real-time
                updateSinglePreview(index);
            }
        }
    });

    // --- Core Functions ---

    /**
     * Resets the entire application to its initial state
     */
    function resetApp() {
        qrDataList = [];
        fileInput.value = ''; // Clear file input
        inputPreviewRow.innerHTML = '';
        outputPreviewRow.innerHTML = '';
        dataTableBody.innerHTML = '';
        previewSection.style.display = 'none';
        tableWrapper.style.display = 'none';
        // Optional: Reset all settings fields to default (if needed)
        // document.getElementById('settings-form').reset();
        // readAllSettings(); 
    }

    /**
     * Reads all settings from the DOM and caches them
     */
    function readAllSettings() {
        for (const key in settingsMap) {
            const config = settingsMap[key];
            const el = document.getElementById(config.el);
            if (el) {
                settingsCache[key] = el[config.type];
            }
        }
    }

    /**
     * Handles the file selection event
     */
    async function handleFileSelect(event) {
        resetApp(); // Clear previous results
        const files = event.target.files;
        if (files.length === 0) return;

        showLoading(true, `Reading ${files.length} QR codes...`);
        previewSection.style.display = 'block';
        tableWrapper.style.display = 'block';

        const processingPromises = [];

        for (let i = 0; i < files.length; i++) {
            processingPromises.push(processFile(files[i], i));
        }

        await Promise.all(processingPromises);
        
        // Initial render after all files are processed
        readAllSettings();
        renderAll();
        showLoading(false);
    }

    /**
     * Processes a single image file
     */
    function processFile(file, index) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Draw to hidden canvas to read data
                    hiddenCanvas.width = img.width;
                    hiddenCanvas.height = img.height;
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    
                    // Decode QR
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    
                    let qrText = 'Error: Could not read QR';
                    let extractedCode = 'N/A';
                    
                    if (code) {
                        qrText = code.data;
                        extractedCode = extractCodeFromText(qrText);
                    }

                    // Store data
                    qrDataList[index] = {
                        id: `qr-${Date.now()}-${index}`,
                        originalSrc: e.target.result, // base64 src for input preview
                        qrText: qrText,
                        extractedCode: extractedCode,
                        caption: '',
                        feNo: ''
                    };
                    resolve();
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Extracts the 6-digit code after the last '='
     */
    function extractCodeFromText(text) {
        if (typeof text !== 'string') return 'N/A';
        const parts = text.split('=');
        if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            // Take up to 6 characters. Can be alphanumeric.
            return lastPart.substring(0, 6); 
        }
        return 'N/A';
    }

    /**
     * Renders both preview panes and the data table
     */
    function renderAll() {
        renderInputPreviews();
        renderOutputPreviews();
        renderDataTable();
    }

    /**
     * Renders the 'Input' QR code preview row
     */
    function renderInputPreviews() {
        inputPreviewRow.innerHTML = '';
        qrDataList.forEach(data => {
            const card = document.createElement('div');
            card.className = 'qr-card';
            card.innerHTML = `
                <img src="${data.originalSrc}" alt="Input QR Code">
                <div class="code-chip">${data.extractedCode}</div>
            `;
            inputPreviewRow.appendChild(card);
        });
    }

    /**
     * Renders the 'Output' QR code preview row
     */
    function renderOutputPreviews() {
        outputPreviewRow.innerHTML = '';
        qrDataList.forEach((data, index) => {
            const outputCard = document.createElement('div');
            outputCard.className = 'qr-card';
            outputCard.id = `output-${data.id}`;
            
            const svgContainer = document.createElement('div');
            svgContainer.className = 'output-svg-container';
            svgContainer.innerHTML = generateEnhancedQR(data, index); // Get SVG string
            
            outputCard.innerHTML = `
                <div class="output-svg-wrapper">
                    ${svgContainer.innerHTML}
                </div>
                <div class="qr-card-info">
                    <div class="code-chip">${data.extractedCode}</div>
                    <div class="download-buttons">
                        <button class="download-btn" data-type="png" data-index="${index}">PNG</button>
                        <button class="download-btn" data-type="jpg" data-index="${index}">JPG</button>
                        <button class="download-btn" data-type="svg" data-index="${index}">SVG</button>
                    </div>
                </div>
            `;
            
            outputPreviewRow.appendChild(outputCard);

            // Add download button listeners
            outputCard.querySelectorAll('.download-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const type = e.target.dataset.type;
                    const index = e.target.dataset.index;
                    handleDownload(type, index);
                });
            });
        });
    }

    /**
     * Renders the data table
     */
    function renderDataTable() {
        dataTableBody.innerHTML = '';
        qrDataList.forEach((data, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${data.extractedCode}</td>
                <td>
                    <input type="text" class="form-input caption-input" data-index="${index}" 
                           value="${data.caption}" placeholder="${settingsCache.globalCaption || ''}">
                </td>
                <td>
                    <input type="text" class="form-input feno-input" data-index="${index}" 
                           value="${data.feNo}" placeholder="e.g., 1, 2, 3">
                </td>
                <td>${data.qrText}</td>
            `;
            dataTableBody.appendChild(row);
        });
    }

    /**
     * Updates all output previews in real-time
     */
    function updateAllPreviews() {
        qrDataList.forEach((data, index) => {
            updateSinglePreview(index);
        });
    }

    /**
     * Updates a single output preview
     */
    function updateSinglePreview(index) {
        const data = qrDataList[index];
        if (!data) return;

        const outputCard = document.getElementById(`output-${data.id}`);
        if (outputCard) {
            const svgWrapper = outputCard.querySelector('.output-svg-wrapper');
            svgWrapper.innerHTML = generateEnhancedQR(data, index);
        }
        
        // Update placeholder in table
        const captionInput = dataTableBody.querySelector(`.caption-input[data-index="${index}"]`);
        if (captionInput) {
            captionInput.placeholder = settingsCache.globalCaption || '';
        }
    }

    /**
     * Generates the complete, enhanced SVG string
     */
    function generateEnhancedQR(data, index) {
        const settings = settingsCache;
        const qrSize = settings.qrSize;

        // 1. Combine Caption + FE No.
        const feNo = data.feNo || '';
        const captionText = (data.caption || settings.globalCaption || '') + feNo;

        // 2. Calculate text properties
        const codeText = data.extractedCode;
        const codeStyle = `${settings.codeItalic ? 'italic' : ''} ${settings.codeBold ? 'bold' : ''} ${settings.codeFontSize}px ${settings.codeFontFamily}`;
        const captionStyle = `${settings.captionItalic ? 'italic' : ''} ${settings.captionBold ? 'bold' : ''} ${settings.captionFontSize}px ${settings.captionFontFamily}`;

        // 3. Generate Base QR SVG
        const qr = new QRCode({
            content: data.qrText,
            padding: 0,
            width: qrSize,
            height: qrSize,
            color: settings.fgColor,
            background: settings.bgColor,
            ecl: 'H',
            svg: true
        });
        const qrSvgString = qr.svg();

        // 4. Calculate total height
        let totalHeight = qrSize;
        let codeY = qrSize + settings.codeGap + settings.codeFontSize;
        totalHeight = codeY;

        let lineY = 0;
        if (settings.showLine) {
            lineY = totalHeight + (settings.captionGap / 2);
            totalHeight = lineY + settings.lineThickness + settings.lineGapCaption;
        } else {
            totalHeight += settings.captionGap;
        }

        let captionY = totalHeight + settings.captionFontSize;
        totalHeight = captionY + (settings.captionFontSize / 2); // Add some padding

        // 5. Build the new, enhanced SVG
        let svgElements = [];
        
        // Add background rect
        svgElements.push(`<rect x="0" y="0" width="${qrSize}" height="${totalHeight}" fill="${settings.bgColor}"/>`);
        
        // Add QR code (remove <?xml..> and <svg..> wrapper from lib)
        const qrPaths = qrSvgString.substring(qrSvgString.indexOf('<path'), qrSvgString.lastIndexOf('</svg>'));
        svgElements.push(`<g>${qrPaths}</g>`);
        
        // Add Code Label
        svgElements.push(
            `<text x="${qrSize / 2}" y="${codeY}" 
                   font-family="${settings.codeFontFamily}" 
                   font-size="${settings.codeFontSize}" 
                   fill="${settings.codeFontColor}" 
                   font-weight="${settings.codeBold ? 'bold' : 'normal'}" 
                   font-style="${settings.codeItalic ? 'italic' : 'normal'}" 
                   text-anchor="middle" 
                   dominant-baseline="middle">${codeText}</text>`
        );

        // Add Separator Line
        if (settings.showLine) {
            const lineWidth = qrSize * (settings.lineWidth / 100);
            const lineX1 = (qrSize - lineWidth) / 2;
            const lineX2 = lineX1 + lineWidth;
            svgElements.push(
                `<line x1="${lineX1}" y1="${lineY}" x2="${lineX2}" y2="${lineY}" 
                       stroke="${settings.lineColor}" 
                       stroke-width="${settings.lineThickness}" />`
            );
            // Adjust caption Y position
            captionY = lineY + settings.lineThickness + settings.lineGapCaption + (settings.captionFontSize / 2);
        } else {
            captionY = codeY + settings.captionGap + (settings.captionFontSize / 2);
        }

        // Add Caption Label
        if (captionText) {
            svgElements.push(
                `<text x="${qrSize / 2}" y="${captionY}" 
                       font-family="${settings.captionFontFamily}" 
                       font-size="${settings.captionFontSize}" 
                       fill="${settings.captionFontColor}" 
                       font-weight="${settings.captionBold ? 'bold' : 'normal'}" 
                       font-style="${settings.captionItalic ? 'italic' : 'normal'}" 
                       text-anchor="middle" 
                       dominant-baseline="middle">${captionText}</text>`
            );
        }

        // Adjust total height based on final caption position
        totalHeight = captionText ? captionY + (settings.captionFontSize / 2) : codeY + (settings.codeFontSize / 2);
        
        // Final SVG string
        return `<svg width="${qrSize}" height="${totalHeight}" viewBox="0 0 ${qrSize} ${totalHeight}" 
                     xmlns="http://www.w3.org/2000/svg" 
                     font-family="${settings.codeFontFamily}, sans-serif">
                     ${svgElements.join('\n')}
                </svg>`;
    }


    /**
     * Handles download for individual PNG, JPG, or SVG
     */
    function handleDownload(type, index) {
        const data = qrDataList[index];
        const svgWrapper = document.getElementById(`output-${data.id}`).querySelector('.output-svg-wrapper');
        const svgElement = svgWrapper.querySelector('svg');
        const filename = `${data.extractedCode || 'qr'}_${index + 1}.${type}`;

        if (type === 'svg') {
            downloadSVG(svgElement, filename);
        } else {
            downloadRaster(svgElement, filename, type); // type is 'png' or 'jpg'
        }
    }

    /**
     * Triggers download of an SVG element
     */
    function downloadSVG(svgElement, filename) {
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgElement);
        // Add xml namespaces
        if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        const blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
        saveAs(blob, filename);
    }

    /**
     * Triggers download of PNG or JPG
     */
    function downloadRaster(svgElement, filename, type) {
        const mimeType = `image/${type}`;
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            // Use the dimensions from the SVG element
            const canvas = document.createElement('canvas');
            canvas.width = svgElement.getAttribute('width');
            canvas.height = svgElement.getAttribute('height');
            const ctx = canvas.getContext('2d');
            
            // Draw the image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Trigger download
            canvas.toBlob((blob) => {
                saveAs(blob, filename);
                URL.revokeObjectURL(url); // Clean up
            }, mimeType, 1.0); // 1.0 quality for JPG
        };
        img.onerror = (e) => {
            console.error('Image conversion error:', e);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    /**
     * Handles downloading all QRs as a ZIP file
     */
    async function handleZipDownload() {
        if (qrDataList.length === 0) {
            alert('Please browse and enhance QR codes first.');
            return;
        }

        const format = zipFormatSelect.value;
        const zip = new JSZip();
        showLoading(true, `Generating ZIP (${format.toUpperCase()})... 0%`);

        const promises = qrDataList.map((data, index) => {
            return new Promise(async (resolve, reject) => {
                const svgWrapper = document.getElementById(`output-${data.id}`).querySelector('.output-svg-wrapper');
                const svgElement = svgWrapper.querySelector('svg');
                const filename = `${data.extractedCode || 'qr'}_${index + 1}.${format}`;

                try {
                    if (format === 'svg') {
                        const serializer = new XMLSerializer();
                        let source = serializer.serializeToString(svgElement);
                        if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
                            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                        }
                        zip.file(filename, source);
                    } else {
                        // PNG or JPG
                        const mimeType = `image/${format}`;
                        const svgString = new XMLSerializer().serializeToString(svgElement);
                        const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
                        const url = URL.createObjectURL(svgBlob);

                        const blob = await new Promise((imgResolve, imgReject) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                canvas.width = svgElement.getAttribute('width');
                                canvas.height = svgElement.getAttribute('height');
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                canvas.toBlob((blob) => {
                                    imgResolve(blob);
                                    URL.revokeObjectURL(url);
                                }, mimeType, 1.0);
                            };
                            img.onerror = () => {
                                imgReject(new Error('Image conversion failed'));
                                URL.revokeObjectURL(url);
                            };
                            img.src = url;
                        });
                        zip.file(filename, blob);
                    }
                    // Update progress
                    loadingText.textContent = `Generating ZIP (${format.toUpperCase()})... ${Math.round((index + 1) * 100 / qrDataList.length)}%`;
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });

        try {
            await Promise.all(promises);
            showLoading(true, 'Compressing ZIP...');
            const zipBlob = await zip.generateAsync({type: 'blob'});
            saveAs(zipBlob, `Enhanced_QRs_${format.toUpperCase()}.zip`);
        } catch (error) {
            console.error('Failed to generate ZIP:', error);
            alert('An error occurred while generating the ZIP file. See console for details.');
        } finally {
            showLoading(false);
        }
    }

    /**
     * Exports the data table to an Excel file
     */
    function exportToExcel() {
        const data = qrDataList.map((qr, index) => ({
            "Sr. No.": index + 1,
            "Code": qr.extractedCode,
            "Caption": (qr.caption || settingsCache.globalCaption || '') + (qr.feNo || ''),
            "QR Link/Text": qr.qrText
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'QR Data');
        XLSX.writeFile(wb, 'qr_code_data.xlsx');
    }

    /**
     * Exports the data table to a PDF file
     */
    function exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const tableData = qrDataList.map((qr, index) => [
            index + 1,
            qr.extractedCode,
            (qr.caption || settingsCache.globalCaption || '') + (qr.feNo || ''),
            qr.qrText
        ]);

        doc.autoTable({
            head: [['Sr. No.', 'Code', 'Caption (with FE No.)', 'QR Link/Text']],
            body: tableData,
            startY: 15,
            styles: {
                font: 'Inter', // Use a font that supports more characters if needed
                fontSize: 9
            },
            headStyles: {
                fillColor: [30, 30, 50]
            }
        });

        doc.text('QR Code Data Export', 14, 10);
        doc.save('qr_code_data.pdf');
    }

    /**
     * Shows or hides the loading spinner
     */
    function showLoading(show, text = 'Processing...') {
        if (show) {
            loadingText.textContent = text;
            loadingSpinner.style.display = 'flex';
        } else {
            loadingSpinner.style.display = 'none';
        }
    }

    // --- Initial Setup ---
    readAllSettings(); // Cache settings on load
});
