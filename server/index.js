import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/generate', async (req, res) => {
    // 🌟 Added partsCount to the incoming request body 🌟
    const { url: videoUrl, mode, chunkDuration, partsCount, niche, subNiche, customPrompt } = req.body;
    
    console.log(`\n========================================`);
    console.log(`🚀 NEW JOB: ${mode.toUpperCase()} MODE`);
    console.log(`========================================\n`);
    
    res.json({ status: "processing", message: "Processing started! Watch the server terminal for live progress." });

    let originalTitle = "Unknown Video";
    let originalChannel = "Unknown Channel";
    let videoDuration = 0; // 🌟 NEW: We need to store the duration for the math!
    
    try {
        console.log(`[1/7] 🔎 Fetching original video metadata & duration...`);
        const response = await fetch(`https://www.youtube.com/oembed?url=${videoUrl}&format=json`);
        const data = await response.json();
        
        originalTitle = data.title || "Unknown Video";
        originalChannel = data.author_name || "Unknown Channel";
        console.log(`✅ Original Title: "${originalTitle}"`);

        // 🌟 NEW: Fetch total duration using yt-dlp to calculate exact parts! 🌟
        const { stdout } = await execPromise(`.\\yt-dlp.exe --print duration --cookies-from-browser edge "${videoUrl}"`);
        videoDuration = parseFloat(stdout.trim()) || 0;
        console.log(`✅ Video Duration: ${videoDuration} seconds`);
        
    } catch (err) {
        console.log(`⚠️ Metadata Error: ${err.message}`);
    }

    const safeTitle = originalTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
    const folderName = `${Date.now()}-${safeTitle || 'video'}-${mode}`;
    const jobFolder = path.join(downloadsDir, folderName);
    
    fs.mkdirSync(jobFolder, { recursive: true });
    console.log(`📁 Created Job Folder: /downloads/${folderName}`);

    const outputPath = path.join(jobFolder, 'original_source.mp4');
    
    console.log(`\n[2/7] 📥 Downloading High-Res Video & Audio...`);
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
        if (code !== 0) return console.log(`\n❌ Download failed code ${code}`);
        console.log(`✅ High-Res Download Complete!`);

        // ==========================================
        // OPTION 2: PART VIDEO (THE NEW MATH LOGIC)
        // ==========================================
        if (mode === 'split') {
            let timePerChunk = parseInt(chunkDuration) || 60;
            let expectedParts = 0;
            
            // 🌟 THE MATH LOGIC: Divide total time by the number of parts requested!
            if (partsCount && parseInt(partsCount) > 0 && videoDuration > 0) {
                expectedParts = parseInt(partsCount);
                timePerChunk = videoDuration / expectedParts;
                console.log(`\n✂️ Splitting video into exactly ${expectedParts} parts (~${timePerChunk.toFixed(1)}s each)...`);
            } else {
                expectedParts = videoDuration > 0 ? Math.ceil(videoDuration / timePerChunk) : 5;
                console.log(`\n✂️ Splitting video into ${timePerChunk}-second parts...`);
            }
            
            const outputPattern = path.join(jobFolder, 'part_%03d.mp4');

            ffmpeg(outputPath)
                .outputOptions([
                    '-c copy', 
                    '-map 0', 
                    '-segment_time', timePerChunk.toString(), 
                    '-f', 'segment', 
                    '-reset_timestamps', '1'
                ])
                .output(outputPattern)
                .on('end', () => {
                    // Generate dynamic metadata for the exact number of parts created
                    const metadataPath = path.join(jobFolder, 'metadata.txt');
                    let splitMetadata = `Original Video: ${originalTitle}\nChannel: ${originalChannel}\n\nSuggested Upload Format:\n`;
                    
                    for(let i = 1; i <= expectedParts; i++) {
                        splitMetadata += `Title: ${originalTitle} - Part ${i}\n`;
                    }
                    
                    fs.writeFileSync(metadataPath, splitMetadata);

                    console.log(`\n🔥 DONE! Video split perfectly!`);
                    console.log(`📂 Check your folder: /downloads/${folderName}/\n`);
                })
                .on('error', (err) => console.log("❌ FFmpeg Error: " + err.message))
                .run();
            return; 
        }

        // ==========================================
        // OPTION 1: SHORT VIDEO 
        // ==========================================
        if (mode === 'short') {
            const audioPath = path.join(jobFolder, 'audio.mp3');
            console.log(`\n[3/7] 🎵 Extracting Audio for AI Transcription...`);

            ffmpeg(outputPath).output(audioPath).noVideo().audioCodec('libmp3lame').on('end', async () => {
                console.log(`✅ Audio Extracted!`);
                
                try {
                    console.log(`\n[4/7] 🧠 AI is transcribing the audio...`);
                    const transcription = await groq.audio.transcriptions.create({
                        file: fs.createReadStream(audioPath),
                        model: "whisper-large-v3",
                        response_format: "verbose_json",
                    });
                    
                    console.log(`✅ Transcription Complete!`);

                    console.log(`\n[5/7] ✂️ BRAIN 1 (70B Model): Editor is scanning for the best dynamic hook...`);
                    
                    let editorPrompt = `You are a master video editor. Find ONE highly engaging standalone scene or joke from this transcript. 
It can be anywhere from 10 to 60 seconds long. 
CRITICAL RULES:
1. Start and end at natural conversational boundaries (the beginning and end of a specific topic).
2. Do NOT cut people off mid-sentence.
3. Do NOT merge two completely different scenes or unrelated topics together.
Output ONLY a flat JSON object: {"start_time": 10.5, "end_time": 25.2}. If the text is totally boring, output: {"boring": true}`;

                    const CHUNK_SIZE = 40; 
                    const chunks = [];
                    for (let i = 0; i < transcription.segments.length; i += CHUNK_SIZE) {
                        const chunkSegments = transcription.segments.slice(i, i + CHUNK_SIZE);
                        const chunkText = chunkSegments.map(s => `[${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s]: ${s.text}`).join('\n');
                        chunks.push(chunkText);
                    }

                    let finalHook = null;

                    for (let i = 0; i < chunks.length; i++) {
                        console.log(`   👉 Scanning Part ${i + 1} of ${chunks.length}...`);
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
                                console.log(`   🌟 Viral Hook Found starting at ${finalHook.start_time ?? finalHook.start}s!`);
                                break; 
                            }
                        } catch (err) {
                            console.log(`   ⚠️ API Limit hit on Part ${i + 1}. Retrying next...`);
                        }
                        if (i < chunks.length - 1 && !finalHook) await sleep(20000);
                    }

                    if (!finalHook || (!finalHook.start_time && !finalHook.startTime && !finalHook.start)) {
                        console.log(`\n⚠️ Brain 1 couldn't decide. Defaulting to first 30 seconds.`);
                        finalHook = { start_time: 0, end_time: 30 };
                    }

                    const start = finalHook.start_time ?? finalHook.startTime ?? finalHook.start;
                    let end = finalHook.end_time ?? finalHook.endTime ?? finalHook.end;
                    let duration = parseFloat(end) - parseFloat(start);

                    if (duration < 10) { 
                        end = parseFloat(start) + 15; 
                        duration = 15; 
                    } else if (duration > 75) { 
                        end = parseFloat(start) + 60; 
                        duration = 60; 
                    }

                    const clipSegments = transcription.segments.filter(s => s.end >= start && s.start <= end);
                    const clipText = clipSegments.map(s => s.text).join(' ');

                    console.log(`\n[6/7] 📈 BRAIN 2 (70B SEO Model): Analyzing script for viral hashtags...`);

                    let seoPrompt = `You are a Gen-Z TikTok and YouTube Shorts viral SEO marketer. `;
                    
                    if (niche && subNiche) {
                        const specificTopic = subNiche === 'Other' ? customPrompt : subNiche;
                        seoPrompt += `Your account specializes in the '${niche}' niche, focusing heavily on '${specificTopic}'. Use trending tags for this niche. `;
                        
                        if (niche === 'Movies & Series') {
                            seoPrompt += `CRITICAL: Because your niche is 'Movies & Series', you MUST include tags related to television shows, movies, and entertainment (e.g., #tvshow, #moviescene). Try to guess the actual name of the show based on the context and include it as a hashtag! `;
                        }
                    }

                    seoPrompt += `
Context to help you understand what is happening:
- Original YouTube Title: "${originalTitle}"
- Uploaded by Channel: "${originalChannel}"

Below is the exact script of the short clip we just cut.

Write a highly viral, click-worthy title and 5 trending hashtags based ONLY on what is said in this script.

CRITICAL RULES:
1. BAN THE CRINGE: NEVER use colons (:). NEVER use Title Case.
2. TIKTOK VOICE: Write like a 20-year-old leaving a casual text. Use lowercase. Use ONE emoji max (💀, 😭, 🤯, 🔥).
3. SMART SEO: Use specific, trending, hyper-relevant tags based on the script and your assigned niche.

OUTPUT ONLY JSON:
{"title": "your lowercase title here 💀", "hashtags": "#fyp #specifictag #trending"}
`;

                    let title = "viral clip 💀";
                    let hashtags = "#fyp #viral";

                    try {
                        const seoResponse = await groq.chat.completions.create({
                            model: "llama-3.3-70b-versatile",
                            messages: [ 
                                { role: "system", content: seoPrompt },
                                { role: "user", content: `Please generate the title and hashtags for this script:\n\n${clipText}` } 
                            ],
                            response_format: { type: "json_object" }
                        });
                        
                        const seoData = JSON.parse(seoResponse.choices[0].message.content);
                        title = seoData.title || title;
                        hashtags = seoData.hashtags || hashtags;
                    } catch (seoErr) {
                        console.log(`⚠️ Brain 2 (70B) Error: ${seoErr.message}`);
                    }
                    
                    console.log(`\n========================================`);
                    console.log(`🎉 VIRAL METADATA GENERATED BY 70B AI!`);
                    console.log(`📝 TikTok Title: ${title}`);
                    console.log(`🏷️ Tags:  ${hashtags}`);
                    console.log(`========================================\n`);

                    const metadataPath = path.join(jobFolder, 'metadata.txt');
                    fs.writeFileSync(metadataPath, `Original Video: ${originalTitle}\nChannel: ${originalChannel}\nTikTok Title: ${title}\nHashtags: ${hashtags}\nClip Duration: ${duration.toFixed(1)} seconds`);

                    console.log(`[7/7] ✂️ Cutting & Cropping Vertical Video: ${start}s to ${end}s...`);

                    const finalVideoPath = path.join(jobFolder, 'final_ai_short.mp4');

                    ffmpeg(outputPath)
                        .setStartTime(start)
                        .setDuration(duration)
                        .videoFilters([{ filter: 'crop', options: 'ih*(9/16):ih' }])
                        .output(finalVideoPath)
                        .on('end', () => {
                            console.log(`\n🔥 DONE! High-Res AI short saved!`);
                            console.log(`📂 Check your folder: /downloads/${folderName}/\n`);
                        })
                        .on('error', (err) => console.log("❌ FFmpeg Error: " + err.message))
                        .run();

                } catch (err) { 
                    console.error("\n❌ Fatal AI Error:", err.message); 
                }
            }).run();
        }
    });
});

app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));