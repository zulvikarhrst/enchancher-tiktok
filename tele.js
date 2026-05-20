const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = '8531189524:AAHnJFAmfl3IyjB-PDbbHz1dMDTKDR8bVns';
const bot = new TelegramBot(TOKEN, { polling: true });

const PAYLOAD = 268435457;

// Support extension yang diperbolehkan
const ALLOWED_EXTENSIONS = ['.mp4', '.mov'];
const ALLOWED_MIME = ['video/mp4', 'video/quicktime'];

function isAllowedFile(filename) {
    if (!filename) return false;
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
}

function getOutputFilename(inputFilename) {
    const ext = path.extname(inputFilename).toLowerCase();
    const baseName = path.basename(inputFilename, ext);
    return `${baseName}_clean${ext}`;
}

async function patchVideo(inputPath, outputPath) {
    const fsPromises = require('fs').promises;
    const buffer = await fsPromises.readFile(inputPath);
    const data = new Uint8Array(buffer);

    // Cari atom 'elst' (0x65,0x6C,0x73,0x74)
    const elstMagic = [0x65, 0x6C, 0x73, 0x74];
    let elstIndex = -1;
    for (let i = 0; i < data.length - 4; i++) {
        if (data[i] === elstMagic[0] && data[i+1] === elstMagic[1] &&
            data[i+2] === elstMagic[2] && data[i+3] === elstMagic[3]) {
            elstIndex = i;
            break;
        }
    }

    if (elstIndex === -1) {
        throw new Error('Atom "elst" tidak ditemukan. File mungkin bukan MP4/MOV yang valid.');
    }

    // Tulis payload di offset +8 (big-endian)
    const payloadOffset = elstIndex + 8;
    data[payloadOffset] = (PAYLOAD >> 24) & 0xFF;
    data[payloadOffset + 1] = (PAYLOAD >> 16) & 0xFF;
    data[payloadOffset + 2] = (PAYLOAD >> 8) & 0xFF;
    data[payloadOffset + 3] = PAYLOAD & 0xFF;

    await fsPromises.writeFile(outputPath, data);
}

// Handler untuk DOKUMEN (support MP4 & MOV)
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;
    
    // Cek ekstensi file
    if (!document.file_name || !isAllowedFile(document.file_name)) {
        const allowed = ALLOWED_EXTENSIONS.join(', ').toUpperCase();
        await bot.sendMessage(chatId, `❌ Harap kirim file dengan ekstensi ${allowed} (sebagai dokumen).\n\nFile yang dikirim: ${document.file_name || 'tidak diketahui'}`);
        return;
    }
    
    const fileSizeMB = document.file_size / (1024 * 1024);
    const ext = path.extname(document.file_name).toUpperCase();
    
    await bot.sendMessage(chatId, `📥 Menerima file ${ext}: ${document.file_name}\n📦 Ukuran: ${fileSizeMB.toFixed(2)} MB\n⏳ Sedang memproses...`);
    
    const tempInput = path.join(__dirname, `temp_${Date.now()}_input${path.extname(document.file_name)}`);
    const tempOutput = path.join(__dirname, `temp_${Date.now()}_output${path.extname(document.file_name)}`);
    
    try {
        // Download file
        const fileInfo = await bot.getFile(document.file_id);
        const fileLink = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.file_path}`;
        
        const response = await fetch(fileLink);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(tempInput, buffer);
        
        // Patch video
        await patchVideo(tempInput, tempOutput);
        
        // Kirim hasil sebagai dokumen
        const outputStats = fs.statSync(tempOutput);
        const outputSizeMB = outputStats.size / (1024 * 1024);
        
        await bot.sendMessage(chatId, `✅ Proses selesai!\n📊 Ukuran output: ${outputSizeMB.toFixed(2)} MB\n📤 Mengirim file hasil patch...`);
        
        await bot.sendDocument(chatId, tempOutput, {
            caption: `✨ Clean Uploader by @potaldogg\n\n✅ Video sudah di-patch!\n📁 Original: ${document.file_name}\n🔧 Payload: 0x${PAYLOAD.toString(16)}\n\n⬆️ Upload ke TikTok Studio untuk kualitas terjaga.`,
        });
        
        // Hapus file temporary
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);
        
    } catch (err) {
        await bot.sendMessage(chatId, `❌ Error: ${err.message}`);
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    }
});

// Handler untuk VIDEO (support MP4 & MOV kecil)
bot.on('video', async (msg) => {
    const chatId = msg.chat.id;
    const video = msg.video;
    
    const fileSizeMB = video.file_size / (1024 * 1024);
    
    if (fileSizeMB > 45) {
        await bot.sendMessage(chatId, 
            `⚠️ Video ${fileSizeMB.toFixed(2)} MB melebihi batas 50MB.\n\n` +
            `📌 Cara mengirim file besar:\n` +
            `• Klik 📎 (attach)\n` +
            `• Pilih "File" / "Document"\n` +
            `• Pilih file MP4/MOV kamu\n` +
            `• Kirim sebagai dokumen (bukan video)`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Cek ekstensi dari file_name jika ada
    if (video.file_name && !isAllowedFile(video.file_name)) {
        const allowed = ALLOWED_EXTENSIONS.join(', ').toUpperCase();
        await bot.sendMessage(chatId, `⚠️ Format file tidak didukung. Kirim file dengan ekstensi ${allowed}`);
        return;
    }
    
    await bot.sendMessage(chatId, `📥 Video diterima (${fileSizeMB.toFixed(2)} MB). Sedang memproses...`);
    
    const ext = video.file_name ? path.extname(video.file_name) : '.mp4';
    const tempInput = path.join(__dirname, `temp_${Date.now()}_input${ext}`);
    const tempOutput = path.join(__dirname, `temp_${Date.now()}_output${ext}`);
    
    try {
        const fileLink = await bot.getFileLink(video.file_id);
        const response = await fetch(fileLink);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(tempInput, buffer);
        
        await patchVideo(tempInput, tempOutput);
        
        await bot.sendMessage(chatId, '✅ Proses selesai! Mengirim video hasil patch...');
        
        // Kirim sebagai video (karena ukurannya kecil)
        await bot.sendVideo(chatId, tempOutput, {
            caption: `✨ Video sudah di-patch! Upload ke TikTok Studio.`,
        });
        
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);
    } catch (err) {
        await bot.sendMessage(chatId, `❌ Error: ${err.message}`);
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    }
});

// Command /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        `🎬 *Clean Uploader Bot* by @potaldogg\n\n` +
        `📤 *Cara pakai:*\n` +
        `Kirim file *MP4* atau *MOV* sebagai *DOKUMEN* (bukan video) agar support file besar.\n\n` +
        `📌 *Cara kirim file besar:*\n` +
        `1. Klik 📎 (attach)\n` +
        `2. Pilih "File" / "Document"\n` +
        `3. Pilih file .mp4 atau .mov\n` +
        `4. Kirim ke bot ini\n\n` +
        `✨ Setelah diproses, file akan dikembalikan dengan format yang sama.\n` +
        `⬆️ Upload hasilnya ke TikTok Studio untuk kualitas terjaga.\n\n` +
        `📁 *Support:* MP4, MOV\n` +
        `🔧 *Payload:* 0x10000001 (bypass TikTok quality)`,
        { parse_mode: 'Markdown' }
    );
});

console.log('Bot sedang berjalan...');
console.log(`Support format: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`);