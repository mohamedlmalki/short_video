import fs from 'fs';

const formatAssTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const cs = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
    return `${h}:${m}:${s}.${cs}`;
};

const getAssColor = (colorName) => {
    const colors = { "White": "&H00FFFFFF", "Yellow": "&H0000FFFF", "Red": "&H000000FF", "Cyan": "&H00FFFF00", "Green": "&H0000FF00" };
    return colors[colorName] || "&H0000FFFF";
};

export const generateAssFile = (transcription, outputPath, settings) => {
    const {
        subtitleFont = "Impact", subtitleFontSize = 70, subtitleColor = "Yellow", textBgStyle = "outline",
        forceUppercase = true, wordsPerScreen = "3",
        subtitleYPos = 380, titleFontSize = 90, titleYPos = 200, partFontSize = 130, partYPos = 150,
        topTitle = "", partNumber = "", videoDuration = 60
    } = settings;

    const highlightColor = getAssColor(subtitleColor);
    const baseColor = "&H00FFFFFF"; 
    const subSize = Math.round(subtitleFontSize * 1.2);

    let borderStyle = 1; let outline = 5; let shadow = 3; let backColor = "&H00000000";
    if (textBgStyle === "box") { borderStyle = 3; outline = 12; backColor = "&H99000000"; } 
    else if (textBgStyle === "shadow") { outline = 0; shadow = 8; }

    // 🚨 WrapStyle 2 ABSOLUTELY FORCES exactly 1 line. No multi-line word wrapping allowed. 🚨
    // I also reduced MarginL and MarginR from 40 to 15 so you have more horizontal space!
    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Subtitle,${subtitleFont},${subSize},${highlightColor},${baseColor},&H00000000,${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,15,15,${subtitleYPos},1
Style: TopTitle,${subtitleFont},${Math.round(titleFontSize * 1.2)},&H00FFFFFF,&H00FFFFFF,&H00000000,${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},8,40,40,${titleYPos},1
Style: PartNum,${subtitleFont},${Math.round(partFontSize * 1.2)},&H00FFFFFF,&H00FFFFFF,&H00000000,${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,40,40,${partYPos},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

    let events = "";
    const endVideoTime = formatAssTime(videoDuration);

    if (topTitle) events += `Dialogue: 0,0:00:00.00,${endVideoTime},TopTitle,,0,0,0,,${topTitle.toUpperCase()}\n`;
    if (partNumber) events += `Dialogue: 0,0:00:00.00,${endVideoTime},PartNum,,0,0,0,,${partNumber}\n`;

    if (!transcription || transcription.length === 0) {
        fs.writeFileSync(outputPath, header + events);
        return;
    }

    let chunks = [];
    let currentChunk = [];
    let maxWords = parseInt(wordsPerScreen) || 3;

    let cleanTranscript = transcription.map(w => {
        let start = parseFloat(w.start);
        let end = parseFloat(w.end);
        if (end - start > 0.8) start = Math.max(0, end - 0.4); 
        return { word: w.word || w.text || "", start, end };
    });

    for (let i = 0; i < cleanTranscript.length; i++) {
        currentChunk.push(cleanTranscript[i]);
        let nextWord = cleanTranscript[i + 1];
        let gap = nextWord ? nextWord.start - cleanTranscript[i].end : 0;

        if (currentChunk.length >= maxWords || gap > 0.4 || !nextWord) {
            chunks.push(currentChunk);
            currentChunk = [];
        }
    }

    chunks.forEach(chunk => {
        // 🌟 AUTO-SHRINK ALGORITHM 🌟
        // If the combined characters of the sentence are too long to fit on a 1080px screen, 
        // it dynamically shrinks the text instead of pushing it to a second line.
        let totalChars = chunk.reduce((sum, w) => sum + w.word.trim().length, 0) + (chunk.length - 1);
        let scale = 100;
        if (totalChars > 20) {
            scale = Math.floor((20 / totalChars) * 100);
        }

        for (let i = 0; i < chunk.length; i++) {
            let activeWord = chunk[i];
            let activeStart = activeWord.start;
            let activeEnd = (i < chunk.length - 1) ? chunk[i+1].start : chunk[chunk.length - 1].end + 0.15;
            
            if (activeEnd <= activeStart) activeEnd = activeStart + 0.05; 

            // Initialize the line with our custom scale forcefield
            let lineText = `{\\fscx${scale}\\fscy${scale}}`;
            
            for (let j = 0; j <= i; j++) {
                let w = chunk[j];
                let text = forceUppercase ? w.word.toUpperCase().trim() : w.word.trim();
                
                if (j === i) {
                    lineText += `{\\c${highlightColor}}${text}`;
                } else {
                    lineText += `{\\c${baseColor}}${text}`;
                }
                
                if (j < i) lineText += " ";
            }
            
            events += `Dialogue: 0,${formatAssTime(activeStart)},${formatAssTime(activeEnd)},Subtitle,,0,0,0,,${lineText}\n`;
        }
    });

    fs.writeFileSync(outputPath, header + events);
};