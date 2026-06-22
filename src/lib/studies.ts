// The research behind the protocols. Language-neutral metadata (authors, year,
// link); the title / summary / "what it informs" prose lives in messages, keyed
// by id. The auto-progression engine references these same ids as citations.
export interface Study {
	id: string;
	authors: string;
	year: string;
	/** A real, stable destination (paper, PubMed search, or the author's site). */
	url: string;
}

export const STUDIES: Study[] = [
	{
		id: 'baar',
		authors: 'Shaw, Lee-Barthel, Ross, Wang & Baar — Am J Clin Nutr',
		year: '2017',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5183725/',
	},
	{
		id: 'lopez',
		authors: 'López-Rivera & González-Badillo — J Sports Sci',
		year: '2019',
		url: 'https://pubmed.ncbi.nlm.nih.gov/30988852/',
	},
	{
		id: 'horst',
		authors: 'Eric Hörst — Training for Climbing',
		year: '—',
		url: 'https://trainingforclimbing.com',
	},
	{
		id: 'lattice',
		authors: 'Giles et al. (Lattice) — Eur J Appl Physiol',
		year: '2021',
		url: 'https://pubmed.ncbi.nlm.nih.gov/33647876/',
	},
	{
		id: 'nelson',
		authors: 'Tyler Nelson — Camp4 Human Performance',
		year: '—',
		url: 'https://www.camp4humanperformance.com',
	},
	{
		id: 'ferrer',
		authors: 'Ferrer-Uris et al. — PeerJ',
		year: '2023',
		url: 'https://peerj.com/articles/15464/',
	},
];
