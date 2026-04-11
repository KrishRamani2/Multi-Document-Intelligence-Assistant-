import fs from 'fs/promises';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Downloads a file from a URL to a local destination
 */
async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const file = createWriteStream(dest);
        lib.get(url, (response) => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else {
                file.close(); // Close before unlinking
                fs.unlink(dest).catch(() => {});
                reject(new Error(`Failed to download file, status code: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            file.close(); // Close before unlinking
            fs.unlink(dest).catch(() => {});
            reject(err);
        });
    });
}

/**
 * Normalize text string for searching
 * Converts to lowercase and removes all whitespace
 */
function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/\s+/g, '');
}

/**
 * Merges adjacent bounding boxes in a single line to create cleaner highlights
 */
function mergeRectangles(charRects) {
    if (charRects.length === 0) return [];
    
    // Sort by y descending (bottom-up), then by x ascending
    charRects.sort((a, b) => {
        if (Math.abs(b.y - a.y) > 5) return b.y - a.y; // group roughly on same line
        return a.x - b.x;
    });

    const merged = [];
    let current = { ...charRects[0] };

    for (let i = 1; i < charRects.length; i++) {
        const next = charRects[i];
        
        // Same line check (within 5 pixels y difference)
        if (Math.abs(current.y - next.y) <= 5) {
            // Extend current
            const minX = Math.min(current.x, next.x);
            const maxX = Math.max(current.x + current.width, next.x + next.width);
            current.x = minX;
            current.width = maxX - minX;
            current.height = Math.max(current.height, next.height);
            current.y = Math.min(current.y, next.y); 
        } else {
            // New line
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);

    return merged;
}

/**
 * Main function to read JSON, extract PDF blocks, and highlight them
 * @param {string} jsonPath - Path to the chunk data JSON file
 */
export async function highlightChunks(jsonPath) {
    const stats = {
        total_chunks: 0,
        highlighted: 0,
        missing: 0,
        pages_processed: 0
    };

    let jsonData;
    try {
        const rawData = await fs.readFile(jsonPath, 'utf-8');
        jsonData = JSON.parse(rawData);
    } catch (err) {
        throw new Error(`Invalid JSON or File not found: ${err.message}`);
    }

    const { local_path, cdn_link, document_id, hierarchical_chunks } = jsonData;
    const chunks = hierarchical_chunks?.sections || [];
    stats.total_chunks = chunks.length;

    if (!local_path && !cdn_link) {
        throw new Error("No local_path or cdn_link found in JSON.");
    }

    const projectRoot = path.dirname(path.resolve(jsonPath));
    const downloadsDir = path.join(projectRoot, 'downloads');
    const outputDir = path.join(projectRoot, 'output');

    if (!existsSync(downloadsDir)) mkdirSync(downloadsDir, { recursive: true });
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    let finalPdfPath = local_path ? path.resolve(projectRoot, local_path) : '';
    
    // Fallback or download CDN Link
    if (cdn_link) {
        const fileName = cdn_link.split('/').pop() || `${document_id || 'downloaded'}.pdf`;
        finalPdfPath = path.join(downloadsDir, fileName);
        if (!existsSync(finalPdfPath)) {
            console.log(`Downloading PDF from CDN...`);
            await downloadFile(cdn_link, finalPdfPath);
            console.log(`Download complete.`);
        }
    } else if (!existsSync(finalPdfPath)) {
        throw new Error(`File not found: ${finalPdfPath}`);
    }

    // Load PDF bytes using fs
    let pdfBytes;
    try {
        pdfBytes = await fs.readFile(finalPdfPath);
    } catch (err) {
        throw new Error(`PDF load failure: ${err.message}`);
    }

    // Initialize pdf-lib doc
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pdfLibPages = pdfDoc.getPages();

    // Initialize pdfjs-dist doc
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBytes),
        useSystemFonts: true
    });
    let pdfJsDoc;
    try {
        pdfJsDoc = await loadingTask.promise;
    } catch (err) {
        throw new Error(`pdfjs failed to read document: ${err.message}`);
    }
    const numPages = pdfJsDoc.numPages;
    stats.pages_processed = numPages;

    console.log(`Successfully loaded PDF with ${numPages} page(s).`);

    const pagesInfo = [];

    // Pre-calculate page text layouts
    for (let p = 1; p <= numPages; p++) {
        const page = await pdfJsDoc.getPage(p);
        const textContent = await page.getTextContent();
        
        let normalizedPageStr = '';
        const charRects = [];

        // In pdfjs-dist, textContent.items contains text pieces, each with transform array
        // transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
        for (const item of textContent.items) {
            if (!item.str || item.str.trim() === '') continue;
            
            const charWidth = item.width / item.str.length;
            const height = item.height;

            for (let i = 0; i < item.str.length; i++) {
                const c = item.str[i];
                if (/\s/.test(c)) continue; // skip actual space chars for indexing

                normalizedPageStr += c.toLowerCase();
                
                // item.transform gives starting point of text run. Default origin is bottom-left matching pdf-lib.
                const origX = item.transform[4] + (i * charWidth);
                const origY = item.transform[5];
                const fontHeight = Math.abs(item.transform[3]) || height || 12; 

                charRects.push({
                    char: c,
                    x: origX,
                    y: origY,
                    width: charWidth,
                    height: fontHeight
                });
            }
        }
        
        pagesInfo.push({
            pageIdx: p - 1, // 0-based
            normalizedStr: normalizedPageStr,
            charRects: charRects,
            pdfLibPage: pdfLibPages[p - 1]
        });
    }

    const highlightColor = rgb(1, 1, 0); // Yellow
    const highlightOpacity = 0.4;
    const padding = 2;

    for (const chunk of chunks) {
        console.log(`Processing chunk: ${chunk.chunk_id}`);
        
        if (!chunk.text) {
            console.log(`Empty text for chunk ${chunk.chunk_id}`);
            stats.missing++;
            continue;
        }

        const queryStr = normalizeText(chunk.text);
        if (!queryStr) {
            console.log(`Normalized text empty for chunk ${chunk.chunk_id}`);
            stats.missing++;
            continue;
        }

        let found = false;

        for (const pInfo of pagesInfo) {
            const matchIndex = pInfo.normalizedStr.indexOf(queryStr);
            if (matchIndex !== -1) {
                console.log(`Found match on page: ${pInfo.pageIdx + 1}`);

                const matchLen = queryStr.length;
                const rectsToHighlight = [];

                for (let i = 0; i < matchLen; i++) {
                    const rect = pInfo.charRects[matchIndex + i];
                    if (rect) {
                        rectsToHighlight.push(rect);
                    }
                }

                const mergedRects = mergeRectangles(rectsToHighlight);

                for (const r of mergedRects) {
                    pInfo.pdfLibPage.drawRectangle({
                        x: r.x - padding,
                        y: r.y - padding,
                        width: r.width + (padding * 2),
                        height: r.height + (padding * 2),
                        color: highlightColor,
                        opacity: highlightOpacity
                    });
                }

                console.log(`Highlight applied`);
                found = true;
                stats.highlighted++;
                break;
            }
        }

        if (!found) {
            console.log(`Chunk not found`);
            stats.missing++;
        }
    }

    const outputPdfBytes = await pdfDoc.save();
    const outputFile = path.join(outputDir, 'highlighted_document.pdf');
    await fs.writeFile(outputFile, outputPdfBytes);

    // Also wrap output in JSON response layout requested by user
    const result = {
        success: true,
        output_file: path.relative(projectRoot, outputFile) || outputFile,
        stats
    };

    return result;
}

// Sample execution script logic when called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const jsonPath = process.argv[2] || path.join(process.cwd(), 'sample_chunks.json');
    highlightChunks(jsonPath)
        .then((result) => {
            console.log('Result:', JSON.stringify(result, null, 2));
        })
        .catch((err) => {
            console.error('Error:', err.message);
            process.exit(1);
        });
}
