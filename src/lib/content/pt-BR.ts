import type { Content } from './types';

const content: Content = {
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
			type: 'Tração',
			prime: 'Dia de tração pesada + Densidade em sloper',
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
			cat: 'RFD / Contato',
			catVar: '--flag',
			variants: [
				{
					name: 'Recruitment Pulls',
					what: '1 braço · régua ~20mm ou reta',
					spec: {
						work: '3–5s no máximo',
						rest: '5s',
						reps: '4/lado',
						sets: '2–3',
						edge: '~20mm',
						note: 'Gerar força rápido e explosivo.',
					},
					why: [
						'O estímulo de dedo de maior retorno pra quem já é forte — treina a <b>taxa de desenvolvimento de força</b> e a força de contato com pouquíssima fadiga.',
						'Tyler Nelson: em nível alto, vale mais a <b>aplicação</b> da força do que mais força máxima.',
					],
				},
				{
					name: 'Toques máximos controlados no campus',
					what: 'Toques máximos controlados',
					spec: {
						reps: '4–6/lado',
						sets: '3–4',
						setRest: 'completo',
						note: 'Toques precisos até uma régua fixa — qualidade, não campus desleixado.',
					},
					why: [
						'Mesma intenção de recruitment com uma pegada controlada — qualidade, não campus desleixado.',
					],
				},
				{
					name: 'Levantamento máximo de 1 braço no Lattice-block',
					what: 'Levantada de 1 braço no block · ~20mm',
					spec: {
						work: '3–5s quase máx',
						reps: '4/lado',
						rest: '5s',
						sets: '2–3',
						edge: '~20mm',
						note: 'Levantada de 1 braço no block.',
					},
					why: [
						'Levantadas medidas por aparelho carregam com precisão e dão pra acompanhar a força de contato.',
					],
				},
				{
					name: 'Tentativas pesadas do primeiro movimento no limite',
					what: 'Primeiros movimentos duros, do chão',
					spec: {
						reps: '6–10 tentativas',
						setRest: 'completo',
						note: 'Tentativas máximas repetidas num primeiro movimento duro.',
					},
					why: [
						'Recruitment expresso em agarras reais — puxadas máximas num único movimento duro.',
					],
				},
			],
		},
		limitboulder: {
			cat: 'Potência / Técnica',
			catVar: '--flag',
			variants: [
				{
					name: 'Boulder no Limite',
					what: 'Os boulders mais duros · descansos longos',
					spec: {
						sets: '4–6 boulders',
						setRest: '3–5 min',
						note: 'Priorize movimentos de crimpa / contato. Qualidade acima de quantidade.',
					},
					why: [
						'Onde a força vira escalada. Qualidade acima de quantidade — descanse por completo entre as tentativas.',
					],
				},
				{
					name: 'Problemas no limite no Moonboard / Kilter',
					what: 'Problemas no limite na board',
					spec: {
						sets: '4–6 problemas',
						setRest: '3–5 min',
						note: 'Benchmarks de crimpa na board.',
					},
					why: ['Agarras padronizadas tornam a potência no limite repetível e mensurável.'],
				},
				{
					name: 'Boulders de potência tipo 4×4 duros',
					what: 'Circuitos de potência no limite',
					spec: {
						sets: '4 problemas ×4 rodadas',
						rest: 'curto dentro',
						setRest: 'longo entre',
						note: 'Adiciona um toque de potência-resistência no limite.',
					},
					why: ['Adiciona um toque de potência-resistência sem sair de perto da força no limite.'],
				},
				{
					name: 'Sessão de projeto de boulder na rocha',
					what: 'Projeto na rocha',
					spec: {
						setRest: 'generoso',
						note: 'Aquecimento completo · trabalhe um projeto de verdade.',
					},
					why: ['A rocha recruta potência e técnica que o ginásio não reproduz.'],
				},
			],
		},
		pinch: {
			cat: 'Pinça',
			catVar: '--gold',
			variants: [
				{
					name: 'Pinch Block — Máximo',
					what: 'Bloco com profundidade de uma falange',
					spec: {
						work: '7–10s',
						sets: '5–7',
						setRest: '3 min',
						rest: '30s entre braços',
						intensity: '~90% máx 7s',
						note: 'Ombros encaixados, braço junto ao corpo, levante com as pernas.',
					},
					why: [
						'Ombros encaixados, braço junto ao corpo, levante com as pernas. <b>Nunca</b> faça pinch hang de frente — risco de De Quervain (López).',
						'Varie a largura do bloco ao longo das 8 semanas; vá mais estreito / só na polpa na Fase 2.',
					],
				},
				{
					name: 'Terra de pinça com as duas mãos na barra',
					what: 'Pinça com as duas mãos, do chão',
					spec: {
						work: '5–7s quase máx',
						sets: '4–5',
						setRest: '3 min',
						note: 'Pinça com as duas mãos, do chão.',
					},
					why: ['Carga maior com as duas mãos — ótimo pra força bruta de pinça.'],
				},
				{
					name: 'Pinch hangs largos numa board 40°+',
					what: 'Pinças largas numa board inclinada',
					spec: {
						sets: '4–6 tentativas',
						setRest: 'completo',
						intensity: 'submáximo',
						note: 'Segurar / mover em pinças largas.',
					},
					why: ['Treina a oposição do polegar numa posição específica de escalada.'],
				},
				{
					name: 'Máximo no trilho de pinça Rockstar / Tension',
					what: 'Trilho de pinça comercial',
					spec: {
						work: '7–10s máx',
						sets: '4–5',
						note: 'Levantadas máximas por largura; alterne as larguras.',
					},
					why: ['Um trilho de pinça repetível facilita carregar e acompanhar.'],
				},
			],
		},
		wrist: {
			cat: 'Punho / Slopers',
			catVar: '--gold',
			variants: [
				{
					name: 'Força de Punho / Sloper',
					what: 'Wrist-wrench / levantamentos radiais',
					spec: {
						work: '20–40s até a falha',
						sets: '3–5',
						setRest: '2 min',
						intensity: '65–75% máx',
						note: 'Dose de hipertrofia pro FRC + estabilizadores do punho.',
					},
					why: [
						'Desenvolve o FRC e os estabilizadores do punho pra slopers e compressão.',
						'Ferrer-Uris 2023: sloper de 60mm ≈ ativação do FPD em half-crimp, com <b>melhor</b> FRC/FDS e menos risco de lesão.',
					],
				},
				{
					name: 'Density hangs em sloper grande (60mm)',
					what: 'Sloper de 60mm · mão aberta',
					spec: {
						work: '30–45s',
						sets: '3–4',
						edge: '60mm',
						note: '2 braços · mão aberta.',
					},
					why: ['Carrega o punho + FRC numa posição de sloper com baixo custo de polia.'],
				},
				{
					name: 'Flexão de punho reversa + normal (pesadas)',
					what: 'Flexões de punho com carga',
					spec: {
						sets: '3–4',
						reps: '10–15 cada direção',
						setRest: '2 min',
						note: 'Hipertrofia de punho pesada e escalável.',
					},
					why: ['Hipertrofia de punho direta e escalável pra resiliência de cotovelo e punho.'],
				},
				{
					name: 'Board de compressão / sistema pinça-sloper',
					what: 'Pegadas de compressão',
					spec: {
						sets: '4–6 tentativas',
						intensity: 'submáximo',
						note: 'Segurar / mover em pegadas de compressão.',
					},
					why: ['Treina a estabilidade do punho sob compressão.'],
				},
			],
		},
		repeaters: {
			cat: 'Resistência / FC',
			catVar: '--gold',
			variants: [
				{
					name: 'Repeaters 7/3',
					what: '20mm · half-crimp + mão aberta',
					spec: {
						work: '7s on / 3s off ×6',
						sets: '3–4/pegada',
						setRest: '3 min',
						edge: '20mm',
						intensity: '~60% MVC',
						note: '2 pegadas: half-crimp + mão aberta.',
					},
					why: [
						'Desenvolve capacidade glicolítica, resistência ao pump e <b>força crítica</b> — provavelmente sua lacuna real, já que seu máximo é alto.',
						'Fase 2: caia pra 2–3 séries/pegada @ ~65–70% pra chegar explosivo no fim de semana.',
					],
				},
				{
					name: 'Repeaters 6:10 (recuperação maior)',
					what: '6s on / 10s off',
					spec: {
						work: '6s on / 10s off ×6',
						sets: '3–4/pegada',
						setRest: '3 min',
						intensity: '~60% MVC',
						note: 'Descansos mais longos puxam pra capacidade aeróbica.',
					},
					why: [
						'Descansos mais longos puxam pra capacidade aeróbica em vez do estresse glicolítico.',
					],
				},
				{
					name: 'Protocolo de força crítica (4s/4s até a falha)',
					what: '4s on / 4s off até a falha',
					spec: {
						work: '4s on / 4s off até a falha',
						sets: '2–3 pegadas',
						setRest: 'completo',
						note: 'Até a força estabilizar.',
					},
					why: ['Mede e desenvolve diretamente seu piso de <b>força crítica</b>.'],
				},
				{
					name: 'Voltas/laps na parede · boulder 4×4',
					what: 'Voltas na parede / 4×4',
					spec: {
						sets: 'voltas ou 4 problemas ×4',
						note: 'Sub-limite · faça pump, pare antes da falha.',
					},
					why: ['Transfere a capacidade dos repeaters pro movimento real.'],
				},
			],
		},
		sport: {
			cat: 'Resistência / FC',
			catVar: '--gold',
			variants: [
				{
					name: 'Escalada Esportiva / Voltas na Board',
					what: 'Submáximo, pump controlado',
					spec: {
						note: 'Vias ou voltas na board · faça pump, mas nunca até a falha.',
					},
					why: ['Transfere o estímulo dos repeaters pro movimento real e pra capacidade aeróbica.'],
				},
				{
					name: 'Vias / voltas no auto-belay',
					what: 'Rodagem de vias',
					spec: {
						sets: '4–8 voltas',
						note: 'Vias fáceis–moderadas contínuas · descanse conforme precisar.',
					},
					why: ['Base aeróbica em vias reais — mantenha o esforço moderado.'],
				},
				{
					name: 'Volume na board (ângulo fácil)',
					what: 'Volume em ângulo fácil',
					spec: {
						work: '20–30 min',
						note: 'Muitos problemas fáceis na board · pump constante.',
					},
					why: ['Volume alto de qualidade de movimento e capilarização.'],
				},
				{
					name: 'Circuito / travessia ARC 2×15–20 min',
					what: 'Travessia ARC',
					spec: {
						work: '2×15–20 min',
						intensity: 'só pump leve',
						note: 'Travessia fácil contínua (<b>ARC</b>).',
					},
					why: ['Trabalho clássico de <b>ARC</b> pra base de resistência e recuperação.'],
				},
			],
		},
		pull: {
			cat: 'Potência de tração',
			catVar: '--violet',
			variants: [
				{
					name: 'Dia de Tração Pesada',
					what: 'Barras com peso + trabalho de OAP',
					spec: {
						sets: '4–6',
						reps: '3–5',
						load: '~+30–45kg',
						note: 'Duro mas limpo · OAP negativas / assistidas 3–4 séries/lado.',
					},
					why: [
						'De propósito num dia de baixo custo pros dedos — potência de tração sem gastar pele nem polias.',
						'Fase 2: vá pra menos reps / mais carga, ou mais trabalho técnico de OAP.',
					],
				},
				{
					name: 'Escada de barra de 1 braço (técnica)',
					what: 'Progressões de OAP',
					spec: {
						sets: '4–5/lado',
						setRest: 'completo',
						note: 'Assistida → negativas → simples.',
					},
					why: [
						'Constrói rumo à barra de um braço, com alta demanda neural e baixo custo de dedo.',
					],
				},
				{
					name: 'Frenchies / barras com peso em tempo controlado',
					what: 'Tempo + isometria',
					spec: {
						sets: '3–4',
						note: 'Frenchies (pausa 90° / lock completo) ou barras com peso em tempo.',
					},
					why: ['Adiciona tempo sob tensão e força de lock-off.'],
				},
				{
					name: 'Combo front-lever + barra com peso',
					what: 'Front-lever + barra',
					spec: {
						sets: '3–4',
						note: 'Progressões de front-lever + barras com peso.',
					},
					why: ['Potência de tração comandada pelo core pra terreno inclinado.'],
				},
			],
		},
		slopdens: {
			cat: 'Tecido',
			catVar: '--teal',
			variants: [
				{
					name: 'Density Hangs em Sloper',
					what: 'Parte de baixo de um sloper',
					spec: {
						work: '30–45s',
						sets: '3',
						note: '2 braços · mão aberta.',
					},
					why: [
						'Trabalho de tecido em mão aberta que não castiga as polias — encaixa bem depois do dia de tração.',
					],
				},
				{
					name: 'Density hangs de mão aberta em 35mm',
					what: '35mm · mão aberta',
					spec: {
						work: '30–45s quase submáx',
						sets: '3',
						edge: '35mm',
						note: '2 braços · mão aberta.',
					},
					why: ['Carga de tecido em mão aberta numa régua definida.'],
				},
				{
					name: 'Repeaters em régua grande (mão aberta)',
					what: 'Régua grande · mão aberta',
					spec: {
						sets: '3',
						intensity: '% baixo',
						note: 'Repeaters longos numa régua grande.',
					},
					why: ['Volume de tecido com estresse mínimo nas polias.'],
				},
				{
					name: 'Sustentações longas de mão aberta no no-hang',
					what: 'No-hang · mão aberta',
					spec: {
						work: '30–45s',
						sets: '3',
						note: '2 braços · no-hang block.',
					},
					why: ['Fácil de carregar e amigável às polias — ótimo pra dias sensíveis.'],
				},
			],
		},
		maxhang: {
			cat: 'Força máxima',
			catVar: '--violet',
			variants: [
				{
					name: 'Max Hangs — Manutenção',
					what: 'Dose curta · régua de ~10mm',
					spec: {
						work: '10s',
						sets: '3',
						setRest: '3 min',
						edge: '~10mm',
						note: 'Deixe 2–3s de margem (<b>MAW</b>/<b>MED</b> da López, mínimo).',
					},
					why: [
						'Aqui é <b>manutenção</b>, não recorde — seu máximo está perto do teto e volume extra vira mais custo de lesão do que ganho.',
					],
				},
				{
					name: 'MED — peso corporal em régua menor',
					what: 'Profundidade mínima · peso corporal',
					spec: {
						work: '10s',
						sets: '3',
						setRest: '3 min',
						load: 'peso corporal',
						note: 'Menor régua que aguentar (<b>MED</b> da López).',
					},
					why: ['<b>MED</b> da López: diminua a régua em vez de adicionar peso.'],
				},
				{
					name: 'MAW — 18–20mm + peso',
					what: 'Peso adicional · 18–20mm',
					spec: {
						work: '10s',
						sets: '3',
						setRest: '3 min',
						edge: '18–20mm',
						load: '+ peso',
						note: '2–3s de margem (<b>MAW</b> da López).',
					},
					why: ['<b>MAW</b> da López: adicione peso numa régua mais amigável.'],
				},
				{
					name: 'Levantamento máximo no no-hang block (10s)',
					what: 'Máximo no no-hang block',
					spec: {
						work: '10s',
						sets: '3',
						setRest: '3 min',
						note: 'Levantadas quase máximas no block.',
					},
					why: ['Força máxima amigável às polias, que dá pra carregar com precisão.'],
				},
			],
		},
		density: {
			cat: 'Tecido',
			catVar: '--teal',
			variants: [
				{
					name: 'Density Hangs',
					what: 'Sustentações longas perto da falha',
					spec: {
						work: '20–40s perto da falha',
						sets: '5–6',
						setRest: '3 min',
						intensity: '~70–75% MVC',
						note: 'Half-crimp.',
					},
					why: [
						'Seu principal investimento em tecido conjuntivo. Aumenta a rigidez do músculo e da JMT e <b>reduz</b> a rigidez tendínea patológica — no saldo, um sistema mais resistente a lesão (Nelson).',
					],
				},
				{
					name: 'Density hangs (mão aberta)',
					what: 'Mão aberta · sustentações longas',
					spec: {
						work: '20–40s perto da falha',
						sets: '5–6',
						setRest: '3 min',
						note: 'Mão aberta.',
					},
					why: ['Mesmo estímulo de tecido deslocado pra mão aberta.'],
				},
				{
					name: 'Levantamento de densidade no no-hang block',
					what: 'No-hang block',
					spec: {
						work: '20–40s perto da falha',
						sets: '5–6',
						setRest: '3 min',
						note: 'Sustentações no no-hang block.',
					},
					why: ['Carga de densidade amigável às polias.'],
				},
				{
					name: 'Repeaters longos @ % baixo',
					what: 'Repeaters longos de % baixo',
					spec: {
						work: 'on/off longo',
						sets: 'várias',
						intensity: '~50–60%',
						note: 'Acumula tempo de tecido sob carga com pico de força baixo.',
					},
					why: ['Acumula tempo de tecido sob carga com pico de força baixo.'],
				},
			],
		},
		abra: {
			cat: 'Tecido',
			catVar: '--teal',
			variants: [
				{
					name: 'Abrahangs (carga baixa)',
					what: 'De manhã · 18–22mm · pés no chão',
					spec: {
						work: '~20 ×10s entre pegadas',
						edge: '18–22mm',
						intensity: '~40% máx',
						note: '"Só tensão leve" · ~10 min no total · ≥6h do trabalho pesado.',
					},
					why: [
						'Complementa o trabalho máximo pela saúde do tecido (Gilmore/Baar 2024). Na sua força, mantenha bem <b>leves</b> — erre pra baixo de 40%.',
						'Isto é treino, não descanso — corte <b>estes</b> primeiro a qualquer incômodo.',
					],
				},
				{
					name: 'Sustentações leves no no-hang block',
					what: 'No-hang · leve',
					spec: {
						work: '10s',
						reps: '~20 entre pegadas',
						intensity: '~40%',
						note: 'Pés apoiados.',
					},
					why: ['Versão no-hang — fácil de manter genuinamente leve.'],
				},
				{
					name: 'Repeaters longos de % baixo',
					what: 'Repeaters de % baixo',
					spec: {
						work: '~10 min',
						intensity: 'bem abaixo do duro',
						note: 'Repeaters longos e bem leves.',
					},
					why: ['Estímulo de circulação / colágeno sem fadiga relevante.'],
				},
				{
					name: 'Pule — descanso extra se estiver cansado',
					what: 'Pular / descansar',
					spec: {
						note: 'Largue a sessão e descanse se estiver com fadiga ou incômodo.',
					},
					why: ['Estes são complementares — corte primeiro quando cansado ou sensível.'],
				},
			],
		},
		antag: {
			cat: 'Prevenção',
			catVar: '--teal',
			variants: [
				{
					name: 'Antagonistas',
					what: '~10 min · seguro pro cotovelo + polias',
					spec: {
						work: '~10 min',
						note: 'Flexão de punho reversa 3×15 · extensão de dedo com elástico 3×20–30 · pronação/supinação 3×12 · flexões/dips.',
					},
					why: ['Essencial pela sua dominância flexora — protege cotovelos e polias.'],
				},
				{
					name: 'Balde de arroz + elásticos extensores',
					what: 'Balde de arroz + elásticos',
					spec: {
						work: '5–8 min',
						reps: '3×20–30 extensões',
						note: 'Balde de arroz + extensão de dedo com elástico.',
					},
					why: ['Trabalho de baixo esforço pra extensores e resistência de antebraço.'],
				},
				{
					name: 'Só extensão de dedo com Theraband',
					what: 'Extensões com elástico',
					spec: {
						reps: '3–4×20–30',
						note: 'Equilíbrio de extensores pra fazer todo dia.',
					},
					why: ['Equilíbrio mínimo de extensores quando o tempo é curto.'],
				},
				{
					name: 'Circuito de empurrar / pronação',
					what: 'Empurrar + pronação',
					spec: {
						reps: '3×12',
						work: '8–10 min',
						note: 'Flexões / dips + pronação/supinação.',
					},
					why: ['Equilíbrio de empurrar + rotação pra ombros e cotovelos.'],
				},
			],
		},
		perform: {
			cat: 'Técnica',
			catVar: '--flag',
			variants: [
				{
					name: 'Rocha / Performance',
					what: 'Hangboard = só aquecimento',
					spec: {
						note: 'Sua escalada real mais difícil da semana · aquecimento completo · cabeça de send.',
					},
					why: ['Em janela de send, o hangboard vira só ferramenta de aquecimento (Hörst).'],
				},
				{
					name: 'Dia de performance forte no ginásio',
					what: 'Performance no ginásio',
					spec: {
						note: 'Escalada mais difícil do ginásio · aquecimento completo · tentativas de send de verdade.',
					},
					why: ['Estímulo de performance quando não dá pra ir na rocha.'],
				},
				{
					name: 'Sessão flash estilo competição',
					what: 'Sessão flash',
					spec: {
						note: 'Onsight / flash numa variedade de problemas · pouca preparação por problema.',
					},
					why: ['Treina leitura e execução de primeira.'],
				},
				{
					name: 'Dia longo de vários boulders na rocha',
					what: 'Volume na rocha',
					spec: {
						note: 'Muitos boulders ao longo do dia · cuide da pele e da energia.',
					},
					why: ['Rodagem e técnica de qualidade na rocha.'],
				},
			],
		},
		rest: {
			cat: 'Recuperação',
			catVar: '--ink-faint',
			variants: [
				{
					name: 'Descanso Total',
					what: 'Sem carga nos dedos',
					spec: {
						note: 'Caminhe · mobilidade · durma · coma. A adaptação acontece agora, não na parede.',
					},
					why: ['Mesmo no seu nível, o teto é ~3 dias de alto SNC por semana. Inegociável.'],
				},
				{
					name: 'Só caminhada leve + mobilidade',
					what: 'Caminhada + mobilidade',
					spec: {
						work: '10–15 min mobilidade',
						note: 'Caminhada leve · sem carga de pegada.',
					},
					why: ['Recuperação ativa que não sobrecarrega os dedos.'],
				},
				{
					name: 'Aeróbico leve (sem pegada)',
					what: 'Aeróbico leve',
					spec: {
						work: '20–40 min',
						intensity: 'ritmo de conversa',
						note: 'Cardio leve · sem pegada.',
					},
					why: ['Favorece recuperação e base aeróbica sem carga nos dedos.'],
				},
				{
					name: 'Abrahangs leves só se estiver doido pra mexer',
					what: 'Abrahangs leves',
					spec: {
						intensity: 'bem abaixo de 40%',
						note: 'Abrahangs bem leves só se for necessário.',
					},
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
			desc: 'Melhor levantamento de pinch block de 7 segundos. Teste cada braço.',
		},
		{
			id: 'pull',
			name: 'Tração com Peso',
			abbr: 'TRAÇÃO',
			cat: '--violet',
			unit: 'kg adicionais',
			desc: 'Melhor barra/chin-up com peso numa rep limpa.',
		},
		{
			id: 'maxhang',
			name: 'Max Hang',
			abbr: 'MAXHANG',
			cat: '--violet',
			unit: 'kg @ 10mm',
			desc: 'Referência de manutenção — peso adicional, 10s, régua de 10mm.',
		},
		{
			id: 'density',
			name: 'Sustentação de Densidade',
			abbr: 'DENSIDADE',
			cat: '--teal',
			unit: 'seg @ carga',
			desc: 'Maior sustentação de densidade com qualidade na carga de trabalho — proxy da capacidade do tecido.',
		},
	],
	quiz: [
		{
			id: 'recovery',
			q: 'Quão recuperado você se sente?',
			a: [
				{ t: 'Inteiro e ligado', v: 2 },
				{ t: 'Normal', v: 1 },
				{ t: 'Meio apagado', v: 0 },
				{ t: 'Detonado / dolorido', v: -2 },
			],
		},
		{
			id: 'fingers',
			q: 'Como estão os dedos?',
			a: [
				{ t: '100% — sem incômodo', v: 2 },
				{ t: 'Ok, leve rigidez', v: 1 },
				{ t: 'Sensível numa articulação/polia', v: -2 },
				{ t: 'Dor aguda em algum ponto', v: -5 },
			],
		},
		{
			id: 'slot',
			q: 'Quanto tempo você tem hoje?',
			a: [
				{ t: 'Sessão grande, tempo de sobra', v: 2 },
				{ t: 'Sessão normal', v: 1 },
				{ t: 'Curta — 30–45 min', v: 0 },
				{ t: 'Quase nada', v: -1 },
			],
		},
		{
			id: 'skin',
			q: 'Pele e SNC / disposição?',
			a: [
				{ t: 'Pele boa, me sentindo afiado', v: 2 },
				{ t: 'Ok', v: 1 },
				{ t: 'Pele fina / pouca disposição', v: -1 },
				{ t: 'Os dois no chão', v: -2 },
			],
		},
	],
	verdicts: {
		rest: {
			title: 'Pare — descanse os dedos',
			tag: 'Protocolo de dor',
			color: 'var(--flag)',
			text: 'Dor aguda no dedo é parada obrigatória. <b>Nada de carga hoje.</b> Lesão de polia é ~60% das lesões de dedo e vem justamente de forçar nessas horas. Se passar de 3–5 dias, procure um profissional. Hoje: mobilidade leve, sono e comida.',
			focus: ['DESCANSO', 'avaliar', 'sem hangboard'],
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
			text: 'Inteiro, dedos bons, tempo e pele de sobra. Manda um <b>dia duro</b>: recruitment pulls emendando em <b>boulder no limite</b>, ou um dia de tração pesada. Descanse de verdade entre os esforços máximos. Tome colágeno ~60 min antes: 15g de colágeno + 50mg de vit. C.',
			focus: ['recruitment pulls', 'boulder no limite', 'tração pesada'],
		},
	},
	phases: {
		phase1: {
			name: 'Fase 1 · Capacidade & Base de Tecido (Sem 1–4)',
			banner:
				'Construa qualidade de recruitment, fixe o máximo de pinça de 7s, suba o volume de repeaters, ganhe volume de tração + negativas de OAP, densidade completa. Colágeno + vit. C ~60 min antes da sessão de dedo mais pesada.',
			cat: '--gold',
		},
		phase2: {
			name: 'Fase 2 · Expressão & Pico (Sem 5–7)',
			banner:
				'Enfatize força de contato em agarras piores; pinça mais estreita; corte séries de repeaters pra manter a potência; tração vai pra menos reps / mais carga. Max hangs seguem no mínimo.',
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
