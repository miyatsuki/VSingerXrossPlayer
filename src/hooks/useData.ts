import { useState, useEffect } from 'react';
import { fetchVideos } from '../api/client';
import { Category, Singer, Song, AIStats } from '../types';

// --- Master Data Definitions (for AI stats etc.) ---

// 1. Singers (with AI characteristics)
const baseSingers: Singer[] = [
	{
		id: '1',
		name: 'Hoshimachi Suisei',
		avatar_url: 'https://yt3.googleusercontent.com/ytc/AIdro_k-9-9-9-9-9-9-9-9-9-9-9=s176-c-k-c0x00ffffff-no-rj',
		ai_characteristics: { energy: 90, mood: 80, vocal: 95, instrumental: 60 }
	},
	{
		id: '2',
		name: 'Ado',
		avatar_url: 'https://yt3.googleusercontent.com/ytc/AIdro_k-9-9-9-9-9-9-9-9-9-9-9=s176-c-k-c0x00ffffff-no-rj',
		ai_characteristics: { energy: 95, mood: 40, vocal: 98, instrumental: 70 }
	},
	{
		id: '3',
		name: 'Kaf',
		avatar_url: 'https://yt3.googleusercontent.com/ytc/AIdro_k-9-9-9-9-9-9-9-9-9-9-9=s176-c-k-c0x00ffffff-no-rj',
		ai_characteristics: { energy: 60, mood: 90, vocal: 92, instrumental: 80 }
	}
];

// 2. Song Averages (Master Data for Comparison)
const songAverages: Record<string, AIStats> = {
	'Stellar Stellar': { energy: 80, mood: 75, vocal: 85, instrumental: 75 },
	'Usseewa': { energy: 90, mood: 30, vocal: 90, instrumental: 80 },
	'Phony': { energy: 70, mood: 60, vocal: 80, instrumental: 70 },
};

// 3. Reference Songs (AI stats per cover, for enrichment)
const referenceSongs: Song[] = [
	// Suisei's Songs
	{
		id: '101',
		title: 'Stellar Stellar',
		video_url: 'a51VH9BYzZA',
		singer_id: '1',
		ai_stats: { energy: 95, mood: 80, vocal: 98, instrumental: 80 },
		average_stats: songAverages['Stellar Stellar']
	},
	{
		id: '103',
		title: 'Phony',
		video_url: '9d5s9h2d',
		singer_id: '1',
		ai_stats: { energy: 75, mood: 65, vocal: 90, instrumental: 70 },
		average_stats: songAverages['Phony']
	},

	// Ado's Songs
	{
		id: '102',
		title: 'Usseewa',
		video_url: 'Qp3b-RXtz4w',
		singer_id: '2',
		ai_stats: { energy: 98, mood: 20, vocal: 95, instrumental: 85 },
		average_stats: songAverages['Usseewa']
	},

	// Kaf's Songs
	{
		id: '104',
		title: 'Phony',
		video_url: 'mock_kaf_phony',
		singer_id: '3',
		ai_stats: { energy: 65, mood: 85, vocal: 88, instrumental: 70 },
		average_stats: songAverages['Phony']
	}
];

const buildDataFromBackend = async (): Promise<{
	songs: Song[];
	singers: Singer[];
}> => {
	const apiVideos = await fetchVideos();

	if (!apiVideos.length) {
		return { songs: referenceSongs, singers: baseSingers };
	}

	const singerByName = new Map<string, Singer>();
	baseSingers.forEach(s => singerByName.set(s.name, s));

	const songs: Song[] = [];

	for (const v of apiVideos) {
		const songTitle = v.song_title || v.video_title;
		const youtubeId = v.video_id;
		const primarySingerName = (v.singers && v.singers.length > 0) ? v.singers[0] : 'Unknown';

		let singer = singerByName.get(primarySingerName);
		if (!singer) {
			singer = {
				id: primarySingerName,
				name: primarySingerName,
				avatar_url: '',
			};
			singerByName.set(primarySingerName, singer);
		}

		const ref = referenceSongs.find(refSong => {
			const refSinger = baseSingers.find(s => s.id === refSong.singer_id);
			return refSong.title === songTitle && refSinger?.name === primarySingerName;
		});

		const song: Song = {
			id: youtubeId,
			title: songTitle,
			video_url: youtubeId,
			singer_id: singer.id,
			ai_stats: ref?.ai_stats,
			average_stats: ref?.average_stats || songAverages[songTitle],
			published_at: v.published_at,
		};

		songs.push(song);
	}

	return { songs, singers: Array.from(singerByName.values()) };
};

export const useData = () => {
	const [songCategories, setSongCategories] = useState<Category[]>([]);
	const [singerCategories, setSingerCategories] = useState<Category[]>([]);
	const [singers, setSingers] = useState<Singer[]>(baseSingers);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);

			let songs: Song[] = referenceSongs;
			let singersList: Singer[] = baseSingers;

			try {
				const result = await buildDataFromBackend();
				songs = result.songs;
				singersList = result.singers;
			} catch (e) {
				console.error('Failed to load data from backend, falling back to reference data', e);
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
						singer_avatar: singer?.avatar_url
					};
				});
				return {
					id: `cat_song_${title}`,
					title: title,
					items: items,
					type: 'songs',
					icon: '🎵'
				};
			});

			// --- Mode B: Group by Singer ---
			const singersData: Category[] = singersList.map(singer => {
				const singerSongs = songs.filter(s => s.singer_id === singer.id);
				const items = singerSongs.map(s => ({
					...s,
					singer_name: singer.name,
					singer_avatar: singer.avatar_url
				}));

				return {
					id: `cat_singer_${singer.id}`,
					title: singer.name,
					avatar_url: singer.avatar_url,
					items: items,
					type: 'songs'
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
