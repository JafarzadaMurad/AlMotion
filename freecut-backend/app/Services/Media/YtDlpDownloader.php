<?php

namespace App\Services\Media;

use RuntimeException;
use Symfony\Component\Process\Process;

/**
 * Thin wrapper around the yt-dlp binary. We use it for any URL — yt-dlp
 * gracefully handles direct HTTP file URLs as well as YouTube / TikTok /
 * Instagram / generic-extractor URLs, so callers don't have to branch.
 *
 * Binary expected at /opt/almotion/bin/yt-dlp (configurable via the
 * YTDLP_PATH env var). Install on the server with:
 *   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /opt/almotion/bin/yt-dlp
 *   sudo chmod +x /opt/almotion/bin/yt-dlp
 */
class YtDlpDownloader
{
    /**
     * Download $url into $outputDir. Returns metadata about the saved file.
     *
     * @return array{path: string, filename: string, size_bytes: int, title: ?string, duration_seconds: ?float}
     */
    public function download(string $url, string $outputDir): array
    {
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        $binary = env('YTDLP_PATH', '/opt/almotion/bin/yt-dlp');
        if (!is_executable($binary)) {
            throw new RuntimeException("yt-dlp binary not found or not executable at {$binary}");
        }

        // -o template uses the upload's title + extension; --print-json gives
        // us the metadata after the download finishes so we can locate the
        // saved file without scanning the directory.
        $outputTemplate = $outputDir . DIRECTORY_SEPARATOR . '%(title).80s-%(id)s.%(ext)s';
        $process = new Process([
            $binary,
            '--no-playlist',
            '--no-warnings',
            '--no-progress',
            '--restrict-filenames',
            '-f', 'best[ext=mp4]/best',
            '-o', $outputTemplate,
            '--print-json',
            '--',
            $url,
        ]);
        $process->setTimeout(300);
        $process->run();

        if (!$process->isSuccessful()) {
            throw new RuntimeException(
                'yt-dlp failed: ' . trim($process->getErrorOutput() ?: $process->getOutput()),
            );
        }

        $stdout = trim($process->getOutput());
        // yt-dlp can print multiple json lines (one per video in a list); we
        // forced --no-playlist so we take the first.
        $firstLine = strtok($stdout, "\n") ?: '';
        $meta = json_decode($firstLine, true);
        if (!is_array($meta)) {
            throw new RuntimeException('yt-dlp returned non-JSON output: ' . substr($stdout, 0, 200));
        }

        $path = $meta['_filename'] ?? null;
        if (!$path || !is_file($path)) {
            // Older yt-dlp versions put the saved path under `requested_downloads`.
            $path = $meta['requested_downloads'][0]['filepath']
                ?? $meta['filepath']
                ?? null;
        }
        if (!$path || !is_file($path)) {
            throw new RuntimeException('Downloaded file missing from disk after yt-dlp claimed success.');
        }

        return [
            'path' => $path,
            'filename' => basename($path),
            'size_bytes' => filesize($path) ?: 0,
            'title' => $meta['title'] ?? null,
            'duration_seconds' => isset($meta['duration']) ? (float) $meta['duration'] : null,
        ];
    }
}
