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

async function addTextOverlay() {
    const text = document.getElementById('overlay-text').value;
    if (!text) return alert("Enter text first");
    
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    
    // We modify the files in the uploadedFiles array
    for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();
        
        pages.forEach(page => {
            const { width, height } = page.getSize();
            page.drawText(text, {
                x: 50,
                y: height - 50,
                size: 20,
                font: helveticaFont,
                color: rgb(0.74, 0.07, 0.99), // Purple to match theme
            });
        });
        
        const pdfBytes = await pdfDoc.save();
        uploadedFiles[i] = new File([pdfBytes], file.name, { type: "application/pdf" });
    }
    alert("Text added to all pages in all uploaded files!");
    renderFiles();
}

async function mergeAll() {
    try {
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();

        for (const file of uploadedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            
            // This is the critical step: copy pages from source to target
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        
        // Simple client-side download trigger
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
        alert("Error merging PDFs: " + err.message);
    }
}