const srt = `1\r\n00:00:01,000 --> 00:00:04,500\r\nHello World\r\n\r\n2\r\n00:00:05,000 --> 00:00:06,000\r\nSecond subtitle`;

function parseSrtToSegments(srt) {
    const blocks = srt.trim().split(/\n\s*\n/);
    const segments = [];
    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length >= 3) {
            const timeLineIndex = lines.findIndex(l => l.includes('-->') || l.includes('->'));
            if (timeLineIndex !== -1) {
                const timeStr = lines[timeLineIndex];
                if (!timeStr) continue;
                const text = lines.slice(timeLineIndex + 1).join(' ').trim();
                const [startStr, endStr] = timeStr.split(/--?>/);
                const parseTime = (t) => {
                    if (!t) return 0;
                    const parts = t.trim().split(':');
                    if (parts.length !== 3) return 0;
                    const secMs = parts[2];
                    if (!secMs) return 0;
                    const [sec, ms] = (secMs.includes(',') ? secMs.split(',') : secMs.split('.'));
                    return parseFloat(parts[0] || '0') * 3600 + parseFloat(parts[1] || '0') * 60 + parseFloat(sec || '0') + (parseFloat(ms || '0') / 1000);
                };
                if (startStr && endStr && text) {
                    try {
                        segments.push({
                            text,
                            start: parseTime(startStr),
                            end: parseTime(endStr)
                        });
                    } catch (err) { }
                }
            }
        }
    }
    return segments;
}

console.log(parseSrtToSegments(srt));
