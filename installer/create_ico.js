const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'public', 'icons', 'icon-192.png');
const outPath = path.join(__dirname, 'stockcell.ico');

// ICO with proper BMP entries at multiple sizes
const sizes = [16, 24, 32, 48, 64, 128, 256];

async function createBMPEntry(pngPath, size) {
    // Get raw RGBA pixel data
    const { data, info } = await sharp(pngPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const bpp = 32;
    const rowSize = width * 4; // BGRA
    const pixelDataSize = rowSize * height;
    const maskRowSize = Math.ceil(width / 8);
    const maskRowPadded = (maskRowSize + 3) & ~3; // align to 4 bytes
    const maskDataSize = maskRowPadded * height;

    // BITMAPINFOHEADER (40 bytes)
    const headerSize = 40;
    const bmpHeader = Buffer.alloc(headerSize);
    bmpHeader.writeUInt32LE(headerSize, 0);     // biSize
    bmpHeader.writeInt32LE(width, 4);            // biWidth
    bmpHeader.writeInt32LE(height * 2, 8);       // biHeight (doubled for XOR+AND mask)
    bmpHeader.writeUInt16LE(1, 12);              // biPlanes
    bmpHeader.writeUInt16LE(bpp, 14);            // biBitCount
    bmpHeader.writeUInt32LE(0, 16);              // biCompression (BI_RGB)
    bmpHeader.writeUInt32LE(pixelDataSize + maskDataSize, 20); // biSizeImage
    // rest are 0

    // Pixel data: BMP is bottom-up, BGRA
    const pixelData = Buffer.alloc(pixelDataSize);
    for (let y = 0; y < height; y++) {
        const srcRow = y;
        const dstRow = height - 1 - y; // flip vertically
        for (let x = 0; x < width; x++) {
            const srcOffset = (srcRow * width + x) * 4;
            const dstOffset = (dstRow * width + x) * 4;
            pixelData[dstOffset + 0] = data[srcOffset + 2]; // B
            pixelData[dstOffset + 1] = data[srcOffset + 1]; // G
            pixelData[dstOffset + 2] = data[srcOffset + 0]; // R
            pixelData[dstOffset + 3] = data[srcOffset + 3]; // A
        }
    }

    // AND mask (transparency mask) - all zeros for 32-bit with alpha
    const maskData = Buffer.alloc(maskDataSize, 0);

    return {
        width: size >= 256 ? 0 : size,
        height: size >= 256 ? 0 : size,
        bmpData: Buffer.concat([bmpHeader, pixelData, maskData])
    };
}

async function main() {
    console.log('Creating multi-resolution ICO...');
    const entries = [];

    for (const size of sizes) {
        console.log(`  Generating ${size}x${size}...`);
        const entry = await createBMPEntry(pngPath, size);
        entries.push(entry);
    }

    // Build ICO file
    // ICONDIR: 6 bytes
    const iconDir = Buffer.alloc(6);
    iconDir.writeUInt16LE(0, 0);              // Reserved
    iconDir.writeUInt16LE(1, 2);              // Type: 1 = ICO
    iconDir.writeUInt16LE(entries.length, 4); // Count

    // ICONDIRENTRY: 16 bytes each
    const headerTotalSize = 6 + entries.length * 16;
    let dataOffset = headerTotalSize;

    const dirEntries = [];
    for (const entry of entries) {
        const dirEntry = Buffer.alloc(16);
        dirEntry.writeUInt8(entry.width, 0);    // Width (0 = 256)
        dirEntry.writeUInt8(entry.height, 1);   // Height (0 = 256)
        dirEntry.writeUInt8(0, 2);              // Color palette
        dirEntry.writeUInt8(0, 3);              // Reserved
        dirEntry.writeUInt16LE(1, 4);           // Color planes
        dirEntry.writeUInt16LE(32, 6);          // Bits per pixel
        dirEntry.writeUInt32LE(entry.bmpData.length, 8);  // Size of BMP data
        dirEntry.writeUInt32LE(dataOffset, 12);           // Offset to BMP data
        dirEntries.push(dirEntry);
        dataOffset += entry.bmpData.length;
    }

    const icoBuffer = Buffer.concat([
        iconDir,
        ...dirEntries,
        ...entries.map(e => e.bmpData)
    ]);

    fs.writeFileSync(outPath, icoBuffer);
    console.log(`ICO created: ${outPath} (${(icoBuffer.length / 1024).toFixed(1)} KB, ${entries.length} sizes)`);
}

main().catch(console.error);
