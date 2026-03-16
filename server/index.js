import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';

import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import Groq from 'groq-sdk';

import googleTrends from 'google-trends-api';
import Parser from 'rss-parser';

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

// ==========================================
// GENERATION ENGINE (REPURPOSE APP)
// ==========================================
app.post('/api/generate', async (req, res) => {
    const { url: videoUrl, mode, chunkDuration, partsCount, customVideoTitle, proSettings } = req.body;
    
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
        '--no-playlist', 
        '--cookies-from-browser', 'firefox', '--js-runtimes', 'node', 
        videoUrl
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
        let printPartTitle = false;
        let wantsAutoCut = proSettings?.autoCut ?? true; 
        
        let subtitleFont = "Impact";
        let isBold = "1";
        let rawColorName = "White"; 

        if (proSettings && !proSettings.autoPilot) {
            if (proSettings.pacing === "Fast") speedMultiplier = 1.1;
            if (proSettings.pacing === "VeryFast") speedMultiplier = 1.25;
            wantsSubtitles = proSettings.subtitles;
            printPartTitle = proSettings.printPartTitle; 
            
            if (proSettings.subtitleFont) {
                subtitleFont = proSettings.subtitleFont.replace(" Bold", "");
                isBold = (subtitleFont === "Impact" || proSettings.subtitleFont.includes("Bold") || subtitleFont === "Comic Sans MS") ? "1" : "0";
            }
            if (proSettings.subtitleColor) {
                rawColorName = proSettings.subtitleColor; 
            }
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
                    sendUpdate(`\n[5/7] ✨ Step 2: Applying Settings & Remotion Overlays...`);
                    
                    for(let i = 1; i <= expectedParts; i++) {
                        const rawPartPath = path.join(jobFolder, `raw_part_${String(i - 1).padStart(3, '0')}.mp4`);
                        const basePartPath = path.join(jobFolder, `base_part_${i}.mp4`); 
                        const finalPartPath = path.join(jobFolder, `TikTok_Ready_Part_${i}.mp4`); 
                        if (!fs.existsSync(rawPartPath)) break;
                        
                        sendUpdate(`   👉 Processing Part ${i} of ${expectedParts}...`);
                        
                        try {
                            await new Promise((resolve, reject) => {
                                let lastReportedPercent = 0;

                                let filterGraph = [
                                    '[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,boxblur=20:20[bg]',
                                    '[0:v]fps=30,crop=ih:ih,scale=1080:1080:flags=lanczos[fg]',
                                    '[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]'
                                ];
                                
                                let outputOptions = [
                                    '-c:v libx264', 
                                    '-preset slow', 
                                    '-crf 12', 
                                    '-pix_fmt yuv420p',
                                    '-b:v 15M',
                                    '-maxrate 20M',
                                    '-bufsize 20M',
                                    '-async 1', 
                                    '-vsync 1'
                                ];
                                let currentVOut = 'outv';

                                if (speedMultiplier !== 1.0) {
                                    const pts = (1 / speedMultiplier).toFixed(4);
                                    filterGraph.push(`[${currentVOut}]setpts=${pts}*PTS[finalv]`);
                                    filterGraph.push(`[0:a]atempo=${speedMultiplier}[finala]`);
                                    outputOptions.push('-map [finalv]', '-map [finala]', '-c:a aac');
                                } else {
                                    outputOptions.push(`-map [${currentVOut}]`, '-map 0:a', '-c:a aac');
                                }

                                ffmpeg(rawPartPath)
                                    .complexFilter(filterGraph)
                                    .outputOptions(outputOptions)
                                    .output(basePartPath)
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
                                            sendUpdate(`   ⏳ FFmpeg Filtering Part ${i}: ${currentPercent}% complete...`);
                                            lastReportedPercent = currentPercent;
                                        }
                                    })
                                    .on('end', resolve)
                                    .on('error', reject)
                                    .run();
                            });

                            if (printPartTitle || wantsSubtitles) {
                                let transcriptData = null;

                                if (wantsSubtitles) {
                                    sendUpdate(`   🎵 Extracting audio & Transcribing Part ${i}...`);
                                    const chunkAudio = path.join(jobFolder, `audio_part_${i}.m4a`);
                                    await new Promise((res, rej) => {
                                        ffmpeg(basePartPath).noVideo().audioCodec('aac').audioChannels(1).audioFrequency(16000).output(chunkAudio).on('end', res).on('error', rej).run();
                                    });
                                    try {
                                        const transcription = await groq.audio.transcriptions.create({
                                            file: fs.createReadStream(chunkAudio),
                                            model: "whisper-large-v3",
                                            response_format: "verbose_json",
                                            timestamp_granularities: ["word"],
                                            temperature: 0.0,
                                            language: "en",
                                            prompt: "Ignore all background noise, music, gunshots, and screams. Only transcribe clear spoken words. Do not output anything for silence."
                                        });
                                        transcriptData = transcription.words || [];
                                    } catch(e) { sendUpdate(`   ⚠️ AI Limit. No subs for Part ${i}.`); }
                                }

                                sendUpdate(`   🎨 Remotion is layering Custom Text & Animations...`);
                                
                                let displayTitle = customVideoTitle ? customVideoTitle.trim() : originalTitle;
                                const safeTitleText = displayTitle.replace(/['":;,\\]/g, '').trim();
                                
                                const videoFileUrl = `http://localhost:${PORT}/downloads/${folderName}/base_part_${i}.mp4`;

                                let exactDuration = timePerChunk / speedMultiplier;
                                try {
                                    const { stdout } = await execPromise(`.\\ffmpeg.exe -i "${basePartPath}" 2>&1`);
                                } catch (err) {
                                    const match = err.message.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
                                    if (match) exactDuration = (parseInt(match[1]) * 3600) + (parseInt(match[2]) * 60) + parseFloat(match[3]);
                                }

                                const propsData = {
                                    topTitle: printPartTitle ? safeTitleText : "",
                                    partNumber: printPartTitle ? `Part ${i}` : "",
                                    videoUrl: videoFileUrl,
                                    durationInSeconds: exactDuration,
                                    
                                    titleFontSize: proSettings?.titleFontSize || 90,
                                    titleYPos: proSettings?.titleYPos || 200,
                                    partFontSize: proSettings?.partFontSize || 130,
                                    partYPos: proSettings?.partYPos || 150,
                                    subtitleFontSize: proSettings?.subtitleFontSize || 70,
                                    subtitleYPos: proSettings?.subtitleYPos || 380,
                                    
                                    subtitleFont: proSettings?.subtitleFont || "Impact",
                                    subtitleColor: proSettings?.subtitleColor || "Yellow",
                                    textBgStyle: proSettings?.textBgStyle || "outline",
                                    forceUppercase: proSettings?.forceUppercase ?? true,
                                    wordsPerScreen: proSettings?.wordsPerScreen || "1",
                                    animationStyle: proSettings?.animationStyle || "pop",
                                    
                                    transcription: transcriptData
                                };
                                const propsPath = path.join(jobFolder, `props_part_${i}.json`);
                                fs.writeFileSync(propsPath, JSON.stringify(propsData));

                                await sleep(2000);
                                await execPromise(`npx remotion render CapCutStyleVideo "${finalPartPath}" --props="${propsPath}" --log=error --timeout=120000 --crf=12`);
                                
                                fs.unlinkSync(basePartPath);
                            } else {
                                fs.renameSync(basePartPath, finalPartPath);
                            }

                            sendUpdate(`   ✅ Part ${i} Fully Rendered Successfully!`);
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
        // OPTION 1: SHORT MODE 
        // ==========================================
        if (mode === 'short') {
            const audioPath = path.join(jobFolder, 'audio.m4a');
            sendUpdate(`\n[3/7] 🎵 Extracting & Crushing Audio to prevent AI size limits...`);

            ffmpeg(outputPath)
                .output(audioPath)
                .noVideo()
                .audioCodec('aac')
                .audioChannels(1)
                .audioFrequency(16000)
                .audioBitrate('16k')
                .setDuration(7200) 
                .on('end', async () => {
                sendUpdate(`✅ Audio Extracted safely under 25MB limit!`);
                
                try {
                    sendUpdate(`\n[4/7] 🧠 AI is transcribing the audio at millisecond level...`);
                    
                    const transcription = await groq.audio.transcriptions.create({
                        file: fs.createReadStream(audioPath),
                        model: "whisper-large-v3",
                        response_format: "verbose_json",
                        timestamp_granularities: ["segment", "word"],
                        temperature: 0.0,
                        language: "en",
                        prompt: "Ignore all background noise, music, gunshots, and screams. Only transcribe clear spoken words. Do not output anything for silence."
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

                    sendUpdate(`\n[6/7] 📈 BRAIN 2 (70B SEO Model): Generating viral TikTok title and hashtags...`);

                    let seoPrompt = `You are a Gen-Z TikTok and YouTube Shorts viral SEO marketer. Create a brand NEW, short, clickbaity TikTok caption based ONLY on the specific 'Clip Script' below. DO NOT just copy the Original Title. Make it native to TikTok (lowercase, use emojis like 💀😭🔥).
                    
Original Video Info:
- Original Title: "${originalTitle}"
- Channel: "${originalChannel}"

Clip Script:
"${clipText}"

OUTPUT ONLY JSON: {"title": "new viral caption here 💀", "hashtags": "#fyp #viral #specifictag"}`;

                    let title = "viral clip 💀";
                    let hashtags = "#fyp #viral";

                    try {
                        const seoResponse = await groq.chat.completions.create({
                            model: "llama-3.3-70b-versatile",
                            messages: [ 
                                { role: "system", content: seoPrompt },
                                { role: "user", content: `Generate a brand NEW title and hashtags for this script:\n\n${clipText}` } 
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

                    const metadataPath = path.join(jobFolder, 'metadata.txt');
                    fs.writeFileSync(metadataPath, `Original Video: ${originalTitle}\nChannel: ${originalChannel}\nTikTok Title: ${title}\nHashtags: ${hashtags}\nClip Duration: ${duration.toFixed(1)} seconds`);

                    let shiftedTranscript = [];
                    if (wantsSubtitles || wantsAutoCut) {
                        sendUpdate(`   🔤 Preparing Frame-Locked Audio timings...`);
                        
                        let validWords = [];
                        if (transcription.words && transcription.words.length > 0) {
                            validWords = transcription.words.filter(w => w.start >= start && w.end <= end);
                        } else if (clipSegments.length > 0) {
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
                        }
                        
                        shiftedTranscript = validWords.map(w => {
                            let adjustedStart = w.start - start + 0.15;
                            if (adjustedStart >= (w.end - start)) {
                                adjustedStart = w.start - start;
                            }
                            return {
                                word: w.word,
                                start: Math.max(0, adjustedStart),
                                end: Math.max(0, w.end - start)
                            };
                        });
                    }

                    sendUpdate(`\n[7/7] ✂️ Cutting Base Video (Phase 1)...`);
                    
                    const baseShortPath = path.join(jobFolder, 'base_short.mp4');
                    const finalVideoPath = path.join(jobFolder, 'final_ai_short.mp4');

                    let filterGraph = [
                        '[0:v]fps=30,crop=ih*(9/16):ih,scale=1080:1920:flags=lanczos,unsharp=5:5:1.0:5:5:0.0[outv]'
                    ];
                    
                    let outputOptions = [
                        '-c:v libx264', 
                        '-preset slow', 
                        '-crf 12', 
                        '-pix_fmt yuv420p',
                        '-b:v 30M',
                        '-maxrate 45M',
                        '-bufsize 45M',
                        '-async 1', 
                        '-vsync 1'
                    ];
                    let currentVOut = 'outv';

                    if (speedMultiplier !== 1.0) {
                        const pts = (1 / speedMultiplier).toFixed(4);
                        filterGraph.push(`[${currentVOut}]setpts=${pts}*PTS[finalv]`);
                        filterGraph.push(`[0:a]atempo=${speedMultiplier}[finala]`);
                        outputOptions.push('-map [finalv]', '-map [finala]', '-c:a aac');
                    } else {
                        outputOptions.push(`-map [${currentVOut}]`, '-map 0:a', '-c:a aac');
                    }

                    try {
                        await new Promise((resolve, reject) => {
                            ffmpeg(outputPath)
                                .setStartTime(start)
                                .setDuration(duration)
                                .complexFilter(filterGraph)
                                .outputOptions(outputOptions)
                                .output(baseShortPath)
                                .on('end', resolve)
                                .on('error', reject)
                                .run();
                        });

                        if (wantsSubtitles && shiftedTranscript.length > 0) {
                            sendUpdate(`   🎨 Remotion is applying 0-Lag Visual Subtitles...`);
                            
                            const videoFileUrl = `http://localhost:${PORT}/downloads/${folderName}/base_short.mp4`;
                            let exactDuration = duration / speedMultiplier;
                            
                            const propsData = {
                                topTitle: "", 
                                partNumber: "",
                                videoUrl: videoFileUrl,
                                durationInSeconds: exactDuration,
                                
                                titleFontSize: proSettings?.titleFontSize || 90,
                                titleYPos: proSettings?.titleYPos || 200,
                                partFontSize: proSettings?.partFontSize || 130,
                                partYPos: proSettings?.partYPos || 150,
                                subtitleFontSize: proSettings?.subtitleFontSize || 70,
                                subtitleYPos: proSettings?.subtitleYPos || 380,
                                
                                subtitleFont: proSettings?.subtitleFont || "Impact",
                                subtitleColor: proSettings?.subtitleColor || "Yellow",
                                textBgStyle: proSettings?.textBgStyle || "outline",
                                forceUppercase: proSettings?.forceUppercase ?? true,
                                wordsPerScreen: proSettings?.wordsPerScreen || "1",
                                animationStyle: proSettings?.animationStyle || "pop",
                                
                                transcription: shiftedTranscript 
                            };
                            
                            const propsPath = path.join(jobFolder, `props_short.json`);
                            fs.writeFileSync(propsPath, JSON.stringify(propsData));

                            await sleep(2000);
                            
                            await execPromise(`npx remotion render CapCutStyleVideo "${finalVideoPath}" --props="${propsPath}" --log=error --timeout=120000 --crf=12`);
                            
                            fs.unlinkSync(baseShortPath); 
                        } else {
                            fs.renameSync(baseShortPath, finalVideoPath);
                        }

                        if (wantsAutoCut && shiftedTranscript.length > 0) {
                            sendUpdate(`\n[8/8] ✂️ AUTO-CUT: Scanning for dead air...`);
                            
                            const SILENCE_GAP = 0.55; 
                            const PAD_START = 0.1;    
                            const PAD_END = 0.2;      
                            
                            let keepIntervals = [];
                            
                            shiftedTranscript.forEach(w => {
                                let wordStartScaled = w.start / speedMultiplier;
                                let wordEndScaled = w.end / speedMultiplier;
                                
                                let s = Math.max(0, wordStartScaled - PAD_START);
                                let e = wordEndScaled + PAD_END;
                                
                                if (keepIntervals.length === 0) {
                                    keepIntervals.push({ start: s, end: e });
                                } else {
                                    let last = keepIntervals[keepIntervals.length - 1];
                                    if (s - last.end < SILENCE_GAP) {
                                        last.end = Math.max(last.end, e);
                                    } else {
                                        keepIntervals.push({ start: s, end: e });
                                    }
                                }
                            });

                            if (keepIntervals.length > 1) {
                                sendUpdate(`   🔪 Found ${keepIntervals.length - 1} silences! Applying Jump-Cuts...`);
                                
                                let complexFilter = "";
                                let concatInputs = "";

                                keepIntervals.forEach((interval, index) => {
                                    complexFilter += `[0:v]trim=start=${interval.start.toFixed(3)}:end=${interval.end.toFixed(3)},setpts=PTS-STARTPTS[v${index}]; `;
                                    complexFilter += `[0:a]atrim=start=${interval.start.toFixed(3)}:end=${interval.end.toFixed(3)},asetpts=PTS-STARTPTS[a${index}]; `;
                                    concatInputs += `[v${index}][a${index}]`;
                                });

                                complexFilter += `${concatInputs}concat=n=${keepIntervals.length}:v=1:a=1[outv][outa]`;

                                const jumpCutPath = path.join(jobFolder, 'final_ai_short_jumpcut.mp4');

                                try {
                                    await new Promise((resolve, reject) => {
                                        ffmpeg(finalVideoPath)
                                            .complexFilter(complexFilter)
                                            .outputOptions([
                                                '-map [outv]',
                                                '-map [outa]',
                                                '-c:v libx264',
                                                '-preset fast',
                                                '-crf 12', 
                                                '-c:a aac'
                                            ])
                                            .output(jumpCutPath)
                                            .on('end', resolve)
                                            .on('error', reject)
                                            .run();
                                    });

                                    fs.unlinkSync(finalVideoPath);
                                    fs.renameSync(jumpCutPath, finalVideoPath);
                                    sendUpdate(`   ✅ Jump-Cuts applied perfectly!`);
                                } catch (cutErr) {
                                    sendUpdate(`   ⚠️ Jump-Cut skipped due to FFmpeg error: ${cutErr.message}`);
                                }
                            } else {
                                sendUpdate(`   ✅ Video is already fast-paced! No dead air found.`);
                            }
                        }

                        sendUpdate(`\n🔥 DONE! High-Res AI short saved with perfect sync!`);
                        sendUpdate(`📂 Check your folder: /downloads/${folderName}/\n`);
                        res.end();

                    } catch (err) {
                        sendUpdate(`❌ FFmpeg/Remotion Error: ${err.message}`);
                        res.end();
                    }

                } catch (err) { 
                    sendUpdate(`\n❌ Fatal AI Error: ${err.message}`); 
                    res.end();
                }
            }).run();
        }
    });
});

// ==========================================
// 🤖 AI TREND STUDIO ENGINE (VEO & SORA)
// ==========================================
app.post('/api/generate-ai-video', async (req, res) => {
    const { topic, engine, trendSource } = req.body;
    
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
    sendUpdate(`🚀 NEW AI STUDIO JOB STARTED`);
    sendUpdate(`========================================\n`);

    try {
        let finalTopic = topic;

        if (topic === "Auto-Scrape Viral Trends" || !topic) {
            sendUpdate(`[1/4] 🌍 Fetching live trends from ${trendSource} using RSS bypass...`);
            
            const parser = new Parser({
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' 
                }
            });
            
            if (trendSource === "reddit") {
                try {
                    const feed = await parser.parseURL('https://www.reddit.com/r/popculturechat/top.rss');
                    finalTopic = feed.items.slice(0, 10).map(item => item.title).join('\n');
                    sendUpdate(`✅ Scraped top daily Reddit posts via RSS!`);
                } catch (e) {
                    throw new Error(`Reddit RSS failed: ${e.message}`);
                }
            } else {
                try {
                    const feed = await parser.parseURL('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
                    finalTopic = feed.items.slice(0, 10).map(item => item.title).join(', ');
                    sendUpdate(`✅ Scraped top Google News headlines via RSS!`);
                } catch (e) {
                    throw new Error(`Google RSS failed: ${e.message}`);
                }
            }
        } else {
            sendUpdate(`[1/4] 🎯 Using custom topic: "${topic}"`);
        }

        sendUpdate(`\n[2/4] 🧠 Groq Llama-3.3-70B is writing the cinematic prompt...`);
        const aiPrompt = `You are an elite AI video director. 
        Read these trending topics/inputs: "${finalTopic}"
        
        Create ONE highly visual, cinematic prompt for an AI video generator (like Sora or Veo) based on this trend. 
        The prompt must be highly detailed but under 600 characters. 
        Also, choose the best engine. Use "veo" for photorealism/faces/physics. Use "sora" for drone shots, 3D animation, or surrealism.
        
        Respond ONLY in JSON format like this: {"prompt": "your cinematic prompt...", "engine": "veo"}`;

        const promptGen = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: aiPrompt }],
            response_format: { type: "json_object" }
        });
        
        const aiResult = JSON.parse(promptGen.choices[0].message.content);
        const generatedPrompt = aiResult.prompt;
        
        const targetEngine = (engine === "auto" ? aiResult.engine : engine).toLowerCase();

        sendUpdate(`✅ Prompt Written: "${generatedPrompt}"`);
        sendUpdate(`✅ AI Routed to Engine: [${targetEngine.toUpperCase()}]`);

        // ====================================================
        // 🌟 THE ULTIMATE FIX: ENVIRONMENT VARIABLE BRIDGE 🌟
        // ====================================================
        sendUpdate(`\n[3/4] 🤖 Booting up ${targetEngine.toUpperCase()} Automation Bot...`);
        
        const scriptName = targetEngine === "sora" ? "generate_sora.py" : "generate_veo.py";
        const scriptPath = path.join(process.cwd(), 'server', scriptName);
        
        // Inject the prompt natively through an Environment Variable to bypass ALL Windows CMD quoting bugs
        const processEnv = { ...process.env, AI_PROMPT: generatedPrompt, PYTHONIOENCODING: 'utf-8' };

        // We use 'python' with shell: true so pyenv loads perfectly without needing exact .exe paths
        const pyProcess = spawn('python', ['-u', scriptPath], { 
            shell: true,
            env: processEnv 
        });

        pyProcess.on('error', (err) => {
            console.error(`[SPAWN ERROR]:`, err);
            sendUpdate(`   ❌ ERROR: Failed to start Python executable: ${err.message}`);
        });

        pyProcess.stdout.on('data', (data) => {
            data.toString().split('\n').forEach(line => {
                if(line.trim()) sendUpdate(`   [BOT]: ${line.trim()}`);
            });
        });

        pyProcess.stderr.on('data', (data) => {
            data.toString().split('\n').forEach(line => {
                if(line.trim()) sendUpdate(`   [ERROR]: ${line.trim()}`);
            });
        });

        pyProcess.on('close', (code) => {
            if (code !== 0) {
                sendUpdate(`\n❌ Bot crashed or failed to start (Exit Code ${code}).`);
                return res.end();
            }
            sendUpdate(`\n[4/4] 🔥 DONE! AI Video successfully generated and downloaded!`);
            sendUpdate(`📂 Check your downloads/${targetEngine} folder!\n`);
            res.end();
        });

    } catch (err) {
        sendUpdate(`\n❌ Fatal Pipeline Error: ${err.message}`);
        res.end();
    }
});

app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));