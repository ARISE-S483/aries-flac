export const config = {
    matcher: [
        '/track/:id*',
        '/album/:id*',
        '/artist/:id*',
        '/playlist/:id*',
        '/(.*)'
    ],
};

const _cr = [
    'emVl', // zee
    'em1j', // zmc
    'emluZyBtdXNpYw==', // zing music
    'ZXRjIGJvbGx5d29vZA==', // etc bollywood
    'Ym9sbHl3b29kIG11c2lj', // bollywood music
    'ZXNzZWw=', // essel
    'emluZGFnaQ==', // zindagi
].map(atob);

const _isBlockedCopyright = (c) => {
    const text = typeof c === 'string' ? c : c?.text;
    return !!text && _cr.some((s) => text.toLowerCase().includes(s));
};

class TidalAPI {
    static CLIENT_ID = 'txNoH4kkV41MfH25';
    static CLIENT_SECRET = 'dQjy0MinCEvxi1O4UmxvxWnDjt4cgHBPw8ll6nYBk98=';

    async getToken() {
        const params = new URLSearchParams({
            client_id: TidalAPI.CLIENT_ID,
            client_secret: TidalAPI.CLIENT_SECRET,
            grant_type: 'client_credentials',
        });
        const res = await fetch('https://auth.tidal.com/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' + btoa(`${TidalAPI.CLIENT_ID}:${TidalAPI.CLIENT_SECRET}`),
            },
            body: params,
        });
        if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
        const data = await res.json();
        return data.access_token;
    }

    async fetchJson(url, params = {}) {
        const token = await this.getToken();
        const u = new URL(url);
        Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
        const finalUrl = u.toString().replace('//api.tidal.com', '//td.if-it-runs-ship-it.lol/api');
        const res = await fetch(finalUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Tidal API error: ${res.status}`);
        return res.json();
    }

    async getTrackMetadata(id) {
        return await this.fetchJson(`https://api.tidal.com/v1/tracks/${id}/`, { countryCode: 'US' });
    }

    async getAlbumMetadata(id) {
        return await this.fetchJson(`https://api.tidal.com/v1/albums/${id}`, { countryCode: 'US' });
    }

    async getArtistMetadata(id) {
        return await this.fetchJson(`https://api.tidal.com/v1/artists/${id}`, { countryCode: 'US' });
    }

    async getPlaylistMetadata(id) {
        return await this.fetchJson(`https://api.tidal.com/v1/playlists/${id}`, { countryCode: 'US' });
    }

    async getStreamUrl(id) {
        const data = await this.fetchJson(`https://api.tidal.com/v1/tracks/${id}/playbackinfo`, {
            audioquality: 'LOW',
            playbackmode: 'STREAM',
            assetpresentation: 'FULL',
            countryCode: 'US',
        });
        return data.url || data.streamUrl;
    }

    getCoverUrl(id, size = '1280') {
        if (!id) return '';
        const formattedId = String(id).replace(/-/g, '/');
        return `https://resources.tidal.com/images/${formattedId}/${size}x${size}.jpg`;
    }
}

export default async function middleware(request) {
    const userAgent = request.headers.get('User-Agent') || '';
    const isBot =
        /discordbot|twitterbot|facebookexternalhit|bingbot|googlebot|slurp|whatsapp|pinterest|slackbot|telegrambot|linkedinbot|mastodon|signal|snapchat|redditbot|skypeuripreview|viberbot|linebot|embedly|quora|outbrain|tumblr|duckduckbot|yandexbot|rogerbot|showyoubot|kakaotalk|naverbot|seznambot|mediapartners|adsbot|petalbot|applebot|ia_archiver/i.test(
            userAgent
        );

    // If not a bot, let Vercel handle the request normally
    if (!isBot) {
        return new Response(null, { headers: { 'x-middleware-next': '1' } });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const type = pathParts[0];
    const id = pathParts[1];

    if (!['track', 'album', 'artist', 'playlist'].includes(type) || !id) {
        return new Response(null, { headers: { 'x-middleware-next': '1' } });
    }

    let api = new TidalAPI();
    let metaHtml = '';

    try {
        if (type === 'track') {
            const track = await api.getTrackMetadata(id);
            if (track && _isBlockedCopyright(track.copyright)) {
                return new Response('This content was removed due to a DMCA notice.', { status: 200 });
            }
            if (track) {
                const title = track?.version ? `${track.title} (${track.version})` : track.title;
                const artist = track?.artists?.length ? track.artists.map((a) => a?.name).join(', ') : 'Unknown Artist';
                const description = `${artist} - ${track.album.title}`;
                const imageUrl = api.getCoverUrl(track.album.cover, '1280');
                
                let audioUrl = track.previewUrl || track.previewURL;
                if (!audioUrl) {
                    try { audioUrl = await api.getStreamUrl(id); } catch(e) {}
                }
                
                const audioMeta = audioUrl ? `
                    <meta property="og:audio" content="${audioUrl}">
                    <meta property="og:audio:type" content="audio/mp4">
                    <meta property="og:video" content="${audioUrl}">
                    <meta property="og:video:type" content="audio/mp4">
                ` : '';

                metaHtml = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <title>${title} by ${artist}</title>
                        <meta name="description" content="${description}">
                        <meta property="og:title" content="${title}">
                        <meta property="og:description" content="${description}">
                        <meta property="og:image" content="${imageUrl}">
                        <meta property="og:type" content="music.song">
                        <meta property="og:url" content="${url.href}">
                        <meta property="music:duration" content="${track.duration}">
                        <meta property="music:album" content="${track.album.title}">
                        <meta property="music:musician" content="${artist}">
                        ${audioMeta}
                        <meta name="twitter:card" content="summary_large_image">
                        <meta name="twitter:title" content="${title}">
                        <meta name="twitter:description" content="${description}">
                        <meta name="twitter:image" content="${imageUrl}">
                        <meta name="theme-color" content="#000000">
                    </head>
                    <body><h1>${title}</h1><p>by ${artist}</p></body>
                    </html>
                `;
            }
        } else if (type === 'album') {
            const album = await api.getAlbumMetadata(id);
            if (album && _isBlockedCopyright(album.copyright)) {
                return new Response('This content was removed due to a DMCA notice.', { status: 200 });
            }
            if (album && (album.title || album.name)) {
                const title = album.title || album.name;
                const artist = album.artist?.name || 'Unknown Artist';
                const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';
                const trackCount = album.numberOfTracks || 0;
                const description = `Album by ${artist} • ${year} • ${trackCount} Tracks\nListen on Monochrome`;
                const imageUrl = album.cover ? api.getCoverUrl(album.cover, '1280') : '';

                metaHtml = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <title>${title}</title>
                        <meta name="description" content="${description}">
                        <meta property="og:title" content="${title}">
                        <meta property="og:description" content="${description}">
                        <meta property="og:image" content="${imageUrl}">
                        <meta property="og:type" content="music.album">
                        <meta property="og:url" content="${url.href}">
                        <meta property="music:musician" content="${artist}">
                        <meta name="twitter:card" content="summary_large_image">
                    </head>
                    <body><h1>${title}</h1><p>${description}</p></body>
                    </html>
                `;
            }
        } else if (type === 'playlist') {
            const playlist = await api.getPlaylistMetadata(id);
            if (playlist && (playlist.title || playlist.name)) {
                const title = playlist.title || playlist.name;
                const description = `Playlist • ${playlist.numberOfTracks || 0} Tracks\nListen on Monochrome`;
                const imageId = playlist.squareImage || playlist.image;
                const imageUrl = imageId ? api.getCoverUrl(imageId, '1080') : '';

                metaHtml = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <title>${title}</title>
                        <meta name="description" content="${description}">
                        <meta property="og:title" content="${title}">
                        <meta property="og:description" content="${description}">
                        <meta property="og:image" content="${imageUrl}">
                        <meta property="og:type" content="music.playlist">
                        <meta property="og:url" content="${url.href}">
                        <meta name="twitter:card" content="summary_large_image">
                    </head>
                    <body><h1>${title}</h1><p>${description}</p></body>
                    </html>
                `;
            }
        } else if (type === 'artist') {
            const artist = await api.getArtistMetadata(id);
            if (artist && (artist.name || artist.title)) {
                const title = artist.name || artist.title;
                const description = `Artist on Monochrome`;
                const imageId = artist.picture || artist.image;
                const imageUrl = imageId ? api.getCoverUrl(imageId, '750') : '';

                metaHtml = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <title>${title}</title>
                        <meta name="description" content="${description}">
                        <meta property="og:title" content="${title}">
                        <meta property="og:description" content="${description}">
                        <meta property="og:image" content="${imageUrl}">
                        <meta property="og:type" content="profile">
                        <meta property="og:url" content="${url.href}">
                        <meta name="twitter:card" content="summary_large_image">
                    </head>
                    <body><h1>${title}</h1><p>${description}</p></body>
                    </html>
                `;
            }
        }
    } catch (e) {
        console.error(`Metadata error for ${type} ${id}:`, e);
    }

    if (metaHtml) {
        return new Response(metaHtml, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
    }

    return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
