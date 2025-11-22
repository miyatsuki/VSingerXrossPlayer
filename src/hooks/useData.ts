import { useState, useEffect } from 'react';
import { fetchMasterData, fetchVideos } from '../api/client';
import { Category, Singer, Song, AIStats } from '../types';

const buildDataFromBackend = async (): Promise<{
	songs: Song[];
	singers: Singer[];
	songAverages: Record<string, AIStats>;
}> => {
	const [apiVideos, master] = await Promise.all([
		fetchVideos(),
		fetchMasterData(),
	]);

	let singers: Singer[] = master.singers.map(s => ({
		id: s.id,
		name: s.name,
		avatar_url: s.avatar_url,
		description: s.description,
		ai_characteristics: s.ai_characteristics,
	}));

	const songAverages: Record<string, AIStats> = master.song_averages;

	// fallback: if no videos, just return reference songs from master
	if (!apiVideos.length) {
		const songs: Song[] = master.reference_songs.map(rs => ({
			...rs,
		}));
		return { songs, singers, songAverages };
	}

	const singersById = new Map<string, Singer>();
	singers.forEach(s => singersById.set(s.id, s));

	// 同名の歌い手がマスタにない場合は追加
	const ensureSinger = (name: string): Singer => {
		// まずは名前で検索
		const existingByName = singers.find(s => s.name === name);
		if (existingByName) return existingByName;

		const s: Singer = {
			id: name,
			name,
			avatar_url: '',
		};
		singers.push(s);
		singersById.set(s.id, s);
		return s;
	};

	const songs: Song[] = apiVideos.map(v => {
		const songTitle = v.song_title || v.video_title;
		const youtubeId = v.video_id;
		const primarySingerName =
			v.singers && v.singers.length > 0 ? v.singers[0] : 'Unknown';

		const singer = ensureSinger(primarySingerName);

		// マスタ上の reference_songs から AI スタッツを引く
		const ref = master.reference_songs.find(
			refSong => refSong.title === songTitle && refSong.singer_id === singer.id,
		);

		const average =
			ref?.average_stats || songAverages[songTitle] || undefined;

		return {
			id: youtubeId,
			title: songTitle,
			video_url: youtubeId,
			singer_id: singer.id,
			ai_stats: ref?.ai_stats,
			average_stats: average,
			published_at: v.published_at,
		};
	});

	return { songs, singers, songAverages };
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
				console.error(
					'Failed to load data from backend, master data is unavailable',
					e,
				);
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
