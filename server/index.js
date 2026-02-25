import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';

import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import Groq from 'groq-sdk';

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

// 🌟 LOCAL JSON DATABASE SETUP 🌟
const jobsFile = path.join(process.cwd(), 'jobs.json');
if (!fs.existsSync(jobsFile)) fs.writeFileSync(jobsFile, JSON.stringify([]));

app.get('/api/jobs', (req, res) => {
    try {
        const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
        res.json(jobs);
    } catch (e) { res.json([]); }
});

app.post('/api/jobs', (req, res) => {
    try {
        const newJob = req.body;
        const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
        jobs.unshift(newJob);
        fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
        res.json({ success: true, jobs });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/jobs/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
        jobs = jobs.filter(job => job.id !== id);
        fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🌟 HELPER: FORMAT SECONDS TO .SRT TIMESTAMP (00:00:00,000) 🌟
const formatSrtTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

// ==========================================
// GENERATION ENGINE
// ==========================================
app.post('/api/generate', async (req, res) => {
    const { url: videoUrl, mode, chunkDuration, partsCount, niche, subNiche, customPrompt, proSettings } = req.body;
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const sendUpdate = (message) => {
        console.log(message);
        res.write(`data: ${JSON.stringify({ message })}\n\n`);
    };

    sendUpdate(`\n========================================`);
    sendUpdate(`🚀 NEW JOB: ${mode.toUpperCase()} MODE`);
    sendUpdate(`========================================\n`);

    let originalTitle = "Unknown Video";
    let originalChannel = "Unknown Channel";
    
    try {
        sendUpdate(`[1/7] 🔎 Fetching original video title from official API...`);
        const response = await fetch(`https://www.youtube.com/oembed?url=${videoUrl}&format=json`);
        const data = await response.json();
        originalTitle = data.title || "Unknown Video";
        originalChannel = data.author_name || "Unknown Channel";
        sendUpdate(`✅ Original Title: "${originalTitle}"`);
    } catch (err) {
        sendUpdate(`⚠️ Metadata Error: ${err.message}`);
    }

    const safeTitle = originalTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
    const folderName = `${Date.now()}-${safeTitle || 'video'}-${mode}`;
    const jobFolder = path.join(downloadsDir, folderName);
    
    fs.mkdirSync(jobFolder, { recursive: true });
    sendUpdate(`📁 Created Job Folder: /downloads/${folderName}`);

    const outputPath = path.join(jobFolder, 'original_source.mp4');
    
    sendUpdate(`\n[2/7] 📥 Downloading High-Res Video...`);
    const ytDlpProcess = spawn('.\\yt-dlp.exe', [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--ffmpeg-location', ffmpegPath,
        '-o', outputPath, '--force-overwrites',
        '--cookies-from-browser', 'edge', '--js-runtimes', 'node', 
        '--extractor-args', 'youtube:player_client=tv', videoUrl
    ]);

    ytDlpProcess.stdout.on('data', (data) => process.stdout.write(data.toString()));
    ytDlpProcess.stderr.on('data', (data) => process.stdout.write(data.toString()));

    ytDlpProcess.on('close', async (code) => {
        if (code !== 0) {
            sendUpdate(`\n❌ Download failed code ${code}`);
            return res.end();
        }
        sendUpdate(`✅ High-Res Download Complete!`);

        let speedMultiplier = 1.0;
        let wantsSubtitles = false;

        if (proSettings && !proSettings.autoPilot) {
            if (proSettings.pacing === "Fast") speedMultiplier = 1.1;
            if (proSettings.pacing === "VeryFast") speedMultiplier = 1.25;
            wantsSubtitles = proSettings.subtitles;
        }

        // ==========================================
        // OPTION 2: SPLIT VIDEO 
        // ==========================================
        if (mode === 'split') {
            let timePerChunk = parseInt(chunkDuration) || 60;
            let expectedParts = 0;
            let videoDuration = 0;

            try {
                await execPromise(`.\\ffmpeg.exe -i "${outputPath}"`);
            } catch (err) {
                const match = err.message.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
                if (match) {
                    const hours = parseInt(match[1], 10);
                    const minutes = parseInt(match[2], 10);
                    const seconds = parseFloat(match[3]);
                    videoDuration = (hours * 3600) + (minutes * 60) + seconds;
                    sendUpdate(`⏱️ Local Video Duration: ${videoDuration.toFixed(1)} seconds`);
                }
            }

            if (partsCount && parseInt(partsCount) > 0 && videoDuration > 0) {
                expectedParts = parseInt(partsCount);
                timePerChunk = videoDuration / expectedParts;
                sendUpdate(`\n[3/7] ✂️ Step 1: Chopping into exactly ${expectedParts} parts...`);
            } else {
                expectedParts = videoDuration > 0 ? Math.ceil(videoDuration / timePerChunk) : 5;
                sendUpdate(`\n[3/7] ✂️ Step 1: Chopping into ${timePerChunk}-second parts...`);
            }
            
            const rawOutputPattern = path.join(jobFolder, 'raw_part_%03d.mp4');

            ffmpeg(outputPath)
                .outputOptions(['-c copy', '-map 0', '-segment_time', timePerChunk.toString(), '-f', 'segment', '-reset_timestamps', '1'])
                .output(rawOutputPattern)
                .on('end', async () => {
                    sendUpdate(`✅ Raw cut complete!`);
                    sendUpdate(`\n[5/7] ✨ Step 2: Applying TikTok Glass Effect and Settings...`);
                    if (speedMultiplier !== 1.0) sendUpdate(`   ⏩ Speeding up playback to ${speedMultiplier}x!`);
                    
                    for(let i = 1; i <= expectedParts; i++) {
                        const rawPartPath = path.join(jobFolder, `raw_part_${String(i - 1).padStart(3, '0')}.mp4`);
                        const finalPartPath = path.join(jobFolder, `TikTok_Ready_Part_${i}.mp4`);
                        if (!fs.existsSync(rawPartPath)) break;
                        sendUpdate(`   👉 Rendering Part ${i} of ${expectedParts}...`);
                        
                        try {
                            await new Promise((resolve, reject) => {
                                let lastReportedPercent = 0;
                                let filterGraph = [
                                    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:20[bg]',
                                    '[0:v]scale=1080:-1[fg]',
                                    '[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]'
                                ];
                                let outputOptions = ['-c:v libx264', '-preset fast'];

                                if (speedMultiplier !== 1.0) {
                                    const pts = (1 / speedMultiplier).toFixed(4);
                                    filterGraph.push(`[outv]setpts=${pts}*PTS[finalv]`);
                                    filterGraph.push(`[0:a]atempo=${speedMultiplier}[finala]`);
                                    outputOptions.push('-map [finalv]', '-map [finala]', '-c:a aac');
                                } else {
                                    outputOptions.push('-map [outv]', '-map 0:a', '-c:a copy');
                                }

                                ffmpeg(rawPartPath)
                                    .complexFilter(filterGraph)
                                    .outputOptions(outputOptions)
                                    .output(finalPartPath)
                                    .on('progress', (progress) => {
                                        let currentSeconds = 0;
                                        if (progress.timemark) {
                                            const parts = progress.timemark.split(':');
                                            if (parts.length === 3) currentSeconds = (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseFloat(parts[2]);
                                        }
                                        let currentPercent = 0;
                                        if (progress.percent && !isNaN(progress.percent)) currentPercent = Math.floor(progress.percent);
                                        else if (currentSeconds > 0 && timePerChunk > 0) currentPercent = Math.floor((currentSeconds / timePerChunk) * 100);
                                        
                                        if (currentPercent > 100) currentPercent = 100;
                                        if (currentPercent >= lastReportedPercent + 10) {
                                            sendUpdate(`   ⏳ Rendering Part ${i}: ${currentPercent}% complete...`);
                                            lastReportedPercent = currentPercent;
                                        }
                                    })
                                    .on('end', resolve)
                                    .on('error', reject)
                                    .run();
                            });
                            sendUpdate(`   ✅ Part ${i} Rendered Successfully!`);
                            fs.unlinkSync(rawPartPath); 
                        } catch (err) { sendUpdate(`   ❌ Error rendering Part ${i}: ${err.message}`); }
                    }

                    const metadataPath = path.join(jobFolder, 'metadata.txt');
                    let splitMetadata = `Original Video: ${originalTitle}\nChannel: ${originalChannel}\n\nSuggested Upload Format:\n`;
                    for(let i = 1; i <= expectedParts; i++) splitMetadata += `Title: ${originalTitle} - Part ${i}\n`;
                    fs.writeFileSync(metadataPath, splitMetadata);

                    sendUpdate(`\n[7/7] 🔥 DONE! Cinematic Vertical Video split perfectly!`);
                    sendUpdate(`📂 Check your folder: /downloads/${folderName}/\n`);
                    res.end();
                })
                .on('error', (err) => { sendUpdate(`❌ FFmpeg Error: ${err.message}`); res.end(); })
                .run();
            return; 
        }

        // ==========================================
        // OPTION 1: SHORT VIDEO
        // ==========================================
        if (mode === 'short') {
            const audioPath = path.join(jobFolder, 'audio.mp3');
            sendUpdate(`\n[3/7] 🎵 Extracting Audio for AI Transcription...`);

            ffmpeg(outputPath).output(audioPath).noVideo().audioCodec('libmp3lame').on('end', async () => {
                sendUpdate(`✅ Audio Extracted!`);
                
                try {
                    sendUpdate(`\n[4/7] 🧠 AI is transcribing the audio at millisecond level...`);
                    
                    const transcription = await groq.audio.transcriptions.create({
                        file: fs.createReadStream(audioPath),
                        model: "whisper-large-v3",
                        response_format: "verbose_json",
                        timestamp_granularities: ["segment", "word"] 
                    });
                    
                    sendUpdate(`✅ Transcription Complete!`);
                    sendUpdate(`\n[5/7] ✂️ BRAIN 1 (70B Model): Editor is scanning for the best dynamic hook...`);
                    
                    let editorPrompt = `You are a master video editor. Find ONE highly engaging standalone scene or joke from this transcript. 
It can be anywhere from 10 to 60 seconds long. 
CRITICAL RULES:
1. Start and end at natural conversational boundaries.
2. Do NOT cut people off mid-sentence.
3. Do NOT merge two completely different scenes together.
Output ONLY a flat JSON object: {"start_time": 10.5, "end_time": 25.2}. If totally boring, output: {"boring": true}`;

                    const CHUNK_SIZE = 40; 
                    const chunks = [];
                    const safeSegments = transcription.segments || [];

                    for (let i = 0; i < safeSegments.length; i += CHUNK_SIZE) {
                        const chunkSegments = safeSegments.slice(i, i + CHUNK_SIZE);
                        const chunkText = chunkSegments.map(s => `[${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s]: ${s.text}`).join('\n');
                        chunks.push(chunkText);
                    }

                    let finalHook = null;

                    for (let i = 0; i < chunks.length; i++) {
                        sendUpdate(`   👉 Scanning Part ${i + 1} of ${chunks.length}...`);
                        try {
                            const aiResponse = await groq.chat.completions.create({
                                model: "llama-3.3-70b-versatile",
                                messages: [
                                    { role: "system", content: editorPrompt },
                                    { role: "user", content: chunks[i] }
                                ],
                                response_format: { type: "json_object" }
                            });
                            
                            let hook = JSON.parse(aiResponse.choices[0].message.content);
                            if ((hook.start_time || hook.startTime || hook.start) && !hook.boring) {
                                finalHook = hook;
                                sendUpdate(`   🌟 Viral Hook Found starting at ${finalHook.start_time ?? finalHook.start}s!`);
                                break; 
                            }
                        } catch (err) { sendUpdate(`   ⚠️ API Limit hit on Part ${i + 1}. Retrying next...`); }
                        if (i < chunks.length - 1 && !finalHook) await sleep(20000);
                    }

                    if (!finalHook || (!finalHook.start_time && !finalHook.startTime && !finalHook.start)) {
                        sendUpdate(`\n⚠️ Brain 1 couldn't decide. Defaulting to first 30 seconds.`);
                        finalHook = { start_time: 0, end_time: 30 };
                    }

                    const start = finalHook.start_time ?? finalHook.startTime ?? finalHook.start;
                    let end = finalHook.end_time ?? finalHook.endTime ?? finalHook.end;
                    let duration = parseFloat(end) - parseFloat(start);

                    if (duration < 10) { end = parseFloat(start) + 15; duration = 15; } 
                    else if (duration > 75) { end = parseFloat(start) + 60; duration = 60; }

                    const clipSegments = safeSegments.filter(s => s.end >= start && s.start <= end);
                    const clipText = clipSegments.map(s => s.text).join(' ');

                    sendUpdate(`\n[6/7] 📈 BRAIN 2 (70B SEO Model): Analyzing script for viral hashtags...`);

                    let seoPrompt = `You are a Gen-Z TikTok and YouTube Shorts viral SEO marketer. Context:\n- Title: "${originalTitle}"\n- Channel: "${originalChannel}"\nScript:\n${clipText}\nOUTPUT ONLY JSON: {"title": "lowercase title 💀", "hashtags": "#fyp #viral"}`;

                    let title = "viral clip 💀";
                    let hashtags = "#fyp #viral";

                    try {
                        const seoResponse = await groq.chat.completions.create({
                            model: "llama-3.3-70b-versatile",
                            messages: [ 
                                { role: "system", content: seoPrompt },
                                { role: "user", content: `Generate title and hashtags for this script:\n\n${clipText}` } 
                            ],
                            response_format: { type: "json_object" }
                        });
                        const seoData = JSON.parse(seoResponse.choices[0].message.content);
                        title = seoData.title || title;
                        hashtags = seoData.hashtags || hashtags;
                    } catch (seoErr) { sendUpdate(`⚠️ Brain 2 (70B) Error: ${seoErr.message}`); }
                    
                    sendUpdate(`\n🎉 VIRAL METADATA GENERATED BY 70B AI!`);
                    sendUpdate(`📝 TikTok Title: ${title}`);
                    sendUpdate(`🏷️ Tags:  ${hashtags}`);

                    // 🌟 BUG FIX 1: RESTORED THE METADATA SAVER 🌟
                    const metadataPath = path.join(jobFolder, 'metadata.txt');
                    fs.writeFileSync(metadataPath, `Original Video: ${originalTitle}\nChannel: ${originalChannel}\nTikTok Title: ${title}\nHashtags: ${hashtags}\nClip Duration: ${duration.toFixed(1)} seconds`);

                    // ==========================================================
                    // 🌟 STEP 3: THE SMART SUBTITLE ENGINE (SILENCE DETECTOR) 🌟
                    // ==========================================================
                    let srtPath = "";
                    
                    if (wantsSubtitles) {
                        let srtContent = '';
                        let subIndex = 1;

                        if (transcription.words && transcription.words.length > 0) {
                            sendUpdate(`   🔤 Building Smart Subtitles with Silence Detection...`);
                            
                            const validWords = transcription.words.filter(w => w.start >= start && w.end <= end);
                            
                            let subtitleChunks = [];
                            let currentChunk = [];

                            // 🌟 BUG FIX 2: THE SILENCE DETECTOR 🌟
                            for (let i = 0; i < validWords.length; i++) {
                                const wordObj = validWords[i];
                                
                                if (currentChunk.length === 0) {
                                    currentChunk.push(wordObj);
                                } else {
                                    const prevWord = currentChunk[currentChunk.length - 1];
                                    const gap = wordObj.start - prevWord.end;
                                    
                                    // If there is a silence longer than 0.4s, OR we hit 3 words, break the chunk!
                                    if (gap > 0.4 || currentChunk.length >= 3) {
                                        subtitleChunks.push(currentChunk);
                                        currentChunk = [wordObj];
                                    } else {
                                        currentChunk.push(wordObj);
                                    }
                                }
                            }
                            // Push the last chunk
                            if (currentChunk.length > 0) subtitleChunks.push(currentChunk);

                            // Write out the precise chunks
                            subtitleChunks.forEach(chunk => {
                                let chunkStart = Math.max(0, chunk[0].start - start);
                                let chunkEnd = chunk[chunk.length - 1].end - start;
                                let text = chunk.map(w => w.word.trim()).join(' ');
                                
                                if (chunkEnd > chunkStart && text.length > 0) {
                                    srtContent += `${subIndex++}\n`;
                                    srtContent += `${formatSrtTime(chunkStart)} --> ${formatSrtTime(chunkEnd)}\n`;
                                    srtContent += `${text}\n\n`;
                                }
                            });
                        } else if (clipSegments.length > 0) {
                            sendUpdate(`   🔤 Building Fast-Paced Subtitles via Math...`);
                            let validWords = [];
                            clipSegments.forEach(seg => {
                                const words = seg.text.trim().split(/\s+/);
                                if (words.length > 0) {
                                    const timePerWord = (seg.end - seg.start) / words.length;
                                    words.forEach((w, idx) => {
                                        validWords.push({
                                            word: w,
                                            start: seg.start + (idx * timePerWord),
                                            end: seg.start + ((idx + 1) * timePerWord)
                                        });
                                    });
                                }
                            });

                            let subtitleChunks = [];
                            let currentChunk = [];

                            for (let i = 0; i < validWords.length; i++) {
                                const wordObj = validWords[i];
                                if (currentChunk.length === 0) {
                                    currentChunk.push(wordObj);
                                } else {
                                    const prevWord = currentChunk[currentChunk.length - 1];
                                    const gap = wordObj.start - prevWord.end;
                                    if (gap > 0.4 || currentChunk.length >= 3) {
                                        subtitleChunks.push(currentChunk);
                                        currentChunk = [wordObj];
                                    } else {
                                        currentChunk.push(wordObj);
                                    }
                                }
                            }
                            if (currentChunk.length > 0) subtitleChunks.push(currentChunk);

                            subtitleChunks.forEach(chunk => {
                                let chunkStart = Math.max(0, chunk[0].start - start);
                                let chunkEnd = chunk[chunk.length - 1].end - start;
                                let text = chunk.map(w => w.word.trim()).join(' ');
                                if (chunkEnd > chunkStart && text.length > 0) {
                                    srtContent += `${subIndex++}\n`;
                                    srtContent += `${formatSrtTime(chunkStart)} --> ${formatSrtTime(chunkEnd)}\n`;
                                    srtContent += `${text}\n\n`;
                                }
                            });
                        }

                        if (srtContent.trim().length > 0) {
                            srtPath = path.join(jobFolder, 'subs.srt');
                            fs.writeFileSync(srtPath, srtContent);
                        }
                    }

                    // 🌟 DYNAMIC FFmpeg FILTERS 🌟
                    const vFilters = [{ filter: 'crop', options: 'ih*(9/16):ih' }];
                    const aFilters = [];

                    if (wantsSubtitles && srtPath) {
                        const safeSrtPath = path.relative(process.cwd(), srtPath).replace(/\\/g, '/');
                        const style = "Fontname=Impact,Fontsize=22,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Shadow=1,Alignment=2,MarginV=60";
                        
                        vFilters.push({ 
                            filter: 'subtitles', 
                            options: `${safeSrtPath}:force_style='${style}'` 
                        });
                        sendUpdate(`   🔤 Burning Bold Yellow Subtitles onto video...`);
                    }

                    if (speedMultiplier !== 1.0) {
                        const pts = (1 / speedMultiplier).toFixed(4); 
                        vFilters.push({ filter: 'setpts', options: `${pts}*PTS` });
                        aFilters.push({ filter: 'atempo', options: speedMultiplier.toString() });
                        sendUpdate(`   ⏩ Speeding up video to ${speedMultiplier}x Pacing...`);
                    }

                    sendUpdate(`\n[7/7] ✂️ Cutting & Rendering Final Vertical Video...`);

                    const finalVideoPath = path.join(jobFolder, 'final_ai_short.mp4');

                    const command = ffmpeg(outputPath)
                        .setStartTime(start)
                        .setDuration(duration)
                        .videoFilters(vFilters);

                    if (aFilters.length > 0) {
                        command.audioFilters(aFilters);
                    }

                    command
                        .output(finalVideoPath)
                        .on('end', () => {
                            sendUpdate(`\n🔥 DONE! High-Res AI short saved!`);
                            sendUpdate(`📂 Check your folder: /downloads/${folderName}/\n`);
                            res.end(); 
                        })
                        .on('error', (err) => {
                            sendUpdate(`❌ FFmpeg Error: ${err.message}`);
                            res.end();
                        })
                        .run();

                } catch (err) { 
                    sendUpdate(`\n❌ Fatal AI Error: ${err.message}`); 
                    res.end();
                }
            }).run();
        }
    });
});

app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));