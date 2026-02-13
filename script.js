let uploadedFiles = [];

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const editorUI = document.getElementById('editor-ui');

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

function handleFiles(files) {
    for (let file of files) {
        if (file.type === 'application/pdf') {
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
            <div style="font-size: 2rem; margin-bottom: 10px;">📄</div>
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

async function mergeAll() {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    for (const file of uploadedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    download(pdfBytes, "merged_document.pdf", "application/pdf");
}

function download(data, filename, type) {
    const file = new Blob([data], { type: type });
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}