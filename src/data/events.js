// In-flight events. Each event explains a real engineering concept and asks the team to make a call.
// ctx = { m (mission metrics), scenario, difficulty, flight (live state), rng }
// An option's resolve() returns { text, effects }, where effects can include:
//   downtimeDays, lifeMonths (delta), scienceMult (×), bonusYears (bonus science in years of output),
//   cost ($M), dv (m/s, negative uses fuel), recovery (delta), responsibility (score delta), endMission (string)
import { tx, nameOf, inlineName } from '../i18n.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const remainingMonths = (ctx) => Math.max(0, ctx.flight.lifeMonths - ctx.flight.month);

export const EVENTS = [
  {
    id: 'solar-storm', kind: 'problem', concept: 'radiation', icon: 'sun',
    when: () => true,
    weight: (ctx) => (ctx.scenario.id === 'solar' ? 0 : 1),
    title: () => tx('Solar storm incoming', 'Badai Matahari mendekat'),
    text: () => tx('A powerful flare erupted on the Sun and a cloud of charged particles is on its way. Energetic particles can flip bits in computer memory or permanently damage electronics.',
      'Suar kuat meletus di Matahari dan awan partikel bermuatan sedang menuju ke sini. Partikel berenergi bisa membalik bit di memori komputer atau merusak elektronik secara permanen.'),
    options: (ctx) => {
      const risk = Math.min(0.6, Math.max(0.05, 0.35 * Math.sqrt(8 / ctx.m.bus.radTol)));
      return [
        { id: 'safe', label: tx('Enter safe mode for 3 days', 'Masuk safe mode selama 3 hari'),
          detail: tx('Instruments off, computers protected. Lose 3 days of science.', 'Instrumen mati, komputer terlindungi. Kehilangan 3 hari sains.'),
          resolve: () => ({ text: tx('You powered down the instruments and rode out the storm. No damage, three quiet days.', 'Kamu mematikan instrumen dan melewati badai. Tidak ada kerusakan, hanya tiga hari yang sepi.'), effects: { downtimeDays: 3 } }) },
        { id: 'observe', label: tx('Keep observing', 'Terus mengamati'),
          detail: tx(`About ${pct(risk)} chance of radiation damage for this bus.`, `Peluang kerusakan radiasi sekitar ${pct(risk)} untuk bus ini.`),
          resolve: (c) => (c.rng() < risk
            ? { text: tx('A particle strike corrupted the main computer. The backup took over, but expected lifetime dropped by a quarter.', 'Hantaman partikel merusak komputer utama. Cadangan mengambil alih, tapi perkiraan umur misi turun seperempat.'), effects: { lifeMonths: -Math.round(remainingMonths(c) * 0.25) } }
            : { text: tx('The storm passed and your instruments kept working. Bonus: you recorded the storm\'s effects.', 'Badai berlalu dan instrumenmu tetap bekerja. Bonus: kamu merekam dampak badai itu.'), effects: { bonusYears: 0.03 } }) },
      ];
    },
  },
  {
    id: 'debris', kind: 'problem', concept: 'debris', icon: 'alert',
    when: (ctx) => ctx.m.orbit.commsClass === 'leo',
    weight: () => 1.2,
    title: () => tx('Conjunction alert', 'Peringatan konjungsi'),
    text: () => tx('Tracking radars show a piece of old rocket debris passing within 150 m in 30 hours. Collision probability: 1 in 2,500. NASA missions usually maneuver when the risk is worse than 1 in 10,000.',
      'Radar pelacak menunjukkan serpihan roket tua akan lewat dalam jarak 150 m dalam 30 jam. Peluang tabrakan: 1 banding 2.500. Misi NASA biasanya bermanuver bila risikonya lebih buruk dari 1 banding 10.000.'),
    options: (ctx) => {
      const canBurn = ctx.m.prop && ctx.m.prop.id !== 'prop-none' && ctx.flight.dvLeft >= 0.5;
      return [
        { id: 'dodge', label: tx('Fire thrusters to dodge', 'Nyalakan pendorong untuk menghindar'),
          detail: tx('Uses 0.5 m/s of delta-v and 1 day of observations.', 'Memakai 0,5 m/s delta-v dan 1 hari pengamatan.'),
          disabled: canBurn ? null : tx('No propulsion or no fuel left. You can only watch.', 'Tidak ada propulsi atau bahan bakar habis. Kamu hanya bisa menonton.'),
          resolve: () => ({ text: tx('A short burn shifted your orbit by 2 km. The debris passed harmlessly.', 'Pembakaran singkat menggeser orbitmu 2 km. Serpihan lewat tanpa bahaya.'), effects: { dv: -0.5, downtimeDays: 1, responsibility: 5 } }) },
        { id: 'accept', label: tx('Accept the risk', 'Terima risikonya'),
          detail: tx('No fuel spent, but above the usual safety threshold.', 'Tidak memakai bahan bakar, tapi di atas ambang keselamatan biasa.'),
          resolve: () => ({ text: tx('The debris passed by. Lucky this time, but taking risks above the threshold is how debris clouds start.', 'Serpihan lewat. Beruntung kali ini, tapi mengambil risiko di atas ambang adalah awal munculnya awan sampah antariksa.'), effects: { responsibility: -15 } }) },
      ];
    },
  },
  {
    id: 'wheel', kind: 'problem', concept: 'attitude', icon: 'gauge', failure: true,
    when: (ctx) => ctx.m.adcs?.wheels,
    weight: () => 1,
    title: () => tx('Reaction wheel friction rising', 'Gesekan roda reaksi meningkat'),
    text: () => tx('Wheel #2 is drawing more current and running hot. If it seizes, the spacecraft loses its fine pointing.',
      'Roda #2 menyedot arus lebih besar dan makin panas. Jika macet, wahana kehilangan ketepatan arahnya.'),
    options: (ctx) => [
      { id: 'patch', label: tx('Upload a new 3-wheel control mode', 'Unggah mode kendali 3 roda yang baru'),
        detail: tx(`Success depends on your operations team (${pct(ctx.flight.recovery)}).`, `Keberhasilan tergantung tim operasimu (${pct(ctx.flight.recovery)}).`),
        resolve: (c) => (c.rng() < c.flight.recovery
          ? { text: tx('Your engineers patched the flight software overnight. Pointing restored on three wheels.', 'Insinyurmu menambal perangkat lunak penerbangan semalaman. Pengarahan pulih dengan tiga roda.'), effects: { downtimeDays: 2 } }
          : { text: tx('The patch only partly worked. Pointing is wobblier, and sharp instruments lose detail.', 'Tambalannya hanya berhasil sebagian. Pengarahan lebih goyah, dan instrumen tajam kehilangan detail.'), effects: { downtimeDays: 4, scienceMult: 0.8 } }) },
      { id: 'monitor', label: tx('Keep running and monitor', 'Tetap jalan dan pantau'),
        detail: tx('No downtime now. Maybe it settles, maybe it seizes.', 'Tidak ada jeda sekarang. Mungkin membaik, mungkin macet.'),
        resolve: (c) => (c.rng() < 0.5
          ? { text: tx('The friction settled down. You got away with it.', 'Gesekannya mereda. Kamu lolos kali ini.'), effects: {} }
          : { text: tx('Two weeks later the wheel seized. Coarse pointing from now on.', 'Dua minggu kemudian roda itu macet. Pengarahan kasar mulai sekarang.'), effects: { scienceMult: 0.65 } }) },
    ],
  },
  {
    id: 'gs-outage', kind: 'problem', concept: 'rain-fade', icon: 'dish',
    when: (ctx) => ctx.m.network?.id === 'single',
    weight: (ctx) => (ctx.scenario.tropical || ctx.scenario.id === 'archipelago' ? 1.4 : 0.8),
    title: () => tx('Storm over the ground station', 'Badai di atas stasiun bumi'),
    text: () => tx('A tropical storm is dumping heavy rain on Surabaya. Rain absorbs high-frequency radio signals, and the station will be down for 10 days.',
      'Badai tropis mengguyur Surabaya dengan hujan lebat. Hujan menyerap sinyal radio berfrekuensi tinggi, dan stasiun akan mati selama 10 hari.'),
    options: () => [
      { id: 'rent', label: tx('Rent passes from a commercial network', 'Sewa lintasan dari jaringan komersial'),
        detail: tx('Costs $0.3M. No data lost.', 'Biaya $0,3 juta. Tidak ada data yang hilang.'),
        resolve: () => ({ text: tx('Commercial stations in Australia and Singapore caught your passes. Nothing lost.', 'Stasiun komersial di Australia dan Singapura menangkap lintasanmu. Tidak ada yang hilang.'), effects: { cost: 0.3 } }) },
      { id: 'wait', label: tx('Wait it out', 'Tunggu sampai reda'),
        detail: tx('Free, but onboard memory will overflow.', 'Gratis, tapi memori di wahana akan penuh.'),
        resolve: () => ({ text: tx('The spacecraft kept observing, but its memory filled up and about 10 days of data were overwritten. A single station is a single point of failure.', 'Wahana terus mengamati, tapi memorinya penuh dan sekitar 10 hari data tertimpa. Satu stasiun berarti satu titik kegagalan.'), effects: { downtimeDays: 10 } }) },
    ],
  },
  {
    id: 'budget-cut', kind: 'problem', concept: 'cost', icon: 'coins', failure: true,
    when: () => true,
    weight: () => 0.8,
    title: () => tx('Operations budget cut', 'Pemotongan anggaran operasi'),
    text: () => tx('The agency trimmed next year\'s operations budget by 20%. Something has to give.',
      'Badan antariksa memangkas anggaran operasi tahun depan sebesar 20%. Harus ada yang dikorbankan.'),
    options: (ctx) => [
      { id: 'cut-team', label: tx('Shrink the operations team', 'Kecilkan tim operasi'),
        detail: tx('Cheaper, but slower to fix future problems.', 'Lebih murah, tapi lebih lambat memperbaiki masalah berikutnya.'),
        resolve: () => ({ text: tx('Two engineers moved to other projects. Future anomalies will be harder to fix.', 'Dua insinyur pindah ke proyek lain. Anomali berikutnya akan lebih sulit diperbaiki.'), effects: { recovery: -0.2 } }) },
      { id: 'shorten', label: tx('Plan to end the mission a year early', 'Rencanakan misi selesai setahun lebih awal'),
        detail: tx('Keeps the team intact.', 'Tim tetap utuh.'),
        resolve: () => ({ text: tx('The mission end date moved up by a year.', 'Tanggal akhir misi dimajukan setahun.'), effects: { lifeMonths: -12 } }) },
      { id: 'partner', label: tx('Seek an international partner', 'Cari mitra internasional'),
        detail: tx('About 50% chance. If it fails, the team is cut.', 'Peluang sekitar 50%. Jika gagal, tim dipangkas.'),
        resolve: (c) => (c.rng() < 0.5
          ? { text: tx('A partner agency joined in exchange for data access. Shared missions are common: NISAR is NASA–ISRO and SOHO is ESA–NASA.', 'Sebuah badan mitra bergabung dengan imbalan akses data. Misi bersama itu umum: NISAR adalah NASA–ISRO dan SOHO adalah ESA–NASA.'), effects: { responsibility: 5 } }
          : { text: tx('No partner could sign in time. The operations team was cut.', 'Tidak ada mitra yang bisa tanda tangan tepat waktu. Tim operasi dipangkas.'), effects: { recovery: -0.2 } }) },
    ].map((o) => (ctx.flight.lifeMonths - ctx.flight.month <= 12 && o.id === 'shorten'
      ? { ...o, disabled: tx('Less than a year of mission left.', 'Sisa misi kurang dari setahun.') } : o)),
  },
  {
    id: 'instrument', kind: 'problem', concept: 'trl', icon: 'flask', failure: true,
    when: (ctx) => ctx.m.insts.length > 0,
    weight: (ctx) => 0.6 + 0.4 * ctx.m.risk.lowTrl.length,
    title: (ctx) => tx(`${nameOf(weakestInstrument(ctx).inst)} glitch`, `Gangguan ${nameOf(weakestInstrument(ctx).inst)}`),
    text: (ctx) => {
      const w = weakestInstrument(ctx);
      return tx(`After a power spike the ${nameOf(w.inst).toLowerCase()} is returning noisy data. Hardware with a lower Technology Readiness Level (this one is TRL ${w.inst.trl}) has less flight history, so surprises are more likely.`,
        `Setelah lonjakan daya, ${inlineName(w.inst)} mengirim data yang berisik. Perangkat dengan Technology Readiness Level lebih rendah (yang ini TRL ${w.inst.trl}) punya riwayat terbang lebih sedikit, jadi kejutan lebih mungkin terjadi.`);
    },
    options: (ctx) => {
      const w = weakestInstrument(ctx);
      return [
        { id: 'recal', label: tx('Power-cycle and recalibrate', 'Matikan-nyalakan dan kalibrasi ulang'),
          detail: tx(`4 days offline. Success depends on your team (${pct(ctx.flight.recovery)}).`, `Offline 4 hari. Keberhasilan tergantung timmu (${pct(ctx.flight.recovery)}).`),
          resolve: (c) => (c.rng() < c.flight.recovery
            ? { text: tx('The reset worked and calibration is back to normal.', 'Reset berhasil dan kalibrasi kembali normal.'), effects: { downtimeDays: 4 } }
            : { text: tx('The reset helped only partly. The instrument stays noisy.', 'Reset hanya membantu sebagian. Instrumen tetap berisik.'), effects: { downtimeDays: 4, scienceMult: 1 - w.share * 0.35 } }) },
        { id: 'continue', label: tx('Keep collecting degraded data', 'Terus kumpulkan data yang menurun'),
          detail: tx('No downtime, lower data quality.', 'Tanpa jeda, kualitas data lebih rendah.'),
          resolve: () => ({ text: tx('Scientists will have to filter out the noise. Some measurements are lost.', 'Ilmuwan harus menyaring derau. Sebagian pengukuran hilang.'), effects: { scienceMult: 1 - w.share * 0.3 } }) },
      ];
    },
  },
  {
    id: 'battery-fade', kind: 'problem', concept: 'battery', icon: 'bolt', failure: true,
    when: (ctx) => ctx.m.batteryInfo.dod > 0.2 && ctx.m.power.eclipseMin > 0,
    weight: (ctx) => ctx.m.batteryInfo.dod * 2,
    title: () => tx('Battery capacity fading', 'Kapasitas baterai menurun'),
    text: (ctx) => tx(`Each eclipse drains the battery by about ${pct(ctx.m.batteryInfo.dod)}. After thousands of cycles, it now holds 15% less charge.`,
      `Setiap gerhana menguras baterai sekitar ${pct(ctx.m.batteryInfo.dod)}. Setelah ribuan siklus, kini daya tampungnya berkurang 15%.`),
    options: (ctx) => [
      { id: 'protect', label: tx('Switch instruments off during eclipses', 'Matikan instrumen saat gerhana'),
        detail: tx('Less science, longer battery life.', 'Sains berkurang, umur baterai lebih panjang.'),
        resolve: () => ({ text: tx('Lighter eclipse loads slow the battery\'s decline.', 'Beban gerhana yang lebih ringan memperlambat penurunan baterai.'), effects: { scienceMult: 1 - ctx.m.info.eclipseFrac * 0.5, lifeMonths: 6 } }) },
      { id: 'push', label: tx('Keep full operations', 'Tetap operasi penuh'),
        detail: tx('Full science now, shorter life.', 'Sains penuh sekarang, umur lebih pendek.'),
        resolve: () => ({ text: tx('Full speed ahead. The battery will give out sooner.', 'Gas penuh. Baterai akan habis lebih cepat.'), effects: { lifeMonths: -8 } }) },
    ],
  },
  {
    id: 'mascon', kind: 'problem', concept: 'mascons', icon: 'moon',
    when: (ctx) => ctx.m.orbit.body === 'moon',
    weight: () => 1.5,
    title: () => tx('Orbit sinking toward the surface', 'Orbit merosot ke arah permukaan'),
    text: () => tx('Lumpy lunar gravity (mass concentrations, or "mascons") has pulled your lowest point down to 40 km. Left alone, the orbit keeps sinking.',
      'Gravitasi Bulan yang tidak merata (konsentrasi massa atau "mascon") menarik titik terendah orbitmu turun ke 40 km. Jika dibiarkan, orbit terus merosot.'),
    options: (ctx) => [
      { id: 'burn', label: tx('Burn now to raise the orbit', 'Bakar sekarang untuk menaikkan orbit'),
        detail: tx('Uses 15 m/s of delta-v.', 'Memakai 15 m/s delta-v.'),
        disabled: ctx.flight.dvLeft >= 15 ? null : tx('Not enough fuel left.', 'Bahan bakar tidak cukup.'),
        resolve: () => ({ text: tx('The correction burn restored a safe 100 km orbit.', 'Pembakaran koreksi memulihkan orbit aman 100 km.'), effects: { dv: -15 } }) },
      { id: 'wait', label: tx('Wait for a better burn window', 'Tunggu jendela pembakaran yang lebih baik'),
        detail: tx('Saves fuel, about 30% chance of trouble.', 'Hemat bahan bakar, peluang masalah sekitar 30%.'),
        resolve: (c) => (c.rng() < 0.3
          ? { text: tx('The orbit dipped too low and the spacecraft struck a crater rim. Mission over.', 'Orbit turun terlalu rendah dan wahana menabrak bibir kawah. Misi berakhir.'), effects: { endMission: tx('Impacted the lunar surface after its orbit decayed.', 'Menabrak permukaan Bulan setelah orbitnya meluruh.') } }
          : { text: tx('Two weeks later a cheaper burn window fixed the orbit.', 'Dua minggu kemudian, jendela pembakaran yang lebih hemat memperbaiki orbit.'), effects: { dv: -10 } }) },
    ],
  },
  // ---------- Opportunities (one per flight, scenario-specific) ----------
  {
    id: 'opp-semeru', kind: 'opportunity', concept: 'revisit', icon: 'volcano',
    when: (ctx) => ctx.scenario.id === 'semeru',
    weight: () => 1,
    title: () => tx('Semeru is heating up', 'Semeru memanas'),
    text: () => tx('The heat signal at the summit has doubled in two days. The volcano observatory asks for every observation you can make.',
      'Sinyal panas di puncak berlipat dua dalam dua hari. Pos pengamatan gunung api meminta setiap pengamatan yang bisa kamu lakukan.'),
    options: (ctx) => [
      { id: 'retask', label: tx('Retask: observe on every pass', 'Ubah tugas: amati di setiap lintasan'),
        detail: tx('Worth the most if your data link keeps up.', 'Paling bernilai jika tautan datamu sanggup mengikuti.'),
        resolve: () => (ctx.m.comms.delivery >= 0.95
          ? { text: tx('Your fresh images helped the observatory raise the alert level before the ash flows. Villages evacuated in time.', 'Citra terbarumu membantu pos pengamatan menaikkan status sebelum awan panas turun. Desa-desa mengungsi tepat waktu.'), effects: { bonusYears: 0.3 } }
          : { text: tx('You took the images, but your downlink could not keep up: many waited days in memory. Fast delivery matters for warnings.', 'Kamu mengambil citranya, tapi downlink tidak sanggup mengikuti: banyak yang tertahan berhari-hari di memori. Pengiriman cepat penting untuk peringatan.'), effects: { bonusYears: 0.1 } }) },
      { id: 'routine', label: tx('Stay on the routine schedule', 'Tetap pada jadwal rutin'),
        detail: tx('No risk to other observations.', 'Tidak mengganggu pengamatan lain.'),
        resolve: () => ({ text: tx('Routine images still caught the eruption, but later than they could have.', 'Citra rutin tetap menangkap letusan, tapi lebih lambat dari seharusnya.'), effects: { bonusYears: 0.05 } }) },
    ],
  },
  {
    id: 'opp-archipelago', kind: 'opportunity', concept: 'inclination', icon: 'islands',
    when: (ctx) => ctx.scenario.id === 'archipelago',
    weight: () => 1,
    title: () => tx('Earthquake cuts phone networks', 'Gempa memutus jaringan telepon'),
    text: () => tx('A strong earthquake damaged mobile towers across a remote island. Rescue teams need your relay to coordinate.',
      'Gempa kuat merusak menara seluler di sebuah pulau terpencil. Tim penyelamat butuh relaimu untuk berkoordinasi.'),
    options: (ctx) => [
      { id: 'priority', label: tx('Prioritize emergency messages', 'Prioritaskan pesan darurat'),
        detail: tx('The more often you pass overhead, the more you help.', 'Semakin sering kamu melintas, semakin besar bantuanmu.'),
        resolve: () => (ctx.m.passes >= 8
          ? { text: tx('With frequent passes, rescue teams could send updates every hour or two. Your relay became their lifeline.', 'Dengan lintasan yang sering, tim penyelamat bisa mengirim kabar setiap satu-dua jam. Relaimu menjadi penyelamat mereka.'), effects: { bonusYears: 0.3 } }
          : { text: tx('You relayed what you could, but hours passed between overflights.', 'Kamu meneruskan sebisanya, tapi berjam-jam berlalu di antara lintasan.'), effects: { bonusYears: 0.1 } }) },
      { id: 'normal', label: tx('Keep normal service', 'Tetap layanan normal'),
        detail: tx('Treat all users equally.', 'Perlakukan semua pengguna sama.'),
        resolve: () => ({ text: tx('Emergency messages queued with everything else.', 'Pesan darurat mengantre bersama pesan lainnya.'), effects: { bonusYears: 0.03 } }) },
    ],
  },
  {
    id: 'opp-lunar', kind: 'opportunity', concept: 'delta-v', icon: 'moon',
    when: (ctx) => ctx.scenario.id === 'lunar',
    weight: () => 1,
    title: () => tx('Dive over Shackleton crater', 'Menukik di atas Kawah Shackleton'),
    text: () => tx('Dropping to 30 km for a month would sharpen your map of the permanently shadowed crater at the south pole, but it costs fuel.',
      'Turun ke 30 km selama sebulan akan mempertajam peta kawah yang selalu gelap di kutub selatan, tapi memakan bahan bakar.'),
    options: (ctx) => [
      { id: 'dive', label: tx('Dive to 30 km', 'Menukik ke 30 km'),
        detail: tx('Uses 40 m/s of delta-v.', 'Memakai 40 m/s delta-v.'),
        disabled: ctx.flight.dvLeft >= 40 ? null : tx('Not enough fuel left.', 'Bahan bakar tidak cukup.'),
        resolve: () => ({ text: tx('The low passes revealed hydrogen hotspots inside the crater, prime targets for future landers.', 'Lintasan rendah mengungkap titik konsentrasi hidrogen di dalam kawah, target utama pendarat masa depan.'), effects: { bonusYears: 0.3, dv: -40 } }) },
      { id: 'stay', label: tx('Stay at 100 km', 'Tetap di 100 km'),
        detail: tx('Save fuel for a longer mission.', 'Hemat bahan bakar untuk misi lebih panjang.'),
        resolve: () => ({ text: tx('You kept your fuel reserve for a longer mission.', 'Kamu menyimpan cadangan bahan bakar untuk misi yang lebih panjang.'), effects: {} }) },
    ],
  },
  {
    id: 'opp-solar', kind: 'opportunity', concept: 'l1', icon: 'sun',
    when: (ctx) => ctx.scenario.id === 'solar',
    weight: () => 1,
    title: () => tx('Fast CME heading for Earth', 'CME cepat menuju Bumi'),
    text: () => tx('Your data show a fast eruption aimed at Earth. Forecasters need the measurements now, but your next scheduled Deep Space Network pass is hours away.',
      'Datamu menunjukkan letusan cepat yang mengarah ke Bumi. Peramal butuh pengukurannya sekarang, tapi jadwal lintasan Deep Space Network berikutnya masih berjam-jam lagi.'),
    options: (ctx) => {
      const chance = Math.min(1, ctx.m.comms.contactMin / 1440);
      return [
        { id: 'dsn', label: tx('Request emergency DSN time', 'Minta waktu DSN darurat'),
          detail: tx('Costs $0.2M. Guarantees a live link.', 'Biaya $0,2 juta. Menjamin tautan langsung.'),
          resolve: () => ({ text: tx('Your warning reached forecasters 50 minutes before impact. Grid operators protected their transformers.', 'Peringatanmu sampai ke peramal 50 menit sebelum dampak. Operator jaringan listrik sempat melindungi trafo mereka.'), effects: { bonusYears: 0.3, cost: 0.2 } }) },
        { id: 'wait', label: tx('Wait for the scheduled pass', 'Tunggu lintasan terjadwal'),
          detail: tx(`About ${pct(chance)} chance you are already in contact.`, `Peluang sekitar ${pct(chance)} kamu sudah sedang terhubung.`),
          resolve: (c) => (c.rng() < chance
            ? { text: tx('Luckily a DSN dish was already tracking you. The warning went out in time.', 'Untungnya parabola DSN sedang melacakmu. Peringatan terkirim tepat waktu.'), effects: { bonusYears: 0.3 } }
            : { text: tx('The storm hit Earth before your data came down. Real-time coverage matters for warnings.', 'Badai menghantam Bumi sebelum datamu sampai. Cakupan real-time penting untuk peringatan.'), effects: { bonusYears: 0.05 } }) },
      ];
    },
  },
];

function weakestInstrument(ctx) {
  const list = ctx.m.science.perInst;
  const total = list.reduce((a, p) => a + p.value, 0) || 1;
  const w = [...list].sort((a, b) => a.inst.trl - b.inst.trl || b.value - a.value)[0];
  return { ...w, share: w.value / total };
}

export function eventTitle(event, ctx) {
  return typeof event.title === 'function' ? event.title(ctx) : event.title;
}
