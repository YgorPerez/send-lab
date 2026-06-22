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
		authors: 'Keith Baar et al.',
		year: '2017',
		url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Baar+collagen+gelatin+tendon+load',
	},
	{
		id: 'lopez',
		authors: 'Eva López-Rivera & González-Badillo',
		year: '2019',
		url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Lopez-Rivera+hangboard+finger+strength+climbing',
	},
	{
		id: 'horst',
		authors: 'Eric Hörst (Training for Climbing)',
		year: '—',
		url: 'https://trainingforclimbing.com',
	},
	{
		id: 'lattice',
		authors: 'Lattice Training / Hooper & Bechtel',
		year: '—',
		url: 'https://latticetraining.com',
	},
	{
		id: 'nelson',
		authors: 'Tyler Nelson (Camp4 Human Performance)',
		year: '—',
		url: 'https://www.camp4humanperformance.com',
	},
	{
		id: 'ferrer',
		authors: 'Ferrer-Uris et al.',
		year: '2023',
		url: 'https://pubmed.ncbi.nlm.nih.gov/?term=sloper+grip+forearm+activation+climbing',
	},
];
