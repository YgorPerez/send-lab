import type { Content } from './types';

const content: Content = {
	days: [
		{
			k: 'Mon',
			label: 'Mon',
			type: 'Limit / Power',
			prime: 'Recruitment pulls → Limit bouldering',
			sec: 'Contact strength / RFD, then hardest problems',
			load: 'HIGH',
			color: 'var(--flag)',
			ex: ['recruit', 'limitboulder'],
		},
		{
			k: 'Tue',
			label: 'Tue',
			type: 'Pinch / Wrist',
			prime: 'Pinch block + Wrist / Sloper',
			sec: 'Abrahangs AM · antagonists',
			load: 'MOD',
			color: 'var(--gold)',
			ex: ['pinch', 'wrist', 'abra', 'antag'],
		},
		{
			k: 'Wed',
			label: 'Wed',
			type: 'Endurance',
			prime: '7/3 Repeaters → Sport climbing',
			sec: 'Strength-endurance, critical force, pump',
			load: 'HIGH',
			color: 'var(--flag)',
			ex: ['repeaters', 'sport'],
		},
		{
			k: 'Thu',
			label: 'Thu',
			type: 'Pull',
			prime: 'Heavy pull day + Sloper density',
			sec: 'Weighted pull-ups, OAP · Abrahangs AM',
			load: 'MOD',
			color: 'var(--violet)',
			ex: ['pull', 'slopdens', 'abra', 'antag'],
		},
		{
			k: 'Fri',
			label: 'Fri',
			type: 'Max / Tissue',
			prime: 'Max hangs (maintenance) + Density',
			sec: 'Tissue investment, MTJ density',
			load: 'MOD',
			color: 'var(--teal)',
			ex: ['maxhang', 'density'],
		},
		{
			k: 'Sat',
			label: 'Sat',
			type: 'Performance',
			prime: 'Outdoor / Performance',
			sec: 'Hangboard = warm-up only',
			load: 'HIGH',
			color: 'var(--flag)',
			ex: ['perform'],
		},
		{
			k: 'Sun',
			label: 'Sun',
			type: 'Rest',
			prime: 'Full rest',
			sec: 'No finger loading · walk / mobility',
			load: 'OFF',
			color: 'var(--ink-faint)',
			ex: ['rest'],
		},
	],
	exercises: {
		recruit: {
			cat: 'RFD / Contact',
			catVar: '--flag',
			variants: [
				{
					name: 'Recruitment Pulls',
					what: '1-arm · ~20mm or flat edge',
					spec: {
						work: '3–5s max pull',
						rest: '5s',
						reps: '4/side',
						sets: '2–3',
						edge: '~20mm',
						note: 'Fast, explosive force build.',
					},
					why: [
						"Highest-yield finger stimulus once you're already strong — trains <b>rate of force development</b> and contact strength with very little fatigue.",
						'Tyler Nelson: at high levels, force <b>application</b> matters more than more max force.',
					],
				},
				{
					name: 'Campus-board controlled max touches',
					what: 'Controlled max-reach touches',
					spec: {
						reps: '4–6/side',
						sets: '3–4',
						setRest: 'full',
						note: 'Precise max touches to a fixed rung — quality over sloppy campusing.',
					},
					why: ['Same recruitment intent with a controlled catch — quality over sloppy campusing.'],
				},
				{
					name: 'Lattice-block one-arm max lifts',
					what: 'One-arm block pull · ~20mm',
					spec: {
						work: '3–5s near-max',
						reps: '4/side',
						rest: '5s',
						sets: '2–3',
						edge: '~20mm',
						note: 'One-arm lift on a block.',
					},
					why: ['Device-measured pulls load precisely and let you track contact force.'],
				},
				{
					name: 'Heavy first-move limit attempts',
					what: 'Hard first moves off the ground',
					spec: {
						reps: '6–10 quality goes',
						setRest: 'full',
						note: 'Repeated max attempts at a hard first move.',
					},
					why: ['Recruitment expressed on real holds — maximal pulls into one hard move.'],
				},
			],
		},
		limitboulder: {
			cat: 'Power / Skill',
			catVar: '--flag',
			variants: [
				{
					name: 'Limit Bouldering',
					what: 'Hardest problems · long rests',
					spec: {
						sets: '4–6 problems',
						setRest: '3–5 min',
						note: 'Prioritise crimp / contact moves. Quality over quantity.',
					},
					why: [
						'Where strength becomes climbing. Quality over quantity — rest fully between attempts.',
					],
				},
				{
					name: 'Moonboard / Kilter limit problems',
					what: 'Board limit problems',
					spec: {
						sets: '4–6 problems',
						setRest: '3–5 min',
						note: 'Crimp-heavy board benchmarks.',
					},
					why: ['Standardised holds make limit power repeatable and trackable.'],
				},
				{
					name: 'Hard 4×4-style power problems',
					what: 'Power circuits near limit',
					spec: {
						sets: '4 problems ×4 rounds',
						rest: 'short within',
						setRest: 'long between',
						note: 'Adds a power-endurance edge near limit.',
					},
					why: ['Adds a power-endurance edge while staying near limit strength.'],
				},
				{
					name: 'Outdoor boulder project session',
					what: 'Rock project',
					spec: {
						setRest: 'generous',
						note: 'Full warm-up · work a true project.',
					},
					why: ["Real rock recruits power and skill the gym can't replicate."],
				},
			],
		},
		pinch: {
			cat: 'Pinch',
			catVar: '--gold',
			variants: [
				{
					name: 'Pinch Block — Max',
					what: 'One thumb-pad-depth block',
					spec: {
						work: '7–10s',
						sets: '5–7',
						setRest: '3 min',
						rest: '30s between arms',
						intensity: '~90% 7s max',
						note: 'Shoulders retracted, arm by side, lift with legs.',
					},
					why: [
						"Shoulders retracted, arm by side, lift with legs. <b>Never</b> front-facing pinch hangs — De Quervain's risk (López).",
						'Rotate block width across the 8 weeks; go narrower / pads-only in Phase 2.',
					],
				},
				{
					name: 'Two-hand pinch deadlift on bar',
					what: 'Two-hand pinch off the floor',
					spec: {
						work: '5–7s near-max',
						sets: '4–5',
						setRest: '3 min',
						note: 'Two-hand pinch lift off the floor.',
					},
					why: ['Heavier loading with two hands — great for raw pinch strength.'],
				},
				{
					name: 'Wide-pinch hangs on a 40°+ board',
					what: 'Wide pinches on a steep board',
					spec: {
						sets: '4–6 efforts',
						setRest: 'full',
						intensity: 'sub-max',
						note: 'Hold / move on wide pinches.',
					},
					why: ['Trains thumb opposition in a climbing-specific position.'],
				},
				{
					name: 'Rockstar / Tension pinch rail max',
					what: 'Commercial pinch rail',
					spec: {
						work: '7–10s max',
						sets: '4–5',
						note: 'Max lifts per width; rotate widths.',
					},
					why: ['A repeatable pinch rail makes loading and tracking easy.'],
				},
			],
		},
		wrist: {
			cat: 'Wrist / Slopers',
			catVar: '--gold',
			variants: [
				{
					name: 'Wrist / Sloper Strength',
					what: 'Wrist-wrench / radial lifts',
					spec: {
						work: '20–40s to failure',
						sets: '3–5',
						setRest: '2 min',
						intensity: '65–75% max',
						note: 'Hypertrophy dose for FCR + wrist stabilisers.',
					},
					why: [
						'Builds FCR + wrist stabilisers for slopers and compression demand.',
						'Ferrer-Uris 2023: 60mm sloper ≈ half-crimp FDP activation, with <b>better</b> FCR/FDS and lower injury risk.',
					],
				},
				{
					name: 'Big-sloper density hangs (60mm)',
					what: '60mm sloper · open hand',
					spec: {
						work: '30–45s',
						sets: '3–4',
						edge: '60mm',
						note: '2 arms · open-hand.',
					},
					why: ['Loads the wrist + FCR in a sloper position with low pulley cost.'],
				},
				{
					name: 'Reverse + standard wrist curls (heavy)',
					what: 'Loaded wrist curls',
					spec: {
						sets: '3–4',
						reps: '10–15 each way',
						setRest: '2 min',
						note: 'Heavy, scalable wrist hypertrophy.',
					},
					why: ['Direct, scalable wrist hypertrophy for elbow and wrist resilience.'],
				},
				{
					name: 'Compression board / pinch-sloper system',
					what: 'Compression holds',
					spec: {
						sets: '4–6 efforts',
						intensity: 'sub-max',
						note: 'Holds / moves on compression features.',
					},
					why: ['Trains wrist stability under compression demand.'],
				},
			],
		},
		repeaters: {
			cat: 'Endurance / CF',
			catVar: '--gold',
			variants: [
				{
					name: '7/3 Repeaters',
					what: '20mm · half-crimp + open hand',
					spec: {
						work: '7s on / 3s off ×6',
						sets: '3–4/grip',
						setRest: '3 min',
						edge: '20mm',
						intensity: '~60% MVC',
						note: '2 grips: half-crimp + open hand.',
					},
					why: [
						'Builds glycolytic capacity, pump resistance, <b>critical force</b> — your likely real gap given how strong your max is.',
						'Phase 2: drop to 2–3 sets/grip @ ~65–70% to stay snappy for weekends.',
					],
				},
				{
					name: '6:10 repeaters (longer recovery)',
					what: '6s on / 10s off',
					spec: {
						work: '6s on / 10s off ×6',
						sets: '3–4/grip',
						setRest: '3 min',
						intensity: '~60% MVC',
						note: 'Longer rests bias aerobic capacity over glycolytic stress.',
					},
					why: ['Longer rests bias aerobic capacity over glycolytic stress.'],
				},
				{
					name: 'Critical-force protocol (4s/4s to failure)',
					what: '4s on / 4s off to failure',
					spec: {
						work: '4s on / 4s off to failure',
						sets: '2–3 grips',
						setRest: 'full',
						note: 'Until force settles to steady state.',
					},
					why: ['Directly probes and builds your <b>critical force</b> floor.'],
				},
				{
					name: 'On-the-wall lap intervals / boulder 4×4',
					what: 'Wall laps / 4×4',
					spec: {
						sets: 'laps or 4 problems ×4',
						note: 'Sub-limit · build a pump, stop before failure.',
					},
					why: ['Transfers repeater capacity to real movement.'],
				},
			],
		},
		sport: {
			cat: 'Endurance / CF',
			catVar: '--gold',
			variants: [
				{
					name: 'Sport Climbing / Board Laps',
					what: 'Sub-maximal, controlled pump',
					spec: {
						note: 'Routes or board laps · build a pump but never to failure.',
					},
					why: ['Translates the repeater stimulus to real movement and aerobic capacity.'],
				},
				{
					name: 'Sport routes / auto-belay laps',
					what: 'Route mileage',
					spec: {
						sets: '4–8 laps',
						note: 'Continuous easy–moderate routes · rest as needed.',
					},
					why: ['Aerobic base on real routes — keep the effort moderate.'],
				},
				{
					name: 'Board climbing volume (easy angle)',
					what: 'Easy-angle volume',
					spec: {
						work: '20–30 min',
						note: 'Many easy board problems · steady pump.',
					},
					why: ['High-volume movement quality and capillarity.'],
				},
				{
					name: 'Circuit / ARC traversing 2×15–20 min',
					what: 'ARC traverse',
					spec: {
						work: '2×15–20 min',
						intensity: 'light pump only',
						note: 'Continuous easy traversing (<b>ARC</b>).',
					},
					why: ['Classic <b>ARC</b> work for endurance base and recovery.'],
				},
			],
		},
		pull: {
			cat: 'Pull power',
			catVar: '--violet',
			variants: [
				{
					name: 'Heavy Pull Day',
					what: 'Weighted pull-ups + OAP work',
					spec: {
						sets: '4–6',
						reps: '3–5',
						load: '~+30–45kg',
						note: 'Hard but clean · OAP negatives / assisted 3–4 sets/side.',
					},
					why: [
						'On a low-finger-cost day on purpose — pulling power without grinding skin or pulleys.',
						'Phase 2: shift toward lower reps / higher load or more OAP skill work.',
					],
				},
				{
					name: 'One-arm pull-up skill ladder',
					what: 'OAP progressions',
					spec: {
						sets: '4–5/side',
						setRest: 'full',
						note: 'Assisted → negatives → singles.',
					},
					why: ['Builds toward the one-arm pull with high neural demand and low finger cost.'],
				},
				{
					name: 'Frenchies / tempo weighted pulls',
					what: 'Tempo + isometric holds',
					spec: {
						sets: '3–4',
						note: 'Frenchies (pause 90° / full lock) or tempo weighted pulls.',
					},
					why: ['Adds time-under-tension and lock-off strength.'],
				},
				{
					name: 'Front-lever + weighted pull combo',
					what: 'Front-lever + pull',
					spec: {
						sets: '3–4',
						note: 'Front-lever progressions + weighted pulls.',
					},
					why: ['Core-driven pulling power for steep terrain.'],
				},
			],
		},
		slopdens: {
			cat: 'Tissue',
			catVar: '--teal',
			variants: [
				{
					name: 'Sloper Density Hangs',
					what: 'Bottom edge of a sloper',
					spec: {
						work: '30–45s',
						sets: '3',
						note: '2 arms · open-hand position.',
					},
					why: ["Open-hand tissue work that doesn't tax pulleys — pairs well after the pull day."],
				},
				{
					name: 'Open-hand 35mm density hangs',
					what: '35mm · open hand',
					spec: {
						work: '30–45s near-sub-max',
						sets: '3',
						edge: '35mm',
						note: '2 arms · open hand.',
					},
					why: ['Open-hand tissue load on a defined edge.'],
				},
				{
					name: 'Big-rung repeaters (open hand)',
					what: 'Big rung · open hand',
					spec: {
						sets: '3',
						intensity: 'low %',
						note: 'Long repeaters on a big rung.',
					},
					why: ['Tissue volume with minimal pulley stress.'],
				},
				{
					name: 'No-hang open-hand long holds',
					what: 'No-hang block · open hand',
					spec: {
						work: '30–45s',
						sets: '3',
						note: '2 arms · no-hang block.',
					},
					why: ['Easy to load and pulley-friendly — great for tweaky days.'],
				},
			],
		},
		maxhang: {
			cat: 'Max strength',
			catVar: '--violet',
			variants: [
				{
					name: 'Max Hangs — Maintenance',
					what: 'Short dose · ~10mm edge',
					spec: {
						work: '10s',
						sets: '3',
						setRest: '3 min',
						edge: '~10mm',
						note: 'Leave a 2–3s margin (López <b>MAW</b>/<b>MED</b>, minimal).',
					},
					why: [
						"You're <b>maintaining</b>, not chasing PRs — your max is near ceiling and extra volume here is mostly injury cost.",
					],
				},
				{
					name: 'MED — bodyweight on smaller edge',
					what: 'Minimum edge depth · bodyweight',
					spec: {
						work: '10s',
						sets: '3',
						setRest: '3 min',
						load: 'bodyweight',
						note: 'Smallest manageable edge (López <b>MED</b>).',
					},
					why: ['López <b>MED</b>: shrink the edge instead of adding weight.'],
				},
				{
					name: 'MAW — 18–20mm + added weight',
					what: 'Max added weight · 18–20mm',
					spec: {
						work: '10s',
						sets: '3',
						setRest: '3 min',
						edge: '18–20mm',
						load: '+ weight',
						note: '2–3s margin (López <b>MAW</b>).',
					},
					why: ['López <b>MAW</b>: add weight on a friendlier edge.'],
				},
				{
					name: 'No-hang max block lifts (10s)',
					what: 'No-hang block max',
					spec: {
						work: '10s',
						sets: '3',
						setRest: '3 min',
						note: 'Near-max block lifts.',
					},
					why: ['Pulley-friendly max strength you can load precisely.'],
				},
			],
		},
		density: {
			cat: 'Tissue',
			catVar: '--teal',
			variants: [
				{
					name: 'Density Hangs',
					what: 'Near-failure long holds',
					spec: {
						work: '20–40s near failure',
						sets: '5–6',
						setRest: '3 min',
						intensity: '~70–75% MVC',
						note: 'Half-crimp.',
					},
					why: [
						'Your main connective-tissue investment. Raises muscle + MTJ stiffness while <b>reducing</b> pathological tendon stiffness — a net more injury-resistant system (Nelson).',
					],
				},
				{
					name: 'Density hangs (open hand)',
					what: 'Open hand · long holds',
					spec: {
						work: '20–40s near failure',
						sets: '5–6',
						setRest: '3 min',
						note: 'Open-hand position.',
					},
					why: ['Same tissue stimulus shifted to the open-hand position.'],
				},
				{
					name: 'No-hang density block lifts',
					what: 'No-hang block',
					spec: {
						work: '20–40s near failure',
						sets: '5–6',
						setRest: '3 min',
						note: 'No-hang block holds.',
					},
					why: ['Pulley-friendly density loading.'],
				},
				{
					name: 'Long-duration repeaters @ low %',
					what: 'Low-% long repeaters',
					spec: {
						work: 'long on/off',
						sets: 'several',
						intensity: '~50–60%',
						note: 'Accumulates tissue time-under-load with low peak force.',
					},
					why: ['Accumulates tissue time-under-load with low peak force.'],
				},
			],
		},
		abra: {
			cat: 'Tissue',
			catVar: '--teal',
			variants: [
				{
					name: 'Abrahangs (low-load)',
					what: 'AM · 18–22mm · feet on floor',
					spec: {
						work: '~20 ×10s across grips',
						edge: '18–22mm',
						intensity: '~40% max',
						note: '"Light strain only" · ~10 min total · ≥6h from hard work.',
					},
					why: [
						'Additive to max work for tissue health (Gilmore/Baar 2024). At your strength, keep these genuinely <b>light</b> — err under 40%.',
						'These are training, not rest — drop them <b>first</b> at any tweak.',
					],
				},
				{
					name: 'Light no-hang block holds',
					what: 'No-hang · light',
					spec: {
						work: '10s',
						reps: '~20 across grips',
						intensity: '~40%',
						note: 'Feet supported.',
					},
					why: ['A no-hang version — easy to keep genuinely light.'],
				},
				{
					name: 'Low-% long repeaters',
					what: 'Low-% repeaters',
					spec: {
						work: '~10 min',
						intensity: 'well under hard',
						note: 'Long, very light repeaters.',
					},
					why: ['Blood-flow / collagen stimulus without meaningful fatigue.'],
				},
				{
					name: 'Skip — extra rest if fatigued',
					what: 'Skip / rest',
					spec: {
						note: 'Drop the session and rest if you are carrying fatigue or a niggle.',
					},
					why: ['These are additive — cut them first when tired or tweaky.'],
				},
			],
		},
		antag: {
			cat: 'Prehab',
			catVar: '--teal',
			variants: [
				{
					name: 'Antagonists',
					what: '~10 min · elbow + pulley insurance',
					spec: {
						work: '~10 min',
						note: 'Reverse wrist curls 3×15 · band finger extensions 3×20–30 · pronation/supination 3×12 · push-ups/dips.',
					},
					why: ['Essential given your flexor dominance — protects elbows and pulleys.'],
				},
				{
					name: 'Rice-bucket + extensor bands',
					what: 'Rice bucket + bands',
					spec: {
						work: '5–8 min',
						reps: '3×20–30 extensions',
						note: 'Rice-bucket + band finger extensions.',
					},
					why: ['Low-effort extensor and forearm endurance work.'],
				},
				{
					name: 'Theraband finger extensions only',
					what: 'Band extensions',
					spec: {
						reps: '3–4×20–30',
						note: 'Daily-friendly extensor balance.',
					},
					why: ['Minimal-dose extensor balance when short on time.'],
				},
				{
					name: 'Push/pronation circuit',
					what: 'Push + pronation',
					spec: {
						reps: '3×12',
						work: '8–10 min',
						note: 'Push-ups / dips + pronation/supination.',
					},
					why: ['Pushing + rotation balance for shoulders and elbows.'],
				},
			],
		},
		perform: {
			cat: 'Skill',
			catVar: '--flag',
			variants: [
				{
					name: 'Outdoor / Performance',
					what: 'Hangboard = warm-up only',
					spec: {
						note: 'Your hardest real climbing of the week · full warm-up · send mindset.',
					},
					why: ['During send windows the hangboard drops to a warm-up tool (Hörst).'],
				},
				{
					name: 'Hard gym performance day',
					what: 'Gym performance',
					spec: {
						note: 'Hardest gym climbing · full warm-up · real send attempts.',
					},
					why: ["A performance stimulus when rock isn't an option."],
				},
				{
					name: 'Comp-style flash session',
					what: 'Flash session',
					spec: {
						note: 'Onsight / flash a spread of problems · short prep per problem.',
					},
					why: ['Trains reading and first-go execution.'],
				},
				{
					name: 'Long multi-boulder outdoor day',
					what: 'Volume on rock',
					spec: {
						note: 'Many boulders across the day · manage skin and energy.',
					},
					why: ['High-quality outdoor mileage and skill.'],
				},
			],
		},
		rest: {
			cat: 'Recovery',
			catVar: '--ink-faint',
			variants: [
				{
					name: 'Full Rest',
					what: 'No finger loading',
					spec: {
						note: 'Walk · mobility · sleep · eat. Adaptation happens now, not on the wall.',
					},
					why: ['Even at your level the cap is ~3 high-CNS days/week. This is non-negotiable.'],
				},
				{
					name: 'Light walk + mobility only',
					what: 'Walk + mobility',
					spec: {
						work: '10–15 min mobility',
						note: 'Easy walk · no grip load.',
					},
					why: ["Active recovery that doesn't tax the fingers."],
				},
				{
					name: 'Easy aerobic (no grip)',
					what: 'Easy aerobic',
					spec: {
						work: '20–40 min',
						intensity: 'conversational',
						note: 'Easy cardio · no grip.',
					},
					why: ['Promotes recovery and aerobic base without finger load.'],
				},
				{
					name: 'Gentle Abrahangs only if itching to move',
					what: 'Gentle Abrahangs',
					spec: {
						intensity: 'well under 40%',
						note: 'Very light Abrahangs only if you must.',
					},
					why: ['The most you should do on a rest day, and only if fresh.'],
				},
			],
		},
	},
	metrics: [
		{
			id: 'rfd',
			name: 'Rate of Force Dev',
			abbr: 'RFD',
			cat: '--flag',
			unit: '%/100ms',
			desc: 'How fast you reach peak force. Test: max recruitment pull, note time-to-peak feel or device value.',
		},
		{
			id: 'contact',
			name: 'Contact Strength',
			abbr: 'CONTACT',
			cat: '--flag',
			unit: 'kg / edge',
			desc: 'Force you catch instantly on small holds. Test: heaviest 3s recruitment pull on a fixed edge.',
		},
		{
			id: 'cf',
			name: 'Critical Force',
			abbr: 'CF',
			cat: '--gold',
			unit: '% MVC',
			desc: 'Sustainable force floor — your endurance ceiling. Test: repeater protocol to failure.',
		},
		{
			id: 'pinch',
			name: 'Pinch Max',
			abbr: 'PINCH',
			cat: '--gold',
			unit: 'kg / 7s',
			desc: 'Best 7-second pinch-block lift. Test each arm.',
		},
		{
			id: 'pull',
			name: 'Weighted Pull',
			abbr: 'PULL',
			cat: '--violet',
			unit: 'kg added',
			desc: 'Top weighted chin/pull-up for a clean rep.',
		},
		{
			id: 'maxhang',
			name: 'Max Hang',
			abbr: 'MAXHANG',
			cat: '--violet',
			unit: 'kg @ 10mm',
			desc: 'Maintenance benchmark — added weight, 10s, 10mm.',
		},
		{
			id: 'density',
			name: 'Density Hold',
			abbr: 'DENSITY',
			cat: '--teal',
			unit: 'sec @ load',
			desc: 'Longest quality density hold at working load — tissue capacity proxy.',
		},
	],
	quiz: [
		{
			id: 'recovery',
			q: 'How recovered do you feel?',
			a: [
				{ t: 'Fresh & fired up', v: 2 },
				{ t: 'Normal', v: 1 },
				{ t: 'A bit flat', v: 0 },
				{ t: 'Wrecked / sore', v: -2 },
			],
		},
		{
			id: 'fingers',
			q: 'How do your fingers feel?',
			a: [
				{ t: '100% — no niggles', v: 2 },
				{ t: 'Fine, slight stiffness', v: 1 },
				{ t: 'Tender on a knuckle/pulley', v: -2 },
				{ t: 'Sharp pain anywhere', v: -5 },
			],
		},
		{
			id: 'slot',
			q: "What's the slot today?",
			a: [
				{ t: 'Big session, lots of time', v: 2 },
				{ t: 'Standard session', v: 1 },
				{ t: 'Short — 30–45 min', v: 0 },
				{ t: 'Almost no time', v: -1 },
			],
		},
		{
			id: 'skin',
			q: 'Skin & CNS / drive?',
			a: [
				{ t: 'Skin good, feeling sharp', v: 2 },
				{ t: 'Okay', v: 1 },
				{ t: 'Thin skin / low drive', v: -1 },
				{ t: 'Both shot', v: -2 },
			],
		},
	],
	verdicts: {
		rest: {
			title: 'Stop — rest the fingers',
			tag: 'Pain protocol',
			color: 'var(--flag)',
			text: 'Sharp finger pain is a hard stop. <b>No loading today.</b> Pulley injuries are ~60% of finger injuries and driven by pushing through exactly this. If it persists past 3–5 days, get it assessed. Today: gentle mobility, sleep, food.',
			focus: ['REST', 'assess', 'no hangboard'],
		},
		tissue: {
			title: 'Tissue / recovery day',
			tag: 'Low load only',
			color: 'var(--teal)',
			text: "You're under-recovered or carrying a niggle. Run <b>low-load tissue work only</b>: light Abrahangs (well under 40%), antagonists, easy mobility. This is productive — connective tissue is your bottleneck anyway — and it protects the hard days.",
			focus: ['Abrahangs', 'antagonists', 'wrist mobility'],
		},
		moderate: {
			title: 'Moderate — endurance or grip-type',
			tag: 'Quality, not max',
			color: 'var(--gold)',
			text: 'Good enough to train, not to go to your limit. Best picks: <b>7/3 repeaters</b> for critical force, or a <b>pinch / wrist / sloper</b> session. Avoid maximal recruitment and limit bouldering today — save the CNS.',
			focus: ['repeaters', 'pinch', 'sloper', 'critical force'],
		},
		short: {
			title: 'Short & sharp — contact strength',
			tag: 'High value, low volume',
			color: 'var(--flag)',
			text: "You're fresh but short on time. Perfect for <b>recruitment pulls</b> — 2–3 sets trains RFD and contact strength in ~15 min with minimal fatigue. Warm up properly first; quality over quantity.",
			focus: ['recruitment pulls', 'RFD', 'contact strength'],
		},
		green: {
			title: 'Green light — go hard',
			tag: 'Limit / max day',
			color: 'var(--flag)',
			text: 'Fresh, fingers good, time and skin to spend. Run a <b>hard day</b>: recruitment pulls into <b>limit bouldering</b>, or a heavy pull day. Take full rests between maximal efforts. Fuel collagen ~60 min before: 15g collagen + 50mg vit C.',
			focus: ['recruitment pulls', 'limit bouldering', 'heavy pull'],
		},
	},
	phases: {
		phase1: {
			name: 'Phase 1 · Capacity & Tissue Base (Wk 1–4)',
			banner:
				'Build recruitment quality, establish pinch 7s max, higher repeater volume, build pull volume + OAP negatives, full density. Collagen + vit C ~60 min before heaviest finger session.',
			cat: '--gold',
		},
		phase2: {
			name: 'Phase 2 · Expression & Peaking (Wk 5–7)',
			banner:
				'Emphasise contact strength on worse holds; narrower pinch; cut repeater sets to stay powerful; pull shifts to lower-rep/higher-load. Max hangs stay minimal.',
			cat: '--flag',
		},
		deload: {
			name: 'Week 8 · Deload',
			banner:
				"Halve volume AND intensity. Two short hangboard sessions, big margins. Easy climbing only. KEEP light Abrahangs — true unloading costs ~10–20% tendon collagen in days (Baar). Adaptations surface now as fatigue clears. Retest at week's end.",
			cat: '--teal',
		},
	},
	glossary: {
		CNS: 'Central nervous system — the systemic fatigue that caps maximal, high-intensity efforts.',
		RFD: 'Rate of force development — how fast you reach peak force, not just how much.',
		MVC: 'Maximal voluntary contraction — your maximum force on a given grip.',
		MTJ: 'Muscle–tendon junction — where muscle transitions into tendon.',
		OAP: 'One-arm pull-up.',
		FCR: 'Flexor carpi radialis — a wrist flexor on the thumb side.',
		FDP: 'Flexor digitorum profundus — the deep finger flexor that drives crimping.',
		FDS: 'Flexor digitorum superficialis — a superficial finger flexor.',
		CF: 'Critical force — the highest force you can sustain almost indefinitely; your endurance floor.',
		MAW: 'Max Added Weight — a López hangboard protocol: fixed edge, add weight.',
		MED: 'Minimum Edge Depth — a López protocol: bodyweight on a progressively smaller edge.',
		ARC: 'Aerobic Restoration & Capillarity — easy continuous climbing to build an endurance base.',
		"De Quervain's": "De Quervain's tenosynovitis — irritation of the thumb-side wrist tendons.",
	},
};

export default content;
