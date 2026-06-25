import type { LocaleContent } from './types';

const content: LocaleContent = {
	days: [
		{
			k: 'Mon',
			label: 'Seg',
			type: 'Limite / Potência',
			prime: 'Recruitment pulls → Boulder no limite',
			sec: 'Força de contato e RFD, depois os boulders mais duros',
			load: 'ALTO',
			color: 'var(--flag)',
			ex: ['recruit', 'limitboulder'],
		},
		{
			k: 'Tue',
			label: 'Ter',
			type: 'Pinça / Punho',
			prime: 'Pinch block + Punho / Sloper',
			sec: 'Abrahangs de manhã · antagonistas',
			load: 'MOD',
			color: 'var(--gold)',
			ex: ['pinch', 'wrist', 'abra', 'antag'],
		},
		{
			k: 'Wed',
			label: 'Qua',
			type: 'Resistência',
			prime: 'Repeaters 7/3 → Escalada esportiva',
			sec: 'Resistência de força, força crítica, pump',
			load: 'ALTO',
			color: 'var(--flag)',
			ex: ['repeaters', 'sport'],
		},
		{
			k: 'Thu',
			label: 'Qui',
			type: 'Puxada',
			prime: 'Dia de puxada pesada + Densidade em sloper',
			sec: 'Barras com peso, OAP · Abrahangs de manhã',
			load: 'MOD',
			color: 'var(--violet)',
			ex: ['pull', 'slopdens', 'abra', 'antag'],
		},
		{
			k: 'Fri',
			label: 'Sex',
			type: 'Máx / Tecido',
			prime: 'Max hangs (manutenção) + Densidade',
			sec: 'Investir no tecido, densidade da JMT',
			load: 'MOD',
			color: 'var(--teal)',
			ex: ['maxhang', 'density'],
		},
		{
			k: 'Sat',
			label: 'Sáb',
			type: 'Performance',
			prime: 'Rocha / Performance',
			sec: 'Hangboard = só aquecimento',
			load: 'ALTO',
			color: 'var(--flag)',
			ex: ['perform'],
		},
		{
			k: 'Sun',
			label: 'Dom',
			type: 'Descanso',
			prime: 'Descanso total',
			sec: 'Sem carga nos dedos · caminhada / mobilidade',
			load: 'FOLGA',
			color: 'var(--ink-faint)',
			ex: ['rest'],
		},
	],
	exercises: {
		recruit: {
			name: 'Recruitment Pulls',
			cat: 'RFD / Contato',
			variants: [
				{
					name: 'Hangboard · 1 braço ~20mm',
					what: '1 braço · régua ~20mm ou reta',
					note: 'Puxada máxima rápida e explosiva.',
					why: [
						'O estímulo de dedo de maior retorno pra quem já é forte — treina a <b>taxa de desenvolvimento de força</b> e a força de contato com pouquíssima fadiga.',
						'Tyler Nelson: em nível alto, vale mais a <b>aplicação</b> da força do que mais força máxima.',
					],
				},
				{
					name: 'Toques máximos controlados no campus',
					what: 'Toques máximos controlados',
					note: 'Toques precisos até uma régua fixa — descanso completo, qualidade e não campus desleixado.',
					why: [
						'Mesma intenção de recruitment com uma pegada controlada — qualidade, não campus desleixado.',
					],
				},
				{
					name: 'Levantamento de 1 braço no Lattice-block',
					what: 'Levantada de 1 braço no block · ~20mm',
					note: 'Levantada quase máxima de 1 braço no block.',
					why: [
						'Levantadas medidas por aparelho carregam com precisão e dão pra acompanhar a força de contato.',
					],
				},
				{
					name: 'Tentativas pesadas do primeiro movimento',
					what: 'Primeiros movimentos duros, do chão',
					note: 'Tentativas máximas repetidas num primeiro movimento duro · descanso completo.',
					why: [
						'Recruitment expresso em agarras reais — puxadas máximas num único movimento duro.',
					],
				},
			],
		},
		limitboulder: {
			name: 'Boulder no Limite',
			cat: 'Potência / Técnica',
			variants: [
				{
					name: 'Os mais duros · descansos longos',
					what: 'Os boulders mais duros · descansos longos',
					note: 'Priorize movimentos de crimpa / contato. Qualidade acima de quantidade.',
					why: [
						'Onde a força vira escalada. Qualidade acima de quantidade — descanse por completo entre as tentativas.',
					],
				},
				{
					name: 'Problemas no limite no Moonboard / Kilter',
					what: 'Problemas no limite na board',
					note: 'Benchmarks de crimpa na board.',
					why: ['Agarras padronizadas tornam a potência no limite repetível e mensurável.'],
				},
				{
					name: 'Boulders de potência tipo 4×4',
					what: 'Circuitos de potência no limite',
					note: 'Descanso curto dentro, longo entre rodadas — toque de potência-resistência no limite.',
					why: ['Adiciona um toque de potência-resistência sem sair de perto da força no limite.'],
				},
				{
					name: 'Projeto de boulder na rocha',
					what: 'Projeto na rocha',
					note: 'Aquecimento completo · trabalhe um projeto de verdade · descanso generoso entre tentativas.',
					why: ['A rocha recruta potência e técnica que o ginásio não reproduz.'],
				},
			],
		},
		pinch: {
			name: 'Pinch Block',
			cat: 'Pinça',
			variants: [
				{
					name: 'Máximo · bloco de uma falange',
					what: 'Bloco com profundidade de uma falange',
					note: 'Ombros encaixados, braço junto ao corpo, levante com as pernas · ~30s entre braços.',
					why: [
						'Ombros encaixados, braço junto ao corpo, levante com as pernas. <b>Nunca</b> faça pinch hang de frente — risco de De Quervain (López).',
						'Varie a largura do bloco ao longo das 8 semanas; vá mais estreito / só na polpa na Fase 2.',
					],
				},
				{
					name: 'Terra de pinça com as duas mãos',
					what: 'Pinça com as duas mãos, do chão',
					note: 'Levantada de pinça quase máxima com as duas mãos, do chão.',
					why: ['Carga maior com as duas mãos — ótimo pra força bruta de pinça.'],
				},
				{
					name: 'Pinch hangs largos numa board 40°+',
					what: 'Pinças largas numa board inclinada',
					note: 'Segurar / mover em pinças largas · descanso completo.',
					why: ['Treina a oposição do polegar numa posição específica de escalada.'],
				},
				{
					name: 'Máximo no trilho Rockstar / Tension',
					what: 'Trilho de pinça comercial',
					note: 'Levantadas máximas por largura; alterne as larguras.',
					why: ['Um trilho de pinça repetível facilita carregar e acompanhar.'],
				},
			],
		},
		wrist: {
			name: 'Força de Punho / Sloper',
			cat: 'Punho / Slopers',
			variants: [
				{
					name: 'Wrist-wrench / levantamentos radiais',
					what: 'Wrist-wrench / levantamentos radiais',
					note: 'Até a falha · dose de hipertrofia pro FRC + estabilizadores do punho.',
					why: [
						'Desenvolve o FRC e os estabilizadores do punho pra slopers e compressão.',
						'Ferrer-Uris 2023: sloper de 60mm ≈ ativação do FPD em half-crimp, com <b>melhor</b> FRC/FDS e menos risco de lesão.',
					],
				},
				{
					name: 'Density hangs em sloper grande (60mm)',
					what: 'Sloper de 60mm · mão aberta',
					note: '2 braços · mão aberta.',
					why: ['Carrega o punho + FRC numa posição de sloper com baixo custo de polia.'],
				},
				{
					name: 'Flexão de punho reversa + normal (pesadas)',
					what: 'Flexões de punho com carga',
					note: 'Hipertrofia de punho pesada e escalável.',
					why: ['Hipertrofia de punho direta e escalável pra resiliência de cotovelo e punho.'],
				},
				{
					name: 'Board de compressão / pinça-sloper',
					what: 'Pegadas de compressão',
					note: 'Segurar / mover em pegadas de compressão.',
					why: ['Treina a estabilidade do punho sob compressão.'],
				},
			],
		},
		repeaters: {
			name: 'Repeaters',
			cat: 'Resistência / FC',
			variants: [
				{
					name: '7/3 · 20mm half-crimp + mão aberta',
					what: '20mm · half-crimp + mão aberta',
					note: '2 pegadas: half-crimp + mão aberta.',
					why: [
						'Desenvolve capacidade glicolítica, resistência ao pump e <b>força crítica</b> — provavelmente sua lacuna real, já que seu máximo é alto.',
						'Fase 2: caia pra 2–3 séries/pegada @ ~65–70% pra chegar explosivo no fim de semana.',
					],
				},
				{
					name: '6:10 (recuperação maior)',
					what: '6s on / 10s off',
					note: 'Descansos mais longos puxam pra capacidade aeróbica.',
					why: [
						'Descansos mais longos puxam pra capacidade aeróbica em vez do estresse glicolítico.',
					],
				},
				{
					name: 'Força crítica (4s/4s até a falha)',
					what: '4s on / 4s off até a falha',
					note: 'On/off até a falha — até a força estabilizar.',
					why: ['Mede e desenvolve diretamente seu piso de <b>força crítica</b>.'],
				},
				{
					name: 'Voltas na parede · boulder 4×4',
					what: 'Voltas na parede / 4×4',
					note: 'Sub-limite · faça pump, pare antes da falha.',
					why: ['Transfere a capacidade dos repeaters pro movimento real.'],
				},
			],
		},
		sport: {
			name: 'Escalada Esportiva',
			cat: 'Resistência / FC',
			variants: [
				{
					name: 'Voltas na board · pump controlado',
					what: 'Submáximo, pump controlado',
					note: 'Vias ou voltas na board · faça pump, mas nunca até a falha.',
					why: ['Transfere o estímulo dos repeaters pro movimento real e pra capacidade aeróbica.'],
				},
				{
					name: 'Vias / voltas no auto-belay',
					what: 'Rodagem de vias',
					note: 'Vias fáceis–moderadas contínuas · descanse conforme precisar.',
					why: ['Base aeróbica em vias reais — mantenha o esforço moderado.'],
				},
				{
					name: 'Volume na board (ângulo fácil)',
					what: 'Volume em ângulo fácil',
					note: 'Muitos problemas fáceis na board · ~20–30 min de pump constante.',
					why: ['Volume alto de qualidade de movimento e capilarização.'],
				},
				{
					name: 'Travessia ARC 2×15–20 min',
					what: 'Travessia ARC',
					note: '2×15–20 min de travessia fácil contínua (<b>ARC</b>).',
					why: ['Trabalho clássico de <b>ARC</b> pra base de resistência e recuperação.'],
				},
			],
		},
		pull: {
			name: 'Puxada',
			cat: 'Potência de puxada',
			variants: [
				{
					name: 'Barras com peso pesadas + OAP',
					what: 'Barras com peso + trabalho de OAP',
					note: 'Duro mas limpo · OAP negativas / assistidas 3–4 séries/lado.',
					why: [
						'De propósito num dia de baixo custo pros dedos — potência de puxada sem gastar pele nem polias.',
						'Fase 2: vá pra menos reps / mais carga, ou mais trabalho técnico de OAP.',
					],
				},
				{
					name: 'Escada de barra de 1 braço',
					what: 'Progressões de OAP',
					note: 'Assistida → negativas → simples · descanso completo.',
					why: [
						'Constrói rumo à barra de um braço, com alta demanda neural e baixo custo de dedo.',
					],
				},
				{
					name: 'Frenchies / barras com peso em tempo',
					what: 'Tempo + isometria',
					note: 'Frenchies (pausa 90° / lock completo) ou barras com peso em tempo.',
					why: ['Adiciona tempo sob tensão e força de lock-off.'],
				},
				{
					name: 'Combo front-lever + barra com peso',
					what: 'Front-lever + barra',
					note: 'Progressões de front-lever + barras com peso.',
					why: ['Potência de puxada comandada pelo core pra terreno inclinado.'],
				},
			],
		},
		slopdens: {
			name: 'Density em Sloper',
			cat: 'Tecido',
			variants: [
				{
					name: 'Parte de baixo de um sloper',
					what: 'Parte de baixo de um sloper',
					note: '2 braços · mão aberta.',
					why: [
						'Trabalho de tecido em mão aberta que não castiga as polias — encaixa bem depois do dia de puxada.',
					],
				},
				{
					name: 'Mão aberta em 35mm',
					what: '35mm · mão aberta',
					note: '2 braços · mão aberta · quase submáx.',
					why: ['Carga de tecido em mão aberta numa régua definida.'],
				},
				{
					name: 'Repeaters em régua grande (mão aberta)',
					what: 'Régua grande · mão aberta',
					note: 'Repeaters longos numa régua grande.',
					why: ['Volume de tecido com estresse mínimo nas polias.'],
				},
				{
					name: 'No-hang · mão aberta',
					what: 'No-hang · mão aberta',
					note: '2 braços · no-hang block.',
					why: ['Fácil de carregar e amigável às polias — ótimo pra dias sensíveis.'],
				},
			],
		},
		maxhang: {
			name: 'Max Hangs',
			cat: 'Força máxima',
			variants: [
				{
					name: 'Manutenção · ~10mm',
					what: 'Dose curta · régua de ~10mm',
					note: 'Deixe 2–3s de margem (<b>MAW</b>/<b>MED</b> da López, mínimo).',
					why: [
						'Aqui é <b>manutenção</b>, não recorde — seu máximo está perto do teto e volume extra vira mais custo de lesão do que ganho.',
					],
				},
				{
					name: 'MED — peso corporal em régua menor',
					what: 'Profundidade mínima · peso corporal',
					note: 'Menor régua que aguentar (<b>MED</b> da López).',
					why: ['<b>MED</b> da López: diminua a régua em vez de adicionar peso.'],
				},
				{
					name: 'MAW — 18–20mm + peso',
					what: 'Peso adicional · 18–20mm',
					note: '2–3s de margem (<b>MAW</b> da López).',
					why: ['<b>MAW</b> da López: adicione peso numa régua mais amigável.'],
				},
				{
					name: 'No-hang block máximo (10s)',
					what: 'Máximo no no-hang block',
					note: 'Levantadas quase máximas no block.',
					why: ['Força máxima amigável às polias, que dá pra carregar com precisão.'],
				},
			],
		},
		density: {
			name: 'Density Hangs',
			cat: 'Tecido',
			variants: [
				{
					name: 'Half-crimp · perto da falha',
					what: 'Sustentações longas perto da falha',
					note: 'Perto da falha · half-crimp.',
					why: [
						'Seu principal investimento em tecido conjuntivo. Aumenta a rigidez do músculo e da JMT e <b>reduz</b> a rigidez tendínea patológica — no saldo, um sistema mais resistente a lesão (Nelson).',
					],
				},
				{
					name: 'Mão aberta · sustentações longas',
					what: 'Mão aberta · sustentações longas',
					note: 'Perto da falha · mão aberta.',
					why: ['Mesmo estímulo de tecido deslocado pra mão aberta.'],
				},
				{
					name: 'No-hang block',
					what: 'No-hang block',
					note: 'Perto da falha · no-hang block.',
					why: ['Carga de densidade amigável às polias.'],
				},
				{
					name: 'Repeaters longos @ % baixo',
					what: 'Repeaters longos de % baixo',
					note: 'Repeaters longos on/off · várias séries.',
					why: ['Acumula tempo de tecido sob carga com pico de força baixo.'],
				},
			],
		},
		abra: {
			name: 'Abrahangs',
			cat: 'Tecido',
			variants: [
				{
					name: 'Hangboard · 2 mãos',
					what: 'Hangboard na parede · as duas mãos · 18–22mm',
					note: '"Só tensão leve" · ~10 min · entre pegadas · ≥6h do trabalho pesado.',
					tool: 'Hangboard · 2 mãos',
					speed: 'Padrão',
					why: [
						'Complementa o trabalho máximo pela saúde do tecido (Gilmore/Baar 2024). Na sua força, mantenha bem <b>leves</b> — erre pra baixo de 40%.',
						'Isto é treino, não descanso — corte <b>estes</b> primeiro a qualquer incômodo.',
					],
				},
				{
					name: 'Block · 1 mão',
					what: 'No-hang no pino/block · uma mão por vez',
					note: 'Uma mão por vez num pino de carga · troca de mão a cada rep · mantenha leve.',
					tool: 'Block · 1 mão',
					speed: 'Padrão',
					why: ['Carga no-hang por mão — precisa e fácil de manter bem abaixo de 40%.'],
				},
				{
					name: 'Hangboard · 2 mãos · rápido',
					what: 'abrafast · 15s on / 20s off · 13 rounds',
					note: 'Abrahang rápido: sustentações mais longas, menos rounds.',
					tool: 'Hangboard · 2 mãos',
					speed: 'Rápido',
					why: ['Mesmo estímulo leve de tecido, mais rápido de encaixar.'],
				},
				{
					name: 'Block · 1 mão · rápido',
					what: 'abrafast 1 mão · alterna as mãos a cada rep',
					note: 'Troca de mão a cada rep (2s) · 2 ciclos.',
					tool: 'Block · 1 mão',
					speed: 'Rápido',
					why: ['Versão rápida por mão — alterna as mãos, descanso mínimo.'],
				},
			],
		},
		antag: {
			name: 'Antagonistas',
			cat: 'Prevenção',
			variants: [
				{
					name: 'Circuito completo',
					what: '~10 min · seguro pro cotovelo + polias',
					note: 'Flexão de punho reversa 3×15 · extensão de dedo com elástico 3×20–30 · pronação/supinação 3×12 · flexões/dips.',
					why: ['Essencial pela sua dominância flexora — protege cotovelos e polias.'],
				},
				{
					name: 'Balde de arroz + elásticos',
					what: 'Balde de arroz + elásticos',
					note: '~5–8 min · balde de arroz + extensão de dedo com elástico.',
					why: ['Trabalho de baixo esforço pra extensores e resistência de antebraço.'],
				},
				{
					name: 'Só extensão de dedo com Theraband',
					what: 'Extensões com elástico',
					note: 'Equilíbrio de extensores pra fazer todo dia.',
					why: ['Equilíbrio mínimo de extensores quando o tempo é curto.'],
				},
				{
					name: 'Empurrar / pronação',
					what: 'Empurrar + pronação',
					note: '~8–10 min · flexões / dips + pronação/supinação.',
					why: ['Equilíbrio de empurrar + rotação pra ombros e cotovelos.'],
				},
			],
		},
		perform: {
			name: 'Performance',
			cat: 'Técnica',
			variants: [
				{
					name: 'Dia de send na rocha',
					what: 'Hangboard = só aquecimento',
					note: 'Sua escalada real mais difícil da semana · aquecimento completo · cabeça de send.',
					why: ['Em janela de send, o hangboard vira só ferramenta de aquecimento (Hörst).'],
				},
				{
					name: 'Performance forte no ginásio',
					what: 'Performance no ginásio',
					note: 'Escalada mais difícil do ginásio · aquecimento completo · tentativas de send de verdade.',
					why: ['Estímulo de performance quando não dá pra ir na rocha.'],
				},
				{
					name: 'Sessão flash estilo competição',
					what: 'Sessão flash',
					note: 'Onsight / flash numa variedade de problemas · pouca preparação por problema.',
					why: ['Treina leitura e execução de primeira.'],
				},
				{
					name: 'Dia longo de vários boulders',
					what: 'Volume na rocha',
					note: 'Muitos boulders ao longo do dia · cuide da pele e da energia.',
					why: ['Rodagem e técnica de qualidade na rocha.'],
				},
			],
		},
		rest: {
			name: 'Descanso',
			cat: 'Recuperação',
			variants: [
				{
					name: 'Descanso total',
					what: 'Sem carga nos dedos',
					note: 'Caminhe · mobilidade · durma · coma. A adaptação acontece agora, não na parede.',
					why: ['Mesmo no seu nível, o teto é ~3 dias de alto SNC por semana. Inegociável.'],
				},
				{
					name: 'Caminhada leve + mobilidade',
					what: 'Caminhada + mobilidade',
					note: 'Caminhada leve + 10–15 min de mobilidade · sem carga de pegada.',
					why: ['Recuperação ativa que não sobrecarrega os dedos.'],
				},
				{
					name: 'Aeróbico leve (sem pegada)',
					what: 'Aeróbico leve',
					note: '20–40 min de cardio leve · sem pegada.',
					why: ['Favorece recuperação e base aeróbica sem carga nos dedos.'],
				},
				{
					name: 'Abrahangs gentis só se quiser mexer',
					what: 'Abrahangs leves',
					note: 'Abrahangs bem leves só se for necessário.',
					why: ['O máximo que você deve fazer num dia de descanso, e só se estiver inteiro.'],
				},
			],
		},
	},
	metrics: [
		{
			id: 'rfd',
			name: 'Taxa de Desenv. de Força',
			abbr: 'RFD',
			cat: '--flag',
			unit: '%/100ms',
			desc: 'Quão rápido você chega ao pico de força. Teste: recruitment pull máximo; anote a sensação de tempo até o pico ou o valor do aparelho.',
		},
		{
			id: 'contact',
			name: 'Força de Contato',
			abbr: 'CONTATO',
			cat: '--flag',
			unit: 'kg / régua',
			desc: 'Força que você segura na hora em agarras pequenas. Teste: recruitment pull de 3s mais pesado numa régua fixa.',
		},
		{
			id: 'cf',
			name: 'Força Crítica',
			abbr: 'FC',
			cat: '--gold',
			unit: '% MVC',
			desc: 'Piso de força sustentável — seu teto de resistência. Teste: protocolo de repeaters até a falha.',
		},
		{
			id: 'pinch',
			name: 'Pinça Máxima',
			abbr: 'PINÇA',
			cat: '--gold',
			unit: 'kg / 7s',
			desc: 'Melhor levantada de 7 segundos num pinch block de ~80mm, com peso. Teste cada braço.',
		},
		{
			id: 'pull',
			name: 'Barra com Peso',
			abbr: 'BARRA',
			cat: '--violet',
			unit: 'kg adicionais',
			desc: 'Melhor barra/chin-up com peso numa rep limpa.',
		},
		{
			id: 'maxhang',
			name: 'Max Hang',
			abbr: 'MAXHANG',
			cat: '--violet',
			unit: 'kg @ 20mm',
			desc: 'Referência padrão — peso adicional máximo, 10s, régua de 20mm.',
		},
		{
			id: 'density',
			name: 'Sustentação de Densidade',
			abbr: 'DENSIDADE',
			cat: '--teal',
			unit: 'seg @ carga',
			desc: 'Maior sustentação de densidade com qualidade na carga de trabalho — proxy da capacidade do tecido.',
		},
		{
			id: 'bodyweight',
			name: 'Peso Corporal',
			abbr: 'PESO',
			cat: '--ink-faint',
			unit: 'kg',
			desc: 'Registre com frequência (idealmente todo dia) — ancora as estimativas de força em % do peso.',
		},
		{
			id: 'boulder',
			name: 'Grau de Boulder',
			abbr: 'BOULDER',
			cat: '--flag',
			unit: 'escala V',
			desc: 'Seu boulder mais duro limpo (escala V) — a expressão da força na parede.',
		},
		{
			id: 'route',
			name: 'Grau de Via',
			abbr: 'VIA',
			cat: '--violet',
			unit: 'francês',
			desc: 'Sua via mais dura no redpoint (francês) — resistência e técnica na parede.',
		},
	],
	quiz: [
		{
			id: 'sleep',
			q: 'Como foi seu sono?',
			why: 'O sono é o maior fator de recuperação e adaptação — dormir pouco ou mal derruba o desempenho e aumenta o risco de lesão.',
			study: 'sleep',
			a: [
				{ t: 'Ótimo — descansado', v: 10 },
				{ t: 'Ok', v: 7 },
				{ t: 'Ruim / curto', v: 3 },
				{ t: 'Quase não dormi', v: 0 },
			],
		},
		{
			id: 'fatigue',
			q: 'Quão recuperado você se sente?',
			why: 'A recuperação percebida acompanha a fadiga acumulada e sinaliza overreaching antes do desempenho cair.',
			study: 'prs',
			a: [
				{ t: 'Inteiro e ligado', v: 10 },
				{ t: 'Normal', v: 7 },
				{ t: 'Meio apagado', v: 4 },
				{ t: 'Detonado', v: 0 },
			],
		},
		{
			id: 'soreness',
			q: 'Dor muscular?',
			why: 'Dor persistente indica tecido ainda não recuperado — treinar em cima aumenta o risco de estiramento e reduz a força.',
			study: 'hooper',
			a: [
				{ t: 'Nenhuma', v: 10 },
				{ t: 'Leve', v: 7 },
				{ t: 'Moderada', v: 3 },
				{ t: 'Forte', v: 0 },
			],
		},
		{
			id: 'body',
			q: 'Algo incomodando hoje?',
			why: 'Lesões na escalada se concentram em dedos, cotovelos e ombros — uma articulação dolorida muda o que treinar, não só o quanto.',
			a: [
				{ t: 'Nada', v: 0 },
				{ t: 'Dedos', v: 1 },
				{ t: 'Cotovelo', v: 2 },
				{ t: 'Ombro', v: 3 },
				{ t: 'Punho', v: 4 },
			],
		},
		{
			id: 'illness',
			q: 'Sentindo-se doente?',
			why: 'O "teste do pescoço": sintomas abaixo do pescoço (febre, peito, dores no corpo) significam não treinar — carregar um corpo que já combate uma infecção é contraproducente e, com febre, ainda eleva o risco cardíaco. Coriza acima do pescoço → pegue leve.',
			study: 'illness',
			a: [
				{ t: 'Estou bem', v: 0 },
				{ t: 'Leve — acima do pescoço', v: 1 },
				{ t: 'Doente — febre / dores', v: 2 },
			],
		},
		{
			id: 'time',
			q: 'Quanto tempo hoje?',
			why: 'O tempo define o formato — uma janela curta ainda rende muito (recruitment), mas exclui trabalho de alto volume.',
			a: [
				{ t: 'Sessão completa', v: 10 },
				{ t: 'Normal', v: 7 },
				{ t: 'Curta — 30–45 min', v: 3 },
				{ t: 'Apertada — menos de 30', v: 0 },
			],
		},
		{
			id: 'severity',
			followup: true,
			q: 'Como está a sensação?',
			why: 'Rigidez dá pra contornar, sensibilidade pede recuar, dor aguda é parada — a gravidade define o limite.',
			a: [
				{ t: 'Só rígido', v: 0 },
				{ t: 'Sensível', v: 1 },
				{ t: 'Dolorido', v: 2 },
				{ t: 'Agudo', v: 3 },
			],
		},
		{
			id: 'stress',
			followup: true,
			q: 'Estresse na vida agora?',
			why: 'Estresse psicológico atrasa a recuperação e aumenta o risco de lesão independente do treino — estresse alto pede um dia mais leve.',
			study: 'hooper',
			a: [
				{ t: 'Baixo / tranquilo', v: 10 },
				{ t: 'Algum', v: 6 },
				{ t: 'Alto', v: 2 },
			],
		},
		{
			id: 'mood',
			followup: true,
			q: 'Motivação e disposição?',
			why: 'Baixa motivação prevê sessão de baixa qualidade e faz parte do monitoramento de bem-estar validado — sinal para treinar leve.',
			study: 'hooper',
			a: [
				{ t: 'Animado', v: 10 },
				{ t: 'Normal', v: 6 },
				{ t: 'Apagado', v: 3 },
				{ t: 'Sem vontade', v: 0 },
			],
		},
		{
			id: 'skin',
			followup: true,
			q: 'Como está sua pele?',
			why: 'A pele limita um dia duro de crimp/board por mais inteiro que você esteja — escalar na carne viva só custa mais dias.',
			a: [
				{ t: 'Firme', v: 10 },
				{ t: 'Fina / desgastada', v: 4 },
				{ t: 'Rasgada ou em carne viva', v: 0 },
			],
		},
	],
	verdicts: {
		rest: {
			title: 'Pare — descanso total hoje',
			tag: 'Parada obrigatória',
			color: 'var(--flag)',
			text: 'Parada obrigatória hoje — <b>nada de carga.</b> Se for dor aguda no dedo, costuma ser polia A2/A4 (~60% das lesões de dedo) e forçar é justamente o que transforma um incômodo em meses parado — avalie com um profissional se passar de 3–5 dias. Se você está doente, com febre ou dores no corpo, treinar um corpo que já combate uma infecção atrasa mais ainda (e, com febre, sobrecarrega o coração). Hoje: sono, comida, mobilidade leve; reavalie amanhã.',
			focus: ['DESCANSO', 'recuperar', 'reavaliar'],
		},
		tissue: {
			title: 'Dia de tecido / recuperação',
			tag: 'Só carga baixa',
			color: 'var(--teal)',
			text: 'Você está mal recuperado ou com um incômodo. Faça <b>só trabalho de tecido em carga baixa</b>: Abrahangs leves (bem abaixo de 40%), antagonistas e mobilidade tranquila. É produtivo — o tecido é seu gargalo de qualquer jeito — e ainda protege os dias duros.',
			focus: ['Abrahangs', 'antagonistas', 'mobilidade de punho'],
		},
		moderate: {
			title: 'Moderado — resistência ou tipo de pegada',
			tag: 'Qualidade, não máximo',
			color: 'var(--gold)',
			text: 'Dá pra treinar, mas não pra ir ao limite. Melhores escolhas: <b>repeaters 7/3</b> pra força crítica, ou uma sessão de <b>pinça / punho / sloper</b>. Evite recruitment máximo e boulder no limite hoje — poupe o SNC.',
			focus: ['repeaters', 'pinça', 'sloper', 'força crítica'],
		},
		short: {
			title: 'Curto e afiado — força de contato',
			tag: 'Muito valor, pouco volume',
			color: 'var(--flag)',
			text: 'Você está inteiro mas com pouco tempo. Perfeito pra <b>recruitment pulls</b> — 2–3 séries treinam RFD e força de contato em ~15 min com fadiga mínima. Aqueça direito antes; qualidade acima de quantidade.',
			focus: ['recruitment pulls', 'RFD', 'força de contato'],
		},
		green: {
			title: 'Sinal verde — vá com tudo',
			tag: 'Dia de limite / máximo',
			color: 'var(--flag)',
			text: 'Inteiro, dedos bons, tempo e pele de sobra. Manda um <b>dia duro</b>: recruitment pulls emendando em <b>boulder no limite</b>, ou um dia de puxada pesada. Descanse de verdade entre os esforços máximos. Tome colágeno ~60 min antes: 15g de colágeno + 50mg de vit. C.',
			focus: ['recruitment pulls', 'boulder no limite', 'puxada pesada'],
		},
	},
	flags: {
		finger_pain: {
			title: 'Dor aguda no dedo',
			text: 'Pare de carregar os dedos hoje — dor aguda (muitas vezes <b>polia A2/A4</b>) pede descanso, não treino. Gelo se inchado; se continuar aguda em 3–5 dias, procure avaliação. Comece uma reabilitação estruturada em vez de forçar.',
			focus: ['sem hangboard', 'avaliar', 'reabilitação'],
		},
		finger_tender: {
			title: 'Dedo sensível',
			text: 'Uma articulação ou polia sensível é um aviso. Pule max hangs e crimp; fique em <b>Abrahangs de carga baixa (abaixo de ~40%)</b> e open-hand. Alguns dias leves agora evitam semanas parado depois.',
			focus: ['carga baixa', 'open-hand', 'sem crimp'],
		},
		elbow_pain: {
			title: 'Dor no cotovelo',
			text: 'Epicondilite (cotovelo de escalador) piora com puxada e preensão. Zere o volume de puxada hoje; faça <b>excêntricos de punho</b> sem dor e isometria leve. Considere um bloco de reabilitação de cotovelo.',
			focus: ['sem trações duras', 'excêntricos', 'reabilitação'],
		},
		elbow_niggle: {
			title: 'Incômodo no cotovelo',
			text: 'Tendinopatia inicial de cotovelo. Mantenha a puxada <b>submáxima</b> e adicione excêntricos leves de punho/antebraço. Não busque recordes em puxada hoje.',
			focus: ['puxada submáx', 'excêntricos'],
		},
		shoulder_pain: {
			title: 'Dor no ombro',
			text: 'Ombro dolorido somado a carga acima da cabeça é má combinação. Evite trações máximas, dinâmicos e lock-offs profundos. Faça <b>prehab de escápula e manguito rotador</b>; considere um bloco de reabilitação de ombro.',
			focus: ['sem dinâmicos', 'prehab manguito', 'reabilitação'],
		},
		shoulder_niggle: {
			title: 'Incômodo no ombro',
			text: 'Adicione controle escapular e trabalho de manguito rotador; mantenha empurrar/puxar controlado e sem dor. Aqueça bem o ombro antes de qualquer movimento difícil.',
			focus: ['controle escapular', 'manguito', 'aquecer'],
		},
		skin: {
			title: 'Pele desgastada',
			text: 'Pele fina ou rasgada não aguenta crimps e agarras ásperas. Lixe flappers, faça tape nos rasgos e escolha trabalho <b>de jug ou sem dedos</b> hoje. Forçar na carne viva só custa mais dias.',
			focus: ['tape', 'jugs', 'antagonistas'],
		},
		wrist_pain: {
			title: 'Dor no punho',
			text: 'Dor no punho (muitas vezes de pinça / sloper ou impacto dorsal) pede alívio de carga. Evite extensão de punho carregada e pinça hoje; mantenha <b>isometria sem dor</b> e mobilidade. Considere um bloco de reabilitação de punho.',
			focus: ['sem pinça', 'isometria', 'reabilitação'],
		},
		wrist_niggle: {
			title: 'Incômodo no punho',
			text: 'Mantenha a carga no punho <b>sem dor</b> e adicione isometria leve e mobilidade; evite posições carregadas em amplitude final e pinça dura hoje.',
			focus: ['sem dor', 'isometria', 'mobilidade'],
		},
		acwr_spike: {
			title: 'Pico de carga de treino',
			text: 'Seus últimos 7 dias estão bem acima da sua média de 4 semanas (<b>ACWR &gt; 1,5</b>) — uma faixa associada a mais risco de lesão em alguns estudos. O ACWR é uma heurística debatida, não uma regra rígida, então trate como um sinal entre vários: segure a intensidade no moderado e deixe a carga assentar antes do próximo dia duro.',
			focus: ['pegue leve', 'moderado', 'recuperar'],
		},
		acwr_high: {
			title: 'Carga subindo',
			text: 'Você está carregando acima da sua faixa confortável. Fique de olho na fadiga e evite somar mais volume duro nesta semana.',
			focus: ['olho na carga', 'segurar volume'],
		},
		acwr_low: {
			title: 'Risco de destreino',
			text: 'A carga recente está bem abaixo da sua média. Se estiver saudável, dá pra <b>retomar aos poucos</b> — pequenos aumentos semanais batem um pico repentino.',
			focus: ['retomar', 'gradual'],
		},
		readiness_declining: {
			title: 'Prontidão caindo',
			text: 'Sua prontidão vem caindo nos últimos dias — sinal de <b>fadiga acumulada</b>. Segure hoje no moderado ou mais leve e encaixe um dia de recuperação em breve; insistir numa queda é como overreaching vira overtraining.',
			focus: ['pegar leve', 'recuperar', 'sono'],
		},
		below_baseline: {
			title: 'Abaixo do seu normal',
			text: 'A prontidão de hoje está bem abaixo da sua média pessoal. Trate como sinal real — priorize <b>qualidade sobre carga</b> e confira sono, comida e estresse.',
			focus: ['qualidade', 'olho na fadiga'],
		},
		monotony_high: {
			title: 'Treino monótono demais',
			text: 'Seus últimos 7 dias estão <b>iguais</b> — carga parecida todo dia, sem dias realmente leves (alta <b>monotonia de treino</b>, Foster; o limite ≥2 é um guia aproximado, não um corte rígido). É a variação entre os dias que permite adaptar; sem ela, a sobrecarga se acumula. Deixe hoje claramente mais leve (ou descanse) para a semana ter contraste forte/fraco.',
			focus: ['variar carga', 'dia leve', 'recuperar'],
		},
		illness_systemic: {
			title: 'Doente — não treine',
			text: 'Febre ou sintomas abaixo do pescoço (peito, dores no corpo, intestino) são <b>parada obrigatória</b>. Treinar enquanto o corpo combate uma infecção aprofunda o buraco, e exercitar-se com febre traz risco real de <b>miocardite</b>. Descanse, hidrate, durma. Espere ficar 24h sem sintomas e sem febre antes de voltar aos poucos.',
			focus: ['não treinar', 'hidratar', 'dormir'],
		},
		illness_mild: {
			title: 'Resfriado leve — pegue leve',
			text: 'Só acima do pescoço (coriza, garganta levemente irritada, sem febre) geralmente dá para treinar <b>leve</b> — mantenha a intensidade moderada, corte o volume e pare se os sintomas descerem abaixo do pescoço ou surgir febre. Evite esforços máximos; priorize qualidade de movimento.',
			focus: ['só leve', 'cortar volume', 'monitorar'],
		},
		probe_low: {
			title: 'Força caiu — fadiga',
			text: 'Sua puxada máxima está bem abaixo da linha de base — sinal de <b>fadiga neuromuscular</b> real, não importa o que a cabeça diga. Trate hoje como recuperação: <b>só trabalho de tecido</b>, sem carga máxima ou quase máxima. A força costuma voltar em um ou dois dias após recuperar.',
			focus: ['recuperação', 'sem máximo', 'tecido'],
		},
		probe_fatigued: {
			title: 'Força um pouco abaixo',
			text: 'Sua puxada máxima está um pouco abaixo da base — alguma fadiga acumulada. Mantenha a intensidade <b>moderada</b>: treine qualidade, pule o trabalho de limite e deixe o sistema nervoso se recuperar.',
			focus: ['moderado', 'qualidade', 'sem limite'],
		},
		probe_fresh: {
			title: 'Força em dia',
			text: 'Sua puxada máxima está na base ou acima — o sistema nervoso está <b>pronto</b>. Se nada mais estiver te segurando, é sinal verde para esforços duros e de alta qualidade.',
			focus: ['pronto', 'pode forçar'],
		},
	},
	deep: {
		fingers: {
			title: 'Autoavaliação de dedo / polia',
			intro:
				'Um teste rápido de tolerância de carga de dedo, polia e tendão flexor. Responda pensando no dedo mais afetado na última semana.',
			source: 'Baseado no VISA-C (dedo / mão / punho de escalada)',
			url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12488532/',
			questions: [
				{
					id: 'stiff',
					q: 'Rigidez matinal no dedo?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Passa em alguns minutos', v: 7 },
						{ t: '10–30 min', v: 4 },
						{ t: 'Boa parte do dia', v: 0 },
					],
				},
				{
					id: 'crimp',
					q: 'Dor ao carregar uma borda pequena / crimpar forte?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Leve, aquece', v: 6 },
						{ t: 'Moderada, limita', v: 3 },
						{ t: 'Aguda — não dá', v: 0 },
					],
				},
				{
					id: 'after',
					q: 'Dor depois de uma sessão dura de dedo?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Some até a manhã seguinte', v: 6 },
						{ t: 'Dura um dia', v: 3 },
						{ t: 'Vários dias', v: 0 },
					],
				},
				{
					id: 'edges',
					q: 'Consegue pendurar / carregar bordas pequenas?',
					a: [
						{ t: 'Totalmente', v: 10 },
						{ t: 'Um pouco reduzido', v: 6 },
						{ t: 'Muito limitado', v: 3 },
						{ t: 'De jeito nenhum', v: 0 },
					],
				},
				{
					id: 'swell',
					q: 'Inchaço ou espessamento na articulação / polia?',
					a: [
						{ t: 'Nenhum', v: 10 },
						{ t: 'Leve', v: 6 },
						{ t: 'Evidente', v: 3 },
						{ t: 'Acentuado / bowstringing', v: 0 },
					],
				},
				{
					id: 'climb',
					q: 'Escalando agora?',
					a: [
						{ t: 'Total, sem restrição', v: 10 },
						{ t: 'Treinando com adaptação', v: 7 },
						{ t: 'Só fácil', v: 3 },
						{ t: 'Sem escalar', v: 0 },
					],
				},
			],
		},
		elbow: {
			title: 'Autoavaliação de cotovelo',
			intro:
				'Um teste rápido de tendinopatia de cotovelo (epicondilite). Responda pensando no pior cotovelo na última semana.',
			source: 'Baseado no PRTEE (tendinopatia lateral de cotovelo)',
			url: 'https://pubmed.ncbi.nlm.nih.gov/17254903/',
			questions: [
				{
					id: 'rest',
					q: 'Dor no cotovelo em repouso?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Leve', v: 6 },
						{ t: 'Moderada', v: 3 },
						{ t: 'Forte', v: 0 },
					],
				},
				{
					id: 'grip',
					q: 'Dor ao puxar ou agarrar forte?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Leve', v: 6 },
						{ t: 'Moderada', v: 3 },
						{ t: 'Forte', v: 0 },
					],
				},
				{
					id: 'carry',
					q: 'Dor ao levantar ou carregar algo pesado?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Leve', v: 6 },
						{ t: 'Moderada', v: 3 },
						{ t: 'Forte', v: 0 },
					],
				},
				{
					id: 'weak',
					q: 'A pegada parece fraca ou instável?',
					a: [
						{ t: 'Não', v: 10 },
						{ t: 'Um pouco', v: 6 },
						{ t: 'Bastante', v: 3 },
						{ t: 'Muito fraca', v: 0 },
					],
				},
				{
					id: 'pull',
					q: 'Consegue treinar puxada?',
					a: [
						{ t: 'Totalmente', v: 10 },
						{ t: 'Reduzido', v: 6 },
						{ t: 'Só leve', v: 3 },
						{ t: 'Nada', v: 0 },
					],
				},
				{
					id: 'after',
					q: 'Dor depois de escalar / treinar?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Some até o dia seguinte', v: 6 },
						{ t: 'Dura um dia ou mais', v: 3 },
						{ t: 'Dias', v: 0 },
					],
				},
			],
		},
		shoulder: {
			title: 'Autoavaliação de ombro',
			intro:
				'Um teste rápido de dor e função do ombro. Responda pensando no pior ombro na última semana.',
			source: 'Baseado no SPADI (Índice de Dor e Incapacidade do Ombro)',
			url: 'https://www.physio-pedia.com/Shoulder_Pain_and_Disability_Index_(SPADI)',
			questions: [
				{
					id: 'worst',
					q: 'Dor no ombro no pior momento?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Leve', v: 6 },
						{ t: 'Moderada', v: 3 },
						{ t: 'Forte', v: 0 },
					],
				},
				{
					id: 'lie',
					q: 'Dor ao deitar sobre ele?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Leve', v: 6 },
						{ t: 'Moderada', v: 3 },
						{ t: 'Forte', v: 0 },
					],
				},
				{
					id: 'overhead',
					q: 'Dor ao alcançar acima da cabeça?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Leve', v: 6 },
						{ t: 'Moderada', v: 3 },
						{ t: 'Forte', v: 0 },
					],
				},
				{
					id: 'reach',
					q: 'Dificuldade para alcançar ou fazer lock-off acima da cabeça?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Um pouco', v: 6 },
						{ t: 'Bastante', v: 3 },
						{ t: 'Incapaz', v: 0 },
					],
				},
				{
					id: 'press',
					q: 'Consegue empurrar / puxar acima da cabeça no treino?',
					a: [
						{ t: 'Totalmente', v: 10 },
						{ t: 'Reduzido', v: 6 },
						{ t: 'Só leve', v: 3 },
						{ t: 'Nada', v: 0 },
					],
				},
				{
					id: 'climb',
					q: 'Dor em movimentos dinâmicos / de força?',
					a: [
						{ t: 'Nenhuma', v: 10 },
						{ t: 'Leve', v: 6 },
						{ t: 'Moderada', v: 3 },
						{ t: 'Não consigo fazer', v: 0 },
					],
				},
			],
		},
	},
	phases: {
		phase1: {
			name: 'Fase 1 · Capacidade & Base de Tecido (Sem 1–4)',
			banner:
				'Construa qualidade de recruitment, fixe o máximo de pinça de 7s, suba o volume de repeaters, ganhe volume de puxada + negativas de OAP, densidade completa. Colágeno + vit. C ~60 min antes da sessão de dedo mais pesada.',
			cat: '--gold',
		},
		phase2: {
			name: 'Fase 2 · Expressão & Pico (Sem 5–7)',
			banner:
				'Enfatize força de contato em agarras piores; pinça mais estreita; corte séries de repeaters pra manter a potência; puxada vai pra menos reps / mais carga. Max hangs seguem no mínimo.',
			cat: '--flag',
		},
		deload: {
			name: 'Semana 8 · Deload',
			banner:
				'Corte volume E intensidade pela metade. Duas sessões curtas de hangboard, com bastante margem. Só escalada leve. MANTENHA os Abrahangs leves — descarregar de verdade custa ~10–20% do colágeno do tendão em poucos dias (Baar). As adaptações aparecem agora, conforme a fadiga passa. Reteste no fim da semana.',
			cat: '--teal',
		},
	},
	glossary: {
		SNC: 'Sistema nervoso central — a fadiga sistêmica que limita os esforços máximos e intensos.',
		RFD: 'Taxa de desenvolvimento de força — quão rápido você chega ao pico de força.',
		MVC: 'Contração voluntária máxima — sua força máxima numa dada pegada.',
		JMT: 'Junção miotendínea — onde o músculo vira tendão.',
		OAP: 'Barra de um braço (one-arm pull-up).',
		FRC: 'Flexor radial do carpo — um flexor do punho, do lado do polegar.',
		FPD: 'Flexor profundo dos dedos — o flexor profundo que comanda a crimpa.',
		FDS: 'Flexor superficial dos dedos.',
		FC: 'Força crítica — a maior força que você sustenta quase indefinidamente; seu piso de resistência.',
		MAW: 'Max Added Weight — protocolo de hangboard da López: régua fixa, adicionando peso.',
		MED: 'Minimum Edge Depth — protocolo da López: peso corporal em régua cada vez menor.',
		ARC: 'Aerobic Restoration & Capillarity — escalada contínua e fácil pra base de resistência.',
		'De Quervain':
			'Tenossinovite de De Quervain — irritação dos tendões do punho, do lado do polegar.',
	},
};

export default content;
