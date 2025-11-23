import { useState, useEffect } from 'react';
import { fetchVideos, fetchSingers } from '../api/client';
import { Category, Singer, Song } from '../types';

const buildDataFromBackend = async (): Promise<{
	songs: Song[];
	singers: Singer[];
}> => {
	const [apiVideos, apiSingers] = await Promise.all([
		fetchVideos(),
		fetchSingers(),
	]);

	// Build singer map from /singers endpoint
	const singerMap = new Map<string, Singer>();
	apiSingers.forEach(s => {
		singerMap.set(s.name, {
			id: s.name,
			name: s.name,
			avatar_url: '', // No avatar in API, could be added later
		});
	});

	// Ensure all singers from videos exist in our map
	const ensureSinger = (name: string): Singer => {
		if (singerMap.has(name)) {
			return singerMap.get(name)!;
		}
		const newSinger: Singer = {
			id: name,
			name,
			avatar_url: '',
		};
		singerMap.set(name, newSinger);
		return newSinger;
	};

	// Convert API videos to songs
	const songs: Song[] = apiVideos.map(v => {
		const songTitle = v.song_title || v.video_title;
		const youtubeId = v.video_id;
		const primarySingerName =
			v.singers && v.singers.length > 0 ? v.singers[0] : 'Unknown';

		const singer = ensureSinger(primarySingerName);

		return {
			id: youtubeId,
			title: songTitle,
			video_url: youtubeId,
			singer_id: singer.id,
			published_at: v.published_at,
		};
	});

	const singers = Array.from(singerMap.values());

	return { songs, singers };
};

export const useData = () => {
	const [songCategories, setSongCategories] = useState<Category[]>([]);
	const [singerCategories, setSingerCategories] = useState<Category[]>([]);
	const [singers, setSingers] = useState<Singer[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);

			let songs: Song[] = [];
			let singersList: Singer[] = [];

			try {
				const result = await buildDataFromBackend();
				songs = result.songs;
				singersList = result.singers;
			} catch (e) {
				console.error('Failed to load data from backend', e);
				setLoading(false);
				return;
			}

			// --- Mode A: Group by Song Title ---
			const uniqueTitles = Array.from(new Set(songs.map(s => s.title)));
			const songsData: Category[] = uniqueTitles.map(title => {
				const covers = songs.filter(s => s.title === title);
				const items = covers.map(cover => {
					const singer = singersList.find(s => s.id === cover.singer_id);
					return {
						...cover,
						singer_name: singer?.name,
						singer_avatar: singer?.avatar_url,
					};
				});
				return {
					id: `cat_song_${title}`,
					title: title,
					items: items,
					type: 'songs',
					icon: '🎵',
				};
			});

			// --- Mode B: Group by Singer ---
			const singersData: Category[] = singersList.map(singer => {
				const singerSongs = songs.filter(s => s.singer_id === singer.id);
				const items = singerSongs.map(s => ({
					...s,
					singer_name: singer.name,
					singer_avatar: singer.avatar_url,
				}));

				return {
					id: `cat_singer_${singer.id}`,
					title: singer.name,
					avatar_url: singer.avatar_url,
					items: items,
					type: 'songs',
				};
			});

			setSongCategories(songsData);
			setSingerCategories(singersData);
			setSingers(singersList);
			setLoading(false);
		};

		loadData();
	}, []);

	return { songCategories, singerCategories, singers, loading };
};
