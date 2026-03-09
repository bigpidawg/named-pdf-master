let uploadedFiles = []; // [{ file: File, queued: boolean }]

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const photoInput = document.getElementById('photo-input');
const fileList = document.getElementById('file-list');
const editorUI = document.getElementById('editor-ui');
const previewModal = document.getElementById('preview-modal');
const previewBody = document.getElementById('preview-body');
const previewTitle = document.getElementById('preview-title');
const editButton = document.getElementById('edit-button');

// Editor elements
const editorModal = document.getElementById('editor-modal');
const editingImage = document.getElementById('editing-image');
let currentEditIndex = null;
let cropper = null;

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

function getQueuedCount() {
    return uploadedFiles.filter(item => item.queued).length;
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
            uploadedFiles.push({ file, queued: false });
        } else if (source === 'photo') {
            uploadedFiles.push({ file, queued: false });
        } else if (isPdfFile(file) || isImageFile(file)) {
            uploadedFiles.push({ file, queued: false });
        }
    }
    renderFiles();
}

function renderFiles() {
    if (uploadedFiles.length > 0) {
        dropZone.classList.add('hidden');
        editorUI.classList.remove('hidden');
    }

    const queuedCount = getQueuedCount();
    const mergeBtn = document.querySelector('.btn-action[onclick="mergeAll()"]');
    const previewAllBtn = document.querySelector('.btn-action[onclick="generateFinalPreview()"]');
    
    const labelSuffix = queuedCount > 0 ? ` (${queuedCount})` : '';
    if (mergeBtn) mergeBtn.textContent = `MERGE${labelSuffix} & DOWNLOAD`;
    if (previewAllBtn) previewAllBtn.textContent = `PREVIEW FINAL${labelSuffix}`;

    fileList.innerHTML = '';
    uploadedFiles.forEach((item, index) => {
        const file = item.file;
        const card = document.createElement('div');
        card.className = 'file-card';
        if (item.queued) card.classList.add('queued');

        card.innerHTML = `
            <span class="remove" onclick="removeFile(${index})">×</span>
            <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 6px;">#${index + 1}</div>
            <div onclick="openPreview(${index})" style="cursor:pointer">
                <div style="font-size: 2rem; margin-bottom: 10px;">${getFileIcon(file)}</div>
                <div style="font-size: 0.8rem; word-break: break-all; margin-bottom: 12px; color: var(--purple); text-decoration: underline;">${file.name}</div>
            </div>
            <div class="order-controls">
                <button class="btn-order" onclick="moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn-order" onclick="moveFile(${index}, 1)" ${index === uploadedFiles.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="btn-order" onclick="duplicateFile(${index})">DUP</button>
                <button class="btn-order btn-queue ${item.queued ? 'active' : ''}" onclick="toggleQueue(${index})">QUEUE</button>
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

function toggleQueue(index) {
    uploadedFiles[index].queued = !uploadedFiles[index].queued;
    renderFiles();
}

function duplicateFile(index) {
    const itemToDup = uploadedFiles[index];
    const originalFile = itemToDup.file;
    const newFile = new File([originalFile], originalFile.name, { type: originalFile.type });
    uploadedFiles.splice(index + 1, 0, { file: newFile, queued: false });
    renderFiles();
}

function resetEditor() {
    uploadedFiles = [];
    dropZone.classList.remove('hidden');
    editorUI.classList.add('hidden');
}

async function openPreview(index) {
    const file = uploadedFiles[index].file;
    currentEditIndex = index;
    previewTitle.textContent = `Preview: ${file.name}`;
    previewBody.innerHTML = 'Loading...';
    previewModal.classList.add('open');

    const url = URL.createObjectURL(file);
    
    if (isPdfFile(file)) {
        previewBody.innerHTML = `<iframe src="${url}" style="width:100%; height:70vh; border:none;"></iframe>`;
        editButton.classList.add('hidden');
    } else {
        previewBody.innerHTML = `<img src="${url}" alt="Preview">`;
        editButton.classList.remove('hidden');
    }
}

function closePreview() {
    previewModal.classList.remove('open');
    previewBody.innerHTML = '';
}

function startEditing() {
    const file = uploadedFiles[currentEditIndex].file;
    const url = URL.createObjectURL(file);
    
    editingImage.src = url;
    previewModal.classList.remove('open');
    editorModal.classList.add('open');

    if (cropper) cropper.destroy();
    
    cropper = new Cropper(editingImage, {
        viewMode: 1,
        dragMode: 'crop',
        autoCropArea: 0.8,
        responsive: true,
        restore: false,
        checkCrossOrigin: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
    });
}

function cancelEditing() {
    editorModal.classList.remove('open');
    if (cropper) cropper.destroy();
    openPreview(currentEditIndex);
}

function saveEdit() {
    if (!cropper) return;
    
    cropper.getCroppedCanvas().toBlob((blob) => {
        const file = uploadedFiles[currentEditIndex].file;
        const editedFile = new File([blob], file.name, { type: 'image/jpeg' });
        
        uploadedFiles[currentEditIndex].file = editedFile;
        editorModal.classList.remove('open');
        cropper.destroy();
        renderFiles();
        openPreview(currentEditIndex);
    }, 'image/jpeg', 0.9);
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
        const item = uploadedFiles[i];
        const file = item.file;

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
            uploadedFiles[i].file = new File([pdfBytes], file.name, { type: 'application/pdf' });
        } else if (isImageFile(file) || isPhotoCandidate(file)) {
            const pdfBytes = await imageFileToPdf(file, text);
            const pdfName = file.name.replace(/\.[^/.]+$/, '') + '.pdf';
            uploadedFiles[i].file = new File([pdfBytes], pdfName, { type: 'application/pdf' });
        }
    }

    alert('Text added. Image files were converted to PDF pages.');
    renderFiles();
}

async function generateFinalPreview() {
    alert("Preview button clicked! Starting generation...");
    try {
        console.log("Generating final preview...");
        previewTitle.textContent = "Final Document Preview (Generating...)";
        previewBody.innerHTML = 'Merging files for preview...';
        previewModal.classList.add('open');
        editButton.classList.add('hidden');

        const pdfBytes = await buildMergedPdfBytes();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        previewTitle.textContent = "Final Document Preview";
        // Use an iframe instead of embed for better cross-browser compatibility
        previewBody.innerHTML = `<iframe src="${url}" style="width:100%; height:70vh; border:none;"></iframe>`;
    } catch (err) {
        console.error("Preview generation failed:", err);
        alert('Error generating preview: ' + err.message);
        closePreview();
    }
}

async function buildMergedPdfBytes() {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    const queuedItems = uploadedFiles.filter(item => item.queued);
    const itemsToMerge = queuedItems.length > 0 ? queuedItems : uploadedFiles;

    const hasPdf = itemsToMerge.some((item) => isPdfFile(item.file));
    if (!hasPdf) {
        // Start from a blank PDF when user only selected photos
        mergedPdf.addPage([612, 792]);
    }

    for (const item of itemsToMerge) {
        const file = item.file;
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

    return await mergedPdf.save();
}

async function mergeAll() {
    try {
        console.log("Final merging and download...");
        const pdfBytes = await buildMergedPdfBytes();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merged_document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // If queue mode was used, remove those queued items for next run
        const queuedItems = uploadedFiles.filter(item => item.queued);
        if (queuedItems.length > 0) {
            uploadedFiles = uploadedFiles.filter(item => !item.queued);
            if (uploadedFiles.length === 0) {
                resetEditor();
            } else {
                renderFiles();
            }
        }
    } catch (err) {
        console.error("Merge failed:", err);
        alert('Error merging files: ' + err.message);
    }
}
