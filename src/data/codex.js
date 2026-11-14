// The Mission Codex: short, plain-language explanations of every concept the game uses.
// `game` explains how the concept is modeled here; `real` gives a real-world anchor. CODEX_ID is Bahasa Indonesia.
import { getLang } from '../i18n.js';

export const CODEX = {
  segments: {
    title: 'The four mission segments',
    body: 'NASA describes every science mission as four segments working together: the launch segment (rocket), the space segment (spacecraft and instruments), the ground segment (antennas and mission control) and the user segment (the people who use the data).',
    game: 'Each role in this game owns one segment. A mission only succeeds when all four fit together.',
    real: 'From NASA\'s "Design and Develop Science Missions" overview.',
  },
  cml: {
    title: 'Concept Maturity Levels',
    body: 'Mission ideas mature step by step: a bare idea (CML 1), a feasible concept (CML 2–3), trade studies comparing options (CML 4), and finally a detailed point design. The biggest decisions happen early, when changes are cheap.',
    game: 'The game walks you through the same arc: objective, requirements, trade studies in the design room, then a Go/No-Go review.',
    real: 'Concept Maturity Levels were developed at NASA\'s Jet Propulsion Laboratory.',
  },
  requirements: {
    title: 'Requirements',
    body: 'A requirement is a measurable promise, such as "revisit the volcano once a day". Engineers derive requirements from the science objective, then check every design choice against them.',
    game: 'Your mission priority sets the requirements. The checklist updates live as you design.',
    real: 'NASA reviews check requirements again and again from concept to launch.',
  },
  'trade-off': {
    title: 'Trade-offs',
    body: 'Almost every improvement costs something else. A better instrument adds mass, power, data and cost. A trade study compares options to find the best balance, and there is rarely one perfect answer.',
    game: 'Hover over any option to preview how it shifts every budget before you commit.',
    real: 'NASA Goddard\'s Mission Design Lab runs trade studies to compare mission architectures in days.',
  },
  margin: {
    title: 'Margins',
    body: 'Designs always grow heavier and hungrier as they mature. Engineers keep spare mass and power ("margin") so surprises do not break the mission. Too little margin is risky; too much wastes money.',
    game: 'Gauges turn amber below 10% margin and red below zero. The sweet spot is 10–45%. Flight Director mode adds real mass growth before launch.',
    real: 'Early concepts typically carry around 30% mass margin.',
  },
  power: {
    title: 'Power budget',
    body: 'Solar arrays must power everything in sunlight AND recharge the battery for the next eclipse. Arrays also degrade over time from radiation, so engineers size them for end of life.',
    game: 'Required power uses the classic sizing equation: P = (load × eclipse / 0.65 + load × daylight / 0.85) / daylight. Array power = area × 1,361 W/m² × 29.5% efficiency × sun angle.',
    real: '1,361 W/m² is the solar constant: sunlight intensity at Earth\'s distance from the Sun.',
  },
  battery: {
    title: 'Batteries and depth of discharge',
    body: 'In eclipse the battery runs the spacecraft. Draining it deeply each orbit wears it out fast: a low-orbit satellite goes through about 5,500 eclipses a year.',
    game: 'Depth of discharge = eclipse energy ÷ usable capacity. Cycle life falls steeply with depth. Over 80% and instruments shut down in the dark.',
    real: 'That is why low-orbit satellites often use only 20–30% of their battery per orbit.',
  },
  'delta-v': {
    title: 'Delta-v',
    body: 'Delta-v is the total change in speed a spacecraft can make with its propellant. Every maneuver (braking into orbit, correcting drift, dodging debris, deorbiting) spends some of it.',
    game: 'Delta-v comes from the rocket equation: Δv = Isp × 9.81 × ln(wet mass ÷ dry mass). The Δv gauge compares it with insertion, station-keeping and disposal needs.',
    real: 'Braking into low lunar orbit takes roughly 0.9 km/s, which is why lunar orbiters carry so much fuel.',
  },
  isp: {
    title: 'Specific impulse (Isp)',
    body: 'Isp measures fuel efficiency: how long one kilogram of propellant can push. Cold gas ≈ 65 s, monopropellant ≈ 220 s, bipropellant ≈ 315 s, electric thrusters ≈ 1,600 s or more.',
    game: 'Higher Isp gives more delta-v per kilogram. Electric thrusters are very efficient but push gently, so maneuvers take months.',
    real: 'ESA\'s SMART-1 spiraled out to the Moon on an electric thruster over about a year.',
  },
  launch: {
    title: 'Launch vehicles',
    body: 'A rocket\'s capacity depends on the destination: the higher the energy, the less it can carry. Rideshares are cheap but go where the main passenger goes.',
    game: 'Capacity is listed per destination (LEO, SSO, GTO, deep space). The total fleet mass must fit.',
    real: 'NASA\'s Artemis I carried 10 CubeSats as rideshare passengers toward the Moon.',
  },
  kepler: {
    title: 'Orbital period',
    body: 'The higher the orbit, the slower and longer the trip around the planet. Kepler\'s third law links them: T = 2π √(a³ / μ).',
    game: 'Periods, orbits per day and eclipse lengths are computed from Kepler\'s law, the same physics used in NASA\'s General Mission Analysis Tool (GMAT).',
    real: 'The ISS circles Earth in about 92 minutes; a geostationary satellite takes exactly one day.',
  },
  sso: {
    title: 'Sun-synchronous orbit',
    body: 'A near-polar orbit tilted just enough that it passes over each place at the same local time every day. Same lighting every pass makes images easy to compare.',
    game: 'Sun-synchronous orbits cover the whole globe but pass a given spot only about twice a day.',
    real: 'Landsat, Terra and Aqua all fly sun-synchronous orbits.',
  },
  inclination: {
    title: 'Inclination and coverage',
    body: 'Inclination is the tilt of the orbit relative to the equator. A satellite never flies over latitudes higher than its inclination (plus what its sensor can see sideways).',
    game: 'A 6° orbit passes over Indonesia on nearly every orbit but cannot see Semeru (8° S) with a narrow sensor.',
    real: 'Indonesia\'s LAPAN-A2 used a 6° orbit to pass over the archipelago 14 times a day.',
  },
  resolution: {
    title: 'Ground resolution',
    body: 'Resolution is the size of the smallest detail a camera can see. The same camera sees coarser detail from farther away.',
    game: 'Resolution scales with altitude: an imager that sees 70 m from 500 km sees about 5 km from geostationary orbit.',
    real: 'Weather satellites in GEO trade detail for a constant view of a whole hemisphere.',
  },
  revisit: {
    title: 'Swath and revisit',
    body: 'The swath is the width of the strip a sensor sees. Narrow swaths give sharp images but leave gaps that take days to fill; wide swaths revisit often but see less detail.',
    game: 'Revisit = ground-track spacing ÷ swath. Thermal and radar sensors also work on night passes, halving the wait. More satellites divide it further.',
    real: 'Landsat (185 km swath) revisits every 16 days; MODIS (2,330 km) sees most places daily.',
  },
  clouds: {
    title: 'Clouds and the tropics',
    body: 'Visible and infrared light cannot pass through thick cloud, and tropical regions like Java are cloudy much of the year. Radar uses microwaves, which pass through clouds and work at night.',
    game: 'Passive imagers lose 25% of their value over Semeru. Radar does not.',
    real: 'The NASA–ISRO NISAR radar mission was designed to see through clouds, day and night.',
  },
  'data-rate': {
    title: 'Downlink and data budget',
    body: 'Instruments generate data all day, but it can only be sent home while a ground station is in view. Data rate × contact time sets how much comes home. Radio signals also weaken with the square of distance.',
    game: 'Data generated per day is compared with downlink capacity per day. Anything beyond capacity is lost.',
    real: 'NASA\'s Lunar Reconnaissance Orbiter sends up to 100 Mbps from the Moon using Ka-band.',
  },
  dsn: {
    title: 'Deep Space Network',
    body: 'NASA\'s Deep Space Network has giant dishes in California, Spain and Australia, about 120° apart, so any spacecraft beyond Earth orbit is always in view of one complex.',
    game: 'Lunar and L1 missions must use the DSN. Its time is shared among many missions, so you get scheduled passes, not a constant link.',
    real: 'The DSN talks to missions from the Moon to the Voyagers beyond the solar system.',
  },
  'rain-fade': {
    title: 'Rain fade',
    body: 'Heavy rain absorbs high-frequency radio waves. The higher the frequency (X-band, then Ka-band), the worse it gets, a real problem for tropical ground stations.',
    game: 'Ground-station storms can knock out a single station for days. Spreading passes across many stations avoids this single point of failure.',
    real: 'Operators add extra link margin, or extra stations, in rainy regions.',
  },
  attitude: {
    title: 'Attitude control and pointing',
    body: 'A spacecraft must point its instruments, arrays and antennas. Magnetorquers push against Earth\'s magnetic field (coarse, near Earth only). Reaction wheels spin to turn the craft precisely. Star trackers tell it exactly where it points.',
    game: 'Each instrument and antenna lists the pointing it needs. If attitude control is coarser, images smear and narrow radio beams miss Earth.',
    real: 'Far from Earth, reaction wheels dump their built-up spin with thruster firings.',
  },
  radiation: {
    title: 'Radiation',
    body: 'Charged particles from the Sun and Earth\'s radiation belts damage electronics over time and can flip bits in memory. Small satellites often use cheaper commercial parts with less protection.',
    game: 'Each bus has a radiation tolerance; each orbit has a yearly dose. GEO and deep space are harsher than low orbit.',
    real: 'Operators put spacecraft in safe mode during strong solar storms.',
  },
  lifetime: {
    title: 'Mission lifetime',
    body: 'A mission ends when its first critical resource runs out: fuel for station-keeping, battery cycles, radiation tolerance, or the orbit itself decaying.',
    game: 'Lifetime is the minimum of those limits. The Time gauge shows which one is limiting.',
    real: 'Many missions outlive their plans. Terra and Aqua were designed for six years and flew for more than twenty.',
  },
  mascons: {
    title: 'Lunar mascons',
    body: 'The Moon\'s gravity is lumpy because of dense "mass concentrations" under some craters. They gradually pull low orbits out of shape, so lunar orbiters must burn fuel regularly to stay up.',
    game: 'Low lunar orbit costs about 60 m/s of delta-v per year to maintain. Without it, orbits decay in months.',
    real: 'NASA\'s GRAIL mission mapped these mascons in detail.',
  },
  l1: {
    title: 'Lagrange point L1',
    body: 'L1 is a balance point 1.5 million km toward the Sun where a spacecraft keeps pace with Earth. It sees the Sun nonstop and samples the solar wind about an hour before it reaches Earth.',
    game: 'Orbits around L1 are unstable, so small station-keeping burns are needed every few months.',
    real: 'ACE, SOHO, DSCOVR, Aditya-L1 and IMAP all work near L1.',
  },
  debris: {
    title: 'Space debris',
    body: 'Dead satellites and fragments stay in orbit for decades above about 600 km. Responsible missions dodge risky conjunctions and leave orbit soon after they finish.',
    game: 'Low-orbit missions must re-enter within 5 years of mission end, or keep fuel to deorbit. GEO satellites boost to a "graveyard" orbit.',
    real: 'NASA usually maneuvers when the collision risk is worse than about 1 in 10,000.',
  },
  trl: {
    title: 'Technology Readiness Level (TRL)',
    body: 'TRL rates how proven a technology is, from 1 (an idea on paper) to 9 (flown successfully in space). Newer technology can be cheaper or better, but takes longer to qualify and is more likely to surprise you.',
    game: 'Components below TRL 9 add development months and raise the chance of in-flight glitches.',
    real: 'NASA developed the TRL scale in the 1970s; it is now used worldwide.',
  },
  cost: {
    title: 'Mission cost',
    body: 'Cost is not just hardware: integration and testing, the launch, ground stations and years of operations all add up. Agencies cap mission budgets, so cost is a hard constraint.',
    game: 'Total = hardware + 20% integration & test + launch + ground setup + operations × planned years. Fleets get a learning-curve discount.',
    real: 'NASA mission classes come with cost caps, such as the Discovery and SIMPLEx programs.',
  },
  constellation: {
    title: 'Constellations',
    body: 'Several identical satellites spread around an orbit can revisit a place far more often than one, and losing one does not end the mission.',
    game: 'Fleet size divides revisit time and multiplies passes, while cost and launch mass grow with every spacecraft.',
    real: 'NASA\'s TROPICS used small satellites to watch storms every hour or so.',
  },
  eclipse: {
    title: 'Eclipses',
    body: 'In low orbit a satellite spends up to about a third of every orbit in Earth\'s shadow: no sunlight, falling temperatures, and running on battery.',
    game: 'Eclipse length is computed from orbit geometry: fraction = arcsin(R ÷ (R + h)) ÷ π.',
    real: 'Dawn–dusk orbits ride the day–night line and avoid most eclipses.',
  },
};

export const CODEX_ID = {
  segments: {
    title: 'Empat segmen misi',
    body: 'NASA menggambarkan setiap misi sains sebagai empat segmen yang bekerja bersama: segmen peluncuran (roket), segmen antariksa (wahana dan instrumen), segmen darat (antena dan mission control), dan segmen pengguna (orang-orang yang memakai datanya).',
    game: 'Setiap peran di game ini memegang satu segmen. Misi hanya berhasil jika keempatnya cocok satu sama lain.',
    real: 'Dari ringkasan NASA "Design and Develop Science Missions".',
  },
  cml: {
    title: 'Concept Maturity Levels (tingkat kematangan konsep)',
    body: 'Ide misi matang setahap demi setahap: ide mentah (CML 1), konsep yang layak (CML 2–3), studi trade-off untuk membandingkan pilihan (CML 4), lalu desain titik yang rinci. Keputusan terbesar terjadi di awal, saat perubahan masih murah.',
    game: 'Game ini mengikuti alur yang sama: tujuan, requirement, studi trade-off di ruang desain, lalu tinjauan Go/No-Go.',
    real: 'Concept Maturity Levels dikembangkan di Jet Propulsion Laboratory NASA.',
  },
  requirements: {
    title: 'Requirement (persyaratan)',
    body: 'Requirement adalah janji yang bisa diukur, misalnya "kunjungi gunung api sekali sehari". Insinyur menurunkan requirement dari tujuan sains, lalu memeriksa setiap pilihan desain terhadapnya.',
    game: 'Prioritas misimu menentukan requirement. Daftar periksanya berubah langsung saat kamu mendesain.',
    real: 'Tinjauan NASA memeriksa requirement berulang kali dari konsep hingga peluncuran.',
  },
  'trade-off': {
    title: 'Trade-off (kompromi)',
    body: 'Hampir setiap peningkatan mengorbankan hal lain. Instrumen yang lebih baik menambah massa, daya, data, dan biaya. Studi trade-off membandingkan pilihan untuk mencari keseimbangan terbaik, dan jarang ada satu jawaban sempurna.',
    game: 'Arahkan kursor ke pilihan mana pun untuk melihat bagaimana ia mengubah setiap anggaran sebelum memutuskan.',
    real: 'Mission Design Lab di NASA Goddard menjalankan studi trade-off untuk membandingkan arsitektur misi dalam hitungan hari.',
  },
  margin: {
    title: 'Margin (cadangan)',
    body: 'Desain selalu bertambah berat dan boros seiring matangnya. Insinyur menyimpan massa dan daya cadangan ("margin") agar kejutan tidak merusak misi. Margin terlalu kecil berisiko; terlalu besar membuang uang.',
    game: 'Gauge menjadi kuning di bawah margin 10% dan merah di bawah nol. Titik idealnya 10–45%. Mode Flight Director menambahkan pertambahan massa sungguhan sebelum peluncuran.',
    real: 'Konsep awal biasanya membawa margin massa sekitar 30%.',
  },
  power: {
    title: 'Anggaran daya',
    body: 'Panel surya harus menyalakan semuanya saat terkena Matahari SEKALIGUS mengisi baterai untuk gerhana berikutnya. Panel juga menurun kinerjanya karena radiasi, jadi insinyur mengukurnya untuk akhir masa misi.',
    game: 'Daya yang dibutuhkan memakai persamaan klasik: P = (beban × gerhana / 0,65 + beban × siang / 0,85) / siang. Daya panel = luas × 1.361 W/m² × efisiensi 29,5% × sudut Matahari.',
    real: '1.361 W/m² adalah konstanta surya: intensitas sinar Matahari pada jarak Bumi dari Matahari.',
  },
  battery: {
    title: 'Baterai dan kedalaman pengosongan',
    body: 'Saat gerhana, baterai menjalankan wahana. Menguras baterai terlalu dalam setiap orbit membuatnya cepat aus: satelit orbit rendah mengalami sekitar 5.500 gerhana per tahun.',
    game: 'Kedalaman pengosongan = energi gerhana ÷ kapasitas pakai. Umur siklus turun tajam seiring kedalamannya. Di atas 80%, instrumen mati dalam gelap.',
    real: 'Itulah sebabnya satelit orbit rendah sering hanya memakai 20–30% baterainya per orbit.',
  },
  'delta-v': {
    title: 'Delta-v',
    body: 'Delta-v adalah total perubahan kecepatan yang bisa dilakukan wahana dengan propelannya. Setiap manuver (mengerem masuk orbit, mengoreksi pergeseran, menghindari sampah antariksa, deorbit) menghabiskan sebagian.',
    game: 'Delta-v dihitung dari persamaan roket: Δv = Isp × 9,81 × ln(massa basah ÷ massa kering). Gauge Δv membandingkannya dengan kebutuhan masuk orbit, menjaga orbit, dan pembuangan.',
    real: 'Mengerem masuk ke orbit rendah Bulan butuh sekitar 0,9 km/s, karena itu orbiter Bulan membawa banyak bahan bakar.',
  },
  isp: {
    title: 'Impuls spesifik (Isp)',
    body: 'Isp mengukur efisiensi bahan bakar: berapa lama satu kilogram propelan bisa mendorong. Gas dingin ≈ 65 s, monopropelan ≈ 220 s, bipropelan ≈ 315 s, pendorong listrik ≈ 1.600 s atau lebih.',
    game: 'Isp lebih tinggi memberi delta-v lebih banyak per kilogram. Pendorong listrik sangat efisien tapi dorongannya lembut, sehingga manuver butuh berbulan-bulan.',
    real: 'SMART-1 milik ESA berputar perlahan menuju Bulan dengan pendorong listrik selama sekitar setahun.',
  },
  launch: {
    title: 'Roket peluncur',
    body: 'Kapasitas roket tergantung tujuan: semakin tinggi energinya, semakin sedikit yang bisa dibawa. Rideshare murah, tapi ikut ke mana pun penumpang utama pergi.',
    game: 'Kapasitas dicantumkan per tujuan (LEO, SSO, GTO, antariksa jauh). Total massa armada harus muat.',
    real: 'Artemis I milik NASA membawa 10 CubeSat sebagai penumpang rideshare menuju Bulan.',
  },
  kepler: {
    title: 'Periode orbit',
    body: 'Semakin tinggi orbit, semakin lambat dan lama perjalanan mengitari planet. Hukum Kepler ketiga menghubungkan keduanya: T = 2π √(a³ / μ).',
    game: 'Periode, jumlah orbit per hari, dan lama gerhana dihitung dari hukum Kepler, fisika yang sama dengan General Mission Analysis Tool (GMAT) milik NASA.',
    real: 'ISS mengitari Bumi dalam sekitar 92 menit; satelit geostasioner butuh tepat satu hari.',
  },
  sso: {
    title: 'Orbit sinkron-Matahari',
    body: 'Orbit hampir melewati kutub yang dimiringkan sedemikian rupa sehingga melintasi setiap tempat pada jam lokal yang sama setiap hari. Pencahayaan yang sama membuat citra mudah dibandingkan.',
    game: 'Orbit sinkron-Matahari mencakup seluruh dunia tapi hanya melintasi satu titik sekitar dua kali sehari.',
    real: 'Landsat, Terra, dan Aqua semuanya terbang di orbit sinkron-Matahari.',
  },
  inclination: {
    title: 'Inklinasi dan cakupan',
    body: 'Inklinasi adalah kemiringan orbit terhadap ekuator. Satelit tidak pernah terbang di atas lintang yang lebih tinggi dari inklinasinya (ditambah jangkauan pandang sensornya ke samping).',
    game: 'Orbit 6° melintas di atas Indonesia hampir setiap orbit, tapi tidak bisa melihat Semeru (8° LS) dengan sensor yang sempit.',
    real: 'LAPAN-A2 milik Indonesia memakai orbit 6° untuk melintasi kepulauan Indonesia 14 kali sehari.',
  },
  resolution: {
    title: 'Resolusi permukaan',
    body: 'Resolusi adalah ukuran detail terkecil yang bisa dilihat kamera. Kamera yang sama melihat detail lebih kasar dari jarak lebih jauh.',
    game: 'Resolusi berbanding lurus dengan ketinggian: kamera yang melihat 70 m dari 500 km hanya melihat sekitar 5 km dari orbit geostasioner.',
    real: 'Satelit cuaca di GEO mengorbankan detail demi pandangan terus-menerus ke satu belahan Bumi.',
  },
  revisit: {
    title: 'Sapuan dan kunjungan ulang',
    body: 'Sapuan (swath) adalah lebar jalur yang dilihat sensor. Sapuan sempit memberi citra tajam tapi meninggalkan celah yang butuh berhari-hari untuk terisi; sapuan lebar sering berkunjung ulang tapi detailnya kurang.',
    game: 'Kunjungan ulang = jarak antar-lintasan ÷ lebar sapuan. Sensor termal dan radar juga bekerja di lintasan malam, sehingga waktu tunggu jadi setengah. Satelit tambahan membaginya lagi.',
    real: 'Landsat (sapuan 185 km) berkunjung ulang setiap 16 hari; MODIS (2.330 km) melihat sebagian besar tempat setiap hari.',
  },
  clouds: {
    title: 'Awan dan daerah tropis',
    body: 'Cahaya tampak dan inframerah tidak menembus awan tebal, dan daerah tropis seperti Jawa sering berawan. Radar memakai gelombang mikro yang menembus awan dan bekerja di malam hari.',
    game: 'Pencitra pasif kehilangan 25% nilainya di atas Semeru. Radar tidak.',
    real: 'Misi radar NISAR (NASA–ISRO) dirancang untuk menembus awan, siang dan malam.',
  },
  'data-rate': {
    title: 'Downlink dan anggaran data',
    body: 'Instrumen menghasilkan data sepanjang hari, tapi data hanya bisa dikirim saat stasiun bumi terlihat. Laju data × waktu kontak menentukan berapa banyak yang sampai. Sinyal radio juga melemah sebanding kuadrat jarak.',
    game: 'Data yang dihasilkan per hari dibandingkan dengan kapasitas downlink per hari. Kelebihannya hilang.',
    real: 'Lunar Reconnaissance Orbiter NASA mengirim hingga 100 Mbps dari Bulan memakai Ka-band.',
  },
  dsn: {
    title: 'Deep Space Network',
    body: 'Deep Space Network NASA punya parabola raksasa di California, Spanyol, dan Australia, berjarak sekitar 120°, sehingga wahana di luar orbit Bumi selalu terlihat oleh salah satu kompleksnya.',
    game: 'Misi Bulan dan L1 wajib memakai DSN. Waktunya dibagi dengan banyak misi lain, jadi kamu mendapat jadwal lintasan, bukan tautan terus-menerus.',
    real: 'DSN berkomunikasi dengan misi dari Bulan hingga Voyager di luar tata surya.',
  },
  'rain-fade': {
    title: 'Redaman hujan',
    body: 'Hujan lebat menyerap gelombang radio berfrekuensi tinggi. Semakin tinggi frekuensinya (X-band, lalu Ka-band), semakin parah, masalah nyata bagi stasiun bumi di daerah tropis.',
    game: 'Badai di stasiun bumi bisa mematikan stasiun tunggal berhari-hari. Menyebar lintasan ke banyak stasiun menghindari titik kegagalan tunggal ini.',
    real: 'Operator menambah margin tautan, atau stasiun tambahan, di daerah yang sering hujan.',
  },
  attitude: {
    title: 'Kendali sikap dan pengarahan',
    body: 'Wahana harus mengarahkan instrumen, panel, dan antenanya. Magnetorquer mendorong medan magnet Bumi (kasar, hanya dekat Bumi). Roda reaksi berputar untuk memutar wahana dengan presisi. Star tracker memberi tahu arah tepatnya.',
    game: 'Setiap instrumen dan antena mencantumkan ketepatan arah yang dibutuhkan. Jika kendali sikap lebih kasar, citra menjadi buram dan berkas radio sempit meleset dari Bumi.',
    real: 'Jauh dari Bumi, roda reaksi membuang putaran berlebihnya dengan menyalakan pendorong.',
  },
  radiation: {
    title: 'Radiasi',
    body: 'Partikel bermuatan dari Matahari dan sabuk radiasi Bumi merusak elektronik seiring waktu dan bisa membalik bit di memori. Satelit kecil sering memakai komponen komersial yang lebih murah dengan perlindungan lebih sedikit.',
    game: 'Setiap bus punya toleransi radiasi; setiap orbit punya dosis tahunan. GEO dan antariksa jauh lebih keras daripada orbit rendah.',
    real: 'Operator menempatkan wahana dalam safe mode saat badai Matahari kuat.',
  },
  lifetime: {
    title: 'Umur misi',
    body: 'Misi berakhir saat sumber daya kritis pertama habis: bahan bakar untuk menjaga orbit, siklus baterai, toleransi radiasi, atau orbit itu sendiri meluruh.',
    game: 'Umur misi adalah batas terkecil dari semua itu. Gauge Waktu menunjukkan batas mana yang paling menentukan.',
    real: 'Banyak misi bertahan melebihi rencana. Terra dan Aqua dirancang untuk enam tahun dan terbang lebih dari dua puluh tahun.',
  },
  mascons: {
    title: 'Mascon Bulan',
    body: 'Gravitasi Bulan tidak merata karena "konsentrasi massa" padat di bawah beberapa kawah. Mascon perlahan mengubah bentuk orbit rendah, jadi orbiter Bulan harus rutin membakar bahan bakar agar tidak jatuh.',
    game: 'Menjaga orbit rendah Bulan butuh sekitar 60 m/s delta-v per tahun. Tanpanya, orbit meluruh dalam hitungan bulan.',
    real: 'Misi GRAIL milik NASA memetakan mascon ini secara rinci.',
  },
  l1: {
    title: 'Titik Lagrange L1',
    body: 'L1 adalah titik seimbang 1,5 juta km ke arah Matahari, tempat wahana bergerak seiring dengan Bumi. Dari sana Matahari terlihat tanpa henti, dan angin Matahari terukur sekitar satu jam sebelum mencapai Bumi.',
    game: 'Orbit di sekitar L1 tidak stabil, jadi perlu pembakaran kecil untuk menjaga orbit setiap beberapa bulan.',
    real: 'ACE, SOHO, DSCOVR, Aditya-L1, dan IMAP semuanya bekerja di dekat L1.',
  },
  debris: {
    title: 'Sampah antariksa',
    body: 'Satelit mati dan pecahan bertahan di orbit puluhan tahun di atas sekitar 600 km. Misi yang bertanggung jawab menghindari pertemuan berisiko dan keluar dari orbit tak lama setelah selesai.',
    game: 'Misi orbit rendah harus jatuh kembali ke atmosfer dalam 5 tahun setelah misi berakhir, atau menyimpan bahan bakar untuk deorbit. Satelit GEO naik ke orbit "kuburan".',
    real: 'NASA biasanya bermanuver bila risiko tabrakan lebih buruk dari sekitar 1 banding 10.000.',
  },
  trl: {
    title: 'Technology Readiness Level (TRL)',
    body: 'TRL menilai seberapa teruji sebuah teknologi, dari 1 (ide di atas kertas) hingga 9 (sudah sukses terbang di antariksa). Teknologi baru bisa lebih murah atau lebih baik, tapi butuh waktu lebih lama untuk dikualifikasi dan lebih sering memberi kejutan.',
    game: 'Komponen di bawah TRL 9 menambah bulan pengembangan dan memperbesar peluang gangguan dalam penerbangan.',
    real: 'NASA mengembangkan skala TRL pada 1970-an; kini dipakai di seluruh dunia.',
  },
  cost: {
    title: 'Biaya misi',
    body: 'Biaya bukan cuma perangkat keras: integrasi dan pengujian, peluncuran, stasiun bumi, dan operasi bertahun-tahun semuanya bertambah. Badan antariksa membatasi anggaran misi, jadi biaya adalah batasan mutlak.',
    game: 'Total = perangkat keras + 20% integrasi & uji + peluncuran + persiapan darat + operasi × tahun rencana. Armada mendapat diskon kurva pembelajaran.',
    real: 'Kelas misi NASA punya batas biaya, misalnya program Discovery dan SIMPLEx.',
  },
  constellation: {
    title: 'Konstelasi',
    body: 'Beberapa satelit identik yang tersebar di sepanjang orbit bisa mengunjungi satu tempat jauh lebih sering daripada satu satelit, dan kehilangan satu satelit tidak mengakhiri misi.',
    game: 'Jumlah armada membagi waktu kunjungan ulang dan melipatgandakan lintasan, sementara biaya dan massa peluncuran naik untuk setiap wahana.',
    real: 'TROPICS milik NASA memakai satelit kecil untuk memantau badai kira-kira setiap jam.',
  },
  eclipse: {
    title: 'Gerhana',
    body: 'Di orbit rendah, satelit menghabiskan hingga sekitar sepertiga setiap orbit di bayangan Bumi: tanpa sinar Matahari, suhu turun, dan berjalan dengan baterai.',
    game: 'Lama gerhana dihitung dari geometri orbit: fraksi = arcsin(R ÷ (R + h)) ÷ π.',
    real: 'Orbit fajar–senja menyusuri garis siang–malam dan menghindari sebagian besar gerhana.',
  },
};

/** Codex entry in the current language. */
export function codexEntry(key) {
  return (getLang() === 'id' && CODEX_ID[key]) || CODEX[key];
}

export const CODEX_ORDER = [
  'segments', 'cml', 'requirements', 'trade-off', 'margin', 'power', 'eclipse', 'battery', 'delta-v', 'isp', 'launch',
  'kepler', 'sso', 'inclination', 'resolution', 'revisit', 'constellation', 'clouds', 'data-rate', 'dsn', 'rain-fade',
  'attitude', 'radiation', 'lifetime', 'mascons', 'l1', 'debris', 'trl', 'cost',
];
