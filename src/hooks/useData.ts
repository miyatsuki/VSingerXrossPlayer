import { useState, useEffect } from 'react';
import { Category, Singer, Song, AIStats } from '../types';

// --- Mock Data Definitions ---

// 1. Singers
const singers: Singer[] = [
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

// 3. Songs (Specific Performances)
const songs: Song[] = [
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

export const useData = () => {
	const [categories, setCategories] = useState<Category[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			await new Promise(resolve => setTimeout(resolve, 500));

			// Transform Data: Group by Song Title
			// Get unique song titles
			const uniqueTitles = Array.from(new Set(songs.map(s => s.title)));

			const newCategories: Category[] = uniqueTitles.map(title => {
				// Find all covers of this song
				const covers = songs.filter(s => s.title === title);

				// Enrich covers with Singer data for display
				const items = covers.map(cover => {
					const singer = singers.find(s => s.id === cover.singer_id);
					return {
						...cover,
						// We can attach the singer object or name to the cover for easy access in the UI
						singer_name: singer?.name,
						singer_avatar: singer?.avatar_url
					};
				});

				return {
					id: `cat_${title}`,
					title: title,
					items: items,
					type: 'songs',
					icon: '🎵' // Default icon for songs
				};
			});

			// Add a Settings category at the end
			newCategories.push({
				id: 'cat_settings',
				title: 'Settings',
				items: [],
				type: 'settings',
				icon: '⚙️'
			});

			setCategories(newCategories);
			setLoading(false);
		};

		loadData();
	}, []);

	return { categories, loading };
};
