export interface PexelsVideo {
    id: number;
    width: number;
    height: number;
    url: string;
    image: string;
    duration: number;
    video_files: Array<{
        id: number;
        quality: 'hd' | 'sd';
        file_type: string;
        width: number;
        height: number;
        link: string;
    }>;
}

export interface PexelsSearchResponse {
    page: number;
    per_page: number;
    total_results: number;
    url: string;
    videos: PexelsVideo[];
}

export class PexelsService {
    private static readonly API_URL = 'https://api.pexels.com/videos/search';

    constructor(private apiKey: string) { }

    async searchVideos(query: string, perPage: number = 5, orientation?: 'landscape' | 'portrait' | 'square', page: number = 1): Promise<PexelsSearchResponse> {
        let url = `${PexelsService.API_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
        if (orientation) {
            url += `&orientation=${orientation}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': this.apiKey,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Pexels API error');
        }

        return response.json();
    }
}
