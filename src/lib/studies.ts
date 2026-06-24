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
	{
		id: 'hooper',
		authors: 'Hooper & Mackinnon — Sports Medicine',
		year: '1995',
		url: 'https://pubmed.ncbi.nlm.nih.gov/8571005/',
	},
	{
		id: 'prs',
		authors: 'Laurent et al. — J Strength Cond Res',
		year: '2011',
		url: 'https://pubmed.ncbi.nlm.nih.gov/20581704/',
	},
	{
		id: 'sleep',
		authors: 'Fullagar et al. — Sports Medicine',
		year: '2015',
		url: 'https://link.springer.com/article/10.1007/s40279-014-0260-0',
	},
	{
		id: 'acwr',
		authors: 'Hulin, Gabbett et al. — Br J Sports Med',
		year: '2016',
		url: 'https://pubmed.ncbi.nlm.nih.gov/26511006/',
	},
	{
		id: 'ewma',
		authors: 'Williams, West, Kemp, Stokes et al. — Br J Sports Med',
		year: '2017',
		url: 'https://pubmed.ncbi.nlm.nih.gov/27789430/',
	},
	{
		id: 'foster',
		authors: 'Foster — Med Sci Sports Exerc',
		year: '1998',
		url: 'https://pubmed.ncbi.nlm.nih.gov/9662690/',
	},
	{
		id: 'illness',
		authors: 'Schwellnus et al. — IOC consensus, Br J Sports Med',
		year: '2016',
		url: 'https://pubmed.ncbi.nlm.nih.gov/27535991/',
	},
	{
		id: 'probe',
		authors: 'Claudino et al. — J Sci Med Sport',
		year: '2017',
		url: 'https://pubmed.ncbi.nlm.nih.gov/27765661/',
	},
];
