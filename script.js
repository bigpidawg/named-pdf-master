let uploadedFiles = [];

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const photoInput = document.getElementById('photo-input');
const fileList = document.getElementById('file-list');
const editorUI = document.getElementById('editor-ui');

function isPdfFile(file) {
    return file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');
}

function isImageFile(file) {
    const name = (file.name || '').toLowerCase();
    const imageExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif'];
    return file.type.startsWith('image/') || imageExt.some(ext => name.endsWith(ext));
}

function isPhotoCandidate(file) {
    return !isPdfFile(file);
}

function getFileIcon(file) {
    if (isPdfFile(file)) return '📄';
    if (isImageFile(file) || isPhotoCandidate(file)) return '🖼️';
    return '📁';
}

// Drag and Drop Handlers
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files, 'pdf');
    fileInput.value = '';
});

photoInput.addEventListener('change', (e) => {
    handleFiles(e.target.files, 'photo');
    photoInput.value = '';
});

function handleFiles(files, source = 'any') {
    for (let file of files) {
        if (source === 'pdf' && isPdfFile(file)) {
            uploadedFiles.push(file);
        } else if (source === 'photo') {
            // Allow all photo picker results (some mobile browsers provide weak MIME metadata)
            uploadedFiles.push(file);
        } else if (isPdfFile(file) || isImageFile(file)) {
            uploadedFiles.push(file);
        }
    }
    renderFiles();
}

function renderFiles() {
    if (uploadedFiles.length > 0) {
        dropZone.classList.add('hidden');
        editorUI.classList.remove('hidden');
    }

    fileList.innerHTML = '';
    uploadedFiles.forEach((file, index) => {
        const card = document.createElement('div');
        card.className = 'file-card';
        card.innerHTML = `
            <span class="remove" onclick="removeFile(${index})">×</span>
            <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 6px;">#${index + 1}</div>
            <div style="font-size: 2rem; margin-bottom: 10px;">${getFileIcon(file)}</div>
            <div style="font-size: 0.8rem; word-break: break-all; margin-bottom: 12px;">${file.name}</div>
            <div class="order-controls">
                <button class="btn-order" onclick="moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn-order" onclick="moveFile(${index}, 1)" ${index === uploadedFiles.length - 1 ? 'disabled' : ''}>↓</button>
            </div>
        `;
        fileList.appendChild(card);
    });
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    if (uploadedFiles.length === 0) {
        resetEditor();
    } else {
        renderFiles();
    }
}

function moveFile(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= uploadedFiles.length) return;

    const temp = uploadedFiles[index];
    uploadedFiles[index] = uploadedFiles[newIndex];
    uploadedFiles[newIndex] = temp;
    renderFiles();
}

function resetEditor() {
    uploadedFiles = [];
    dropZone.classList.remove('hidden');
    editorUI.classList.add('hidden');
}

async function imageFileToPdf(file, overlayText = '') {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not load image'));
        image.src = dataUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const jpegBytes = await fetch(jpegDataUrl).then((r) => r.arrayBuffer());
    const embeddedImage = await pdfDoc.embedJpg(jpegBytes);

    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width,
        height,
    });

    if (overlayText) {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        page.drawText(overlayText, {
            x: 50,
            y: height - 50,
            size: 20,
            font,
            color: rgb(0.74, 0.07, 0.99),
        });
    }

    return await pdfDoc.save();
}

async function addTextOverlay() {
    const text = document.getElementById('overlay-text').value;
    if (!text) return alert('Enter text first');

    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];

        if (isPdfFile(file)) {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const pages = pdfDoc.getPages();

            pages.forEach((page) => {
                const { height } = page.getSize();
                page.drawText(text, {
                    x: 50,
                    y: height - 50,
                    size: 20,
                    font: helveticaFont,
                    color: rgb(0.74, 0.07, 0.99),
                });
            });

            const pdfBytes = await pdfDoc.save();
            uploadedFiles[i] = new File([pdfBytes], file.name, { type: 'application/pdf' });
        } else if (isImageFile(file) || isPhotoCandidate(file)) {
            const pdfBytes = await imageFileToPdf(file, text);
            const pdfName = file.name.replace(/\.[^/.]+$/, '') + '.pdf';
            uploadedFiles[i] = new File([pdfBytes], pdfName, { type: 'application/pdf' });
        }
    }

    alert('Text added. Image files were converted to PDF pages.');
    renderFiles();
}

async function mergeAll() {
    try {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();

        const hasPdf = uploadedFiles.some((f) => isPdfFile(f));
        if (!hasPdf) {
            // Start from a blank PDF when user only selected photos
            mergedPdf.addPage([612, 792]);
        }

        for (const file of uploadedFiles) {
            let sourcePdf;

            if (isPdfFile(file)) {
                const arrayBuffer = await file.arrayBuffer();
                sourcePdf = await PDFDocument.load(arrayBuffer);
            } else if (isImageFile(file) || isPhotoCandidate(file)) {
                const pdfBytes = await imageFileToPdf(file);
                sourcePdf = await PDFDocument.load(pdfBytes);
            } else {
                continue;
            }

            const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merged_document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error(err);
        alert('Error merging files: ' + err.message);
    }
}
