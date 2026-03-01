import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import Groq from 'groq-sdk';
import { generateAssFile } from './assGenerator.js'; 

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const execPromise = util.promisify(exec);

const ffmpegPath = path.join(process.cwd(), 'ffmpeg.exe');
ffmpeg.setFfmpegPath(ffmpegPath);

const downloadsDir = path.join(process.cwd(), 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
app.use('/downloads', express.static(downloadsDir));

// LOCAL DATABASE
const jobsFile = path.join(process.cwd(), 'jobs.json');
if (!fs.existsSync(jobsFile)) fs.writeFileSync(jobsFile, JSON.stringify([]));
app.get('/api/jobs', (req, res) => { try { res.json(JSON.parse(fs.readFileSync(jobsFile, 'utf8'))); } catch (e) { res.json([]); } });
app.post('/api/jobs', (req, res) => { try { const j = JSON.parse(fs.readFileSync(jobsFile, 'utf8')); j.unshift(req.body); fs.writeFileSync(jobsFile, JSON.stringify(j, null, 2)); res.json({ success: true, jobs: j }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/jobs/:id', (req, res) => { try { let j = JSON.parse(fs.readFileSync(jobsFile, 'utf8')).filter(job => job.id !== parseInt(req.params.id)); fs.writeFileSync(jobsFile, JSON.stringify(j, null, 2)); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// HELPER: The "AutoSubs" Audio Sanitizer
const extractSanitizedAudio = (inputVideo, outputAudio) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputVideo)
            .output(outputAudio)
            .noVideo()
            .audioCodec('pcm_s16le') // Uncompressed 16-bit PCM (Zero decode lag)
            .audioChannels(1)        // Mono (AI Standard)
            .audioFrequency(16000)   // 16kHz (AI Native)
            .outputOptions([
                '-map_metadata -1',  // 🚨 KEY FIX: Strips hidden timecodes causing drift
                '-fflags +bitexact'  // Forces frame-perfect timing
            ])
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
};

// ==========================================
// ULTIMATE SYNC ENGINE (Sanitized Audio)
// ==========================================
app.post('/api/generate', async (req, res) => {
    const { url: videoUrl, mode, chunkDuration, partsCount, customVideoTitle, proSettings } = req.body;
    
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const sendUpdate = (message) => { console.log(message); res.write(`data: ${JSON.stringify({ message })}\n\n`); };

    sendUpdate(`\n========================================`);
    sendUpdate(`🚀 NEW JOB: ${mode.toUpperCase()} MODE (SANITIZED AUDIO)`);
    sendUpdate(`========================================\n`);

    let originalTitle = "Unknown Video";
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=${videoUrl}&format=json`);
        const data = await response.json();
        originalTitle = data.title || "Unknown Video";
    } catch (err) { }

    const safeTitle = originalTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
    const folderName = `${Date.now()}-${safeTitle || 'video'}-${mode}`;
    const jobFolder = path.join(downloadsDir, folderName);
    fs.mkdirSync(jobFolder, { recursive: true });

    const outputPath = path.join(jobFolder, 'original_source.mp4');
    
    sendUpdate(`[1/5] 📥 Downloading High-Res Video...`);
    const ytDlpProcess = spawn('.\\yt-dlp.exe', [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4', '--ffmpeg-location', ffmpegPath,
        '-o', outputPath, '--force-overwrites', '--no-playlist', 
        '--cookies-from-browser', 'firefox', '--js-runtimes', 'node', 
        '--extractor-args', 'youtube:player_client=tv', videoUrl
    ]);

    ytDlpProcess.on('close', async (code) => {
        if (code !== 0) { sendUpdate(`❌ Download failed`); return res.end(); }

        let wantsSubtitles = proSettings?.subtitles !== false; 
        let printPartTitle = proSettings?.printPartTitle === true;
        let displayTitle = customVideoTitle ? customVideoTitle.trim() : originalTitle;
        const safeTitleText = displayTitle.replace(/['":;,\\]/g, '').trim();

        // ==========================================
        // OPTION 1: SHORT VIDEO
        // ==========================================
        if (mode === 'short') {
            const fullAudioPath = path.join(jobFolder, 'full_audio.wav'); // .wav for speed
            sendUpdate(`[2/5] 🎵 Extracting Sanitized Audio for Analysis...`);

            // Use the Sanitizer Helper
            await extractSanitizedAudio(outputPath, fullAudioPath);

            try {
                sendUpdate(`[3/5] 🧠 AI Finding Viral Hook...`);
                const fullTranscription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(fullAudioPath), model: "whisper-large-v3", response_format: "verbose_json"
                });
                
                const chunkText = (fullTranscription.segments || []).slice(0, 40).map(s => `[${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s]: ${s.text}`).join('\n');
                let finalHook = { start_time: 0, end_time: 30 };
                
                try {
                    const aiResponse = await groq.chat.completions.create({
                        model: "llama-3.3-70b-versatile",
                        messages: [{ role: "system", content: `Find ONE engaging standalone scene. Output ONLY JSON: {"start_time": 10.5, "end_time": 25.2}` }, { role: "user", content: chunkText }],
                        response_format: { type: "json_object" }
                    });
                    let hook = JSON.parse(aiResponse.choices[0].message.content);
                    if (hook.start_time) finalHook = hook;
                } catch (err) { }

                const start = finalHook.start_time;
                let end = finalHook.end_time;
                let duration = end - start;
                if (duration < 10) { duration = 15; end = start + 15; } else if (duration > 75) { duration = 60; end = start + 60; }
                
                sendUpdate(`[4/5] ✂️ Cutting Video Clip...`);
                const baseShortPath = path.join(jobFolder, 'base_short.mp4');
                const finalVideoPath = path.join(jobFolder, 'final_ai_short.mp4');
                
                // Cut the video first
                await new Promise((resolve) => {
                    ffmpeg(outputPath).setStartTime(start).setDuration(duration)
                        .outputOptions(['-c copy']) // Lossless fast cut
                        .output(baseShortPath).on('end', resolve).run();
                });

                if (wantsSubtitles) {
                    sendUpdate(`🎵 Extracting Audio from Clip for Perfect Sync...`);
                    const clipAudioPath = path.join(jobFolder, 'clip_audio.wav'); // .wav for sync
                    
                    // 🚨 VITAL STEP: Extract sanitized audio FROM THE CUT CLIP
                    await extractSanitizedAudio(baseShortPath, clipAudioPath);

                    sendUpdate(`🧠 AI Transcribing Clip...`);
                    const transcription = await groq.audio.transcriptions.create({
                        file: fs.createReadStream(clipAudioPath), model: "whisper-large-v3", response_format: "verbose_json", timestamp_granularities: ["word"]
                    });

                    sendUpdate(`🎨 Baking Word-by-Word Subtitles...`);
                    const assPath = path.join(jobFolder, `subs.ass`);
                    
                    generateAssFile(transcription.words, assPath, {
                        ...proSettings,
                        topTitle: "", partNumber: "", videoDuration: duration
                    });

                    const safeAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

                    await new Promise((resolve) => {
                        ffmpeg(baseShortPath)
                            .complexFilter([
                                '[0:v]fps=30,crop=ih*(9/16):ih,scale=1080:1920:flags=lanczos[base]',
                                `[base]ass='${safeAssPath}'[outv]`
                            ])
                            .outputOptions(['-c:v libx264', '-preset fast', '-crf 17', '-map [outv]', '-map 0:a', '-c:a aac'])
                            .output(finalVideoPath).on('end', resolve).run();
                    });

                } else {
                    // No subs logic
                    await new Promise((resolve) => {
                        ffmpeg(baseShortPath)
                            .complexFilter(['[0:v]fps=30,crop=ih*(9/16):ih,scale=1080:1920:flags=lanczos[outv]'])
                            .outputOptions(['-c:v libx264', '-preset fast', '-crf 17', '-map [outv]', '-map 0:a', '-c:a aac'])
                            .output(finalVideoPath).on('end', resolve).run();
                    });
                }
                
                if (fs.existsSync(baseShortPath)) fs.unlinkSync(baseShortPath);
                sendUpdate(`✅ AI Short Complete!`);
                res.end();
            } catch (err) { 
                sendUpdate(`❌ Fatal Error: ${err.message}`); 
                res.end();
            }
        } 
        
        // ==========================================
        // OPTION 2: SPLIT MODE
        // ==========================================
        else if (mode === 'split') {
            sendUpdate(`✂️ Splitting video...`);
            let timePerChunk = parseInt(chunkDuration) || 60;
            const rawOutputPattern = path.join(jobFolder, 'raw_part_%03d.mp4');

            ffmpeg(outputPath).outputOptions(['-c copy', '-map 0', '-segment_time', timePerChunk.toString(), '-f', 'segment', '-reset_timestamps', '1']).output(rawOutputPattern)
                .on('end', async () => {
                    let expectedParts = partsCount ? parseInt(partsCount) : 5; 
                    
                    for(let i = 1; i <= expectedParts; i++) {
                        const rawPartPath = path.join(jobFolder, `raw_part_${String(i - 1).padStart(3, '0')}.mp4`);
                        const finalPartPath = path.join(jobFolder, `TikTok_Ready_Part_${i}.mp4`);
                        
                        if (!fs.existsSync(rawPartPath)) break;
                        
                        sendUpdate(`👉 Processing Part ${i}...`);
                        
                        let transcriptData = [];
                        if (wantsSubtitles) {
                            sendUpdate(`🎵 Extracting Audio from Part ${i}...`);
                            const chunkAudio = path.join(jobFolder, `audio_part_${i}.wav`);
                            
                            // 🚨 VITAL STEP: Extract sanitized audio FROM THE PART
                            await extractSanitizedAudio(rawPartPath, chunkAudio);
                            
                            try {
                                const transcription = await groq.audio.transcriptions.create({ 
                                    file: fs.createReadStream(chunkAudio), model: "whisper-large-v3", response_format: "verbose_json", timestamp_granularities: ["word"] 
                                });
                                transcriptData = transcription.words || [];
                            } catch(e) { console.log(`[AI Error]: ${e.message}`); }
                        }

                        sendUpdate(`🎨 Baking Word-by-Word Subtitles...`);
                        const assPath = path.join(jobFolder, `subs_part_${i}.ass`);
                        
                        // Pass exact duration so end credits don't linger
                        generateAssFile(transcriptData, assPath, {
                            ...proSettings,
                            topTitle: printPartTitle ? safeTitleText : "",
                            partNumber: printPartTitle ? `Part ${i}` : "",
                            videoDuration: timePerChunk
                        });

                        const safeAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

                        await new Promise((resolve) => {
                            ffmpeg(rawPartPath)
                                .complexFilter([
                                    '[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:20[bg]',
                                    '[0:v]fps=30,scale=1080:-1[fg]',
                                    '[bg][fg]overlay=(W-w)/2:(H-h)/2[base]',
                                    `[base]ass='${safeAssPath}'[outv]`
                                ])
                                .outputOptions(['-c:v libx264', '-preset fast', '-crf 17', '-map [outv]', '-map 0:a', '-c:a aac'])
                                .output(finalPartPath)
                                .on('end', resolve).run();
                        });

                        fs.unlinkSync(rawPartPath); 
                        sendUpdate(`✅ Part ${i} Complete!`);
                    }
                    sendUpdate(`🎉 DONE! Cinematic Vertical Video split perfectly!`);
                    res.end();
                }).run();
        }
    });
});

app.listen(PORT, () => console.log(`🚀 Sanitized Sync Engine running on http://localhost:${PORT}`));