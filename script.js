let uploadedFiles = [];

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const editorUI = document.getElementById('editor-ui');
const pickerModal = document.getElementById('picker-modal');

function openPickerModeChooser() {
    pickerModal.classList.remove('hidden');
}

function closePickerModeChooser() {
    pickerModal.classList.add('hidden');
}

function choosePickerMode(mode) {
    if (mode === 'pdf') {
        fileInput.accept = '.pdf,application/pdf';
    } else if (mode === 'photo') {
        fileInput.accept = 'image/*';
    } else {
        fileInput.accept = '.pdf,image/*';
    }

    fileInput.click();
    closePickerModeChooser();
}

pickerModal.addEventListener('click', (e) => {
    if (e.target === pickerModal) {
        closePickerModeChooser();
    }
});

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
    handleFiles(e.target.files);
});

function isSupportedFile(file) {
    return file.type === 'application/pdf' || file.type.startsWith('image/');
}

function getFileIcon(file) {
    if (file.type === 'application/pdf') return '📄';
    if (file.type.startsWith('image/')) return '🖼️';
    return '📁';
}

function handleFiles(files) {
    for (let file of files) {
        if (isSupportedFile(file)) {
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
            <div style="font-size: 2rem; margin-bottom: 10px;">${getFileIcon(file)}</div>
            <div style="font-size: 0.8rem; word-break: break-all;">${file.name}</div>
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

function resetEditor() {
    uploadedFiles = [];
    dropZone.classList.remove('hidden');
    editorUI.classList.add('hidden');
}

async function imageFileToPdf(file, overlayText = '') {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let embeddedImage;
    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        embeddedImage = await pdfDoc.embedPng(bytes);
    } else {
        embeddedImage = await pdfDoc.embedJpg(bytes);
    }

    const imgWidth = embeddedImage.width;
    const imgHeight = embeddedImage.height;

    const page = pdfDoc.addPage([imgWidth, imgHeight]);
    page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: imgWidth,
        height: imgHeight,
    });

    if (overlayText) {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        page.drawText(overlayText, {
            x: 50,
            y: imgHeight - 50,
            size: 20,
            font,
            color: rgb(0.74, 0.07, 0.99),
        });
    }

    return await pdfDoc.save();
}

async function addTextOverlay() {
    const text = document.getElementById('overlay-text').value;
    if (!text) return alert("Enter text first");

    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];

        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const pages = pdfDoc.getPages();

            pages.forEach(page => {
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
            uploadedFiles[i] = new File([pdfBytes], file.name, { type: "application/pdf" });
        } else if (file.type.startsWith('image/')) {
            const pdfBytes = await imageFileToPdf(file, text);
            const pdfName = file.name.replace(/\.[^/.]+$/, '') + '.pdf';
            uploadedFiles[i] = new File([pdfBytes], pdfName, { type: "application/pdf" });
        }
    }

    alert("Text added. Image files were converted to PDF pages.");
    renderFiles();
}

async function mergeAll() {
    try {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();

        for (const file of uploadedFiles) {
            let sourcePdf;

            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                sourcePdf = await PDFDocument.load(arrayBuffer);
            } else if (file.type.startsWith('image/')) {
                const pdfBytes = await imageFileToPdf(file);
                sourcePdf = await PDFDocument.load(pdfBytes);
            } else {
                continue;
            }

            const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();

        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "merged_document.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error(err);
        alert("Error merging files: " + err.message);
    }
}
