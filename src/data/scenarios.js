// Mission scenarios. Each scenario offers mission priorities: choosing one sets the requirements
// (the "define the objective, then derive requirements" step of NASA's mission design process).
// `idn` fields hold Bahasa Indonesia text. `guide` is a known-good design per priority, shown as
// "Suggested" hints in Cadet mode.

const gibsWms = (layer, bbox, w, h, time, format = 'image/jpeg') =>
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0' +
  `&LAYERS=${layer}&STYLES=&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=${w}&HEIGHT=${h}&FORMAT=${format}&TIME=${time}`;

export const SCENARIOS = [
  {
    id: 'semeru',
    name: 'Semeru Watch',
    kind: 'Earth observation',
    where: 'East Java, Indonesia',
    icon: 'volcano',
    accent: '#ff8a4c',
    tagline: 'Catch the next eruption before it reaches the villages.',
    brief:
      'Semeru, the highest volcano on Java, sits about 100 km south of Surabaya. In December 2021 a sudden collapse sent hot ash flows ' +
      'down its slopes and buried villages. Volcanologists want a satellite that watches the summit for rising heat, day and night, ' +
      'and sends warnings fast enough for people to evacuate.',
    users: 'Indonesia\'s volcano observatory, disaster agencies and the communities around Semeru',
    idn: {
      kind: 'Observasi Bumi',
      where: 'Jawa Timur, Indonesia',
      tagline: 'Deteksi letusan berikutnya sebelum mencapai desa.',
      brief:
        'Semeru, gunung api tertinggi di Pulau Jawa, berada sekitar 100 km di selatan Surabaya. Pada Desember 2021, runtuhan mendadak ' +
        'mengirim awan panas guguran menuruni lerengnya dan mengubur desa-desa. Para vulkanolog butuh satelit yang memantau panas di ' +
        'puncak siang dan malam, lalu mengirim peringatan cukup cepat agar warga sempat mengungsi.',
      users: 'Pusat vulkanologi Indonesia, badan penanggulangan bencana, dan masyarakat di sekitar Semeru',
    },
    target: { lat: -8.108, lon: 112.922, label: 'Semeru volcano', labelId: 'Gunung Semeru' },
    tropical: true,
    budget: 120,
    deadline: 48,
    weights: { thermal: 1, radar: 0.8, multispectral: 0.6, 'ir-spectro': 0.4, optical: 0.5 },
    resGoal: { thermal: 300, radar: 20, multispectral: 30, optical: 5 },
    priorities: [
      {
        id: 'warning',
        name: 'Early warning',
        desc: 'Detect new heat at the summit within a day, even if the picture is coarse.',
        idn: {
          name: 'Peringatan dini',
          desc: 'Deteksi panas baru di puncak dalam sehari, walau gambarnya kasar.',
          reqs: ['Membawa sensor inframerah termal', 'Detail termal 1 km atau lebih baik', 'Mengunjungi Semeru minimal sekali sehari',
            'Mengirim minimal 90% data ke Bumi', 'Beroperasi minimal 3 tahun'],
        },
        revisitGoal: 1,
        resGoal: { thermal: 1000 },
        target: 28,
        reqs: [
          { type: 'cap', caps: ['thermal'], label: 'Carry a thermal infrared sensor' },
          { type: 'res', cap: 'thermal', max: 1000, label: 'Thermal detail of 1 km or better' },
          { type: 'revisit', cap: 'thermal', max: 1, label: 'Revisit Semeru at least once a day' },
          { type: 'delivery', min: 0.9, label: 'Deliver at least 90% of data to Earth' },
          { type: 'life', min: 3, label: 'Operate for at least 3 years' },
        ],
      },
      {
        id: 'mapping',
        name: 'Lava-flow mapping',
        desc: 'Map hot ash and lava flows in sharp detail, even if visits are days apart.',
        idn: {
          name: 'Pemetaan aliran lava',
          desc: 'Petakan awan panas dan aliran lava dengan detail tajam, walau kunjungannya berselang beberapa hari.',
          reqs: ['Membawa sensor inframerah termal', 'Detail termal 100 m atau lebih baik', 'Mengunjungi Semeru minimal setiap 10 hari',
            'Mengirim minimal 90% data ke Bumi', 'Beroperasi minimal 3 tahun'],
        },
        revisitGoal: 10,
        resGoal: { thermal: 100 },
        target: 36,
        reqs: [
          { type: 'cap', caps: ['thermal'], label: 'Carry a thermal infrared sensor' },
          { type: 'res', cap: 'thermal', max: 100, label: 'Thermal detail of 100 m or better' },
          { type: 'revisit', cap: 'thermal', max: 10, label: 'Revisit Semeru at least every 10 days' },
          { type: 'delivery', min: 0.9, label: 'Deliver at least 90% of data to Earth' },
          { type: 'life', min: 3, label: 'Operate for at least 3 years' },
        ],
      },
      {
        id: 'balanced',
        name: 'Balanced watch',
        desc: 'Both: fairly sharp thermal images and a visit every few days. Hardest to satisfy.',
        idn: {
          name: 'Pemantauan seimbang',
          desc: 'Keduanya: citra termal cukup tajam dan kunjungan setiap beberapa hari. Paling sulit dipenuhi.',
          reqs: ['Membawa sensor inframerah termal', 'Detail termal 300 m atau lebih baik', 'Mengunjungi Semeru minimal setiap 3 hari',
            'Mengirim minimal 90% data ke Bumi', 'Beroperasi minimal 3 tahun'],
        },
        revisitGoal: 3,
        target: 40,
        reqs: [
          { type: 'cap', caps: ['thermal'], label: 'Carry a thermal infrared sensor' },
          { type: 'res', cap: 'thermal', max: 300, label: 'Thermal detail of 300 m or better' },
          { type: 'revisit', cap: 'thermal', max: 3, label: 'Revisit Semeru at least every 3 days' },
          { type: 'delivery', min: 0.9, label: 'Deliver at least 90% of data to Earth' },
          { type: 'life', min: 3, label: 'Operate for at least 3 years' },
        ],
      },
    ],
    starter: {
      bus: 'smallsat', instruments: ['tir-wide'], orbit: 'sso-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
      battery: 'bat-500', adcs: 'adcs-rw', propulsion: 'prop-none', propellant: 0, radio: 'rad-x', network: 'single', ops: 'ops-lean',
    },
    guide: {
      warning: { bus: 'smallsat', instruments: ['tir-wide'], orbit: 'sso-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
        battery: 'bat-500', adcs: 'adcs-rw', propulsion: 'prop-none', radio: 'rad-x', network: 'commercial', ops: 'ops-standard' },
      mapping: { bus: 'smallsat', instruments: ['tir-hr'], orbit: 'sso-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
        battery: 'bat-500', adcs: 'adcs-prec', propulsion: 'prop-none', radio: 'rad-x', network: 'commercial', ops: 'ops-standard' },
      balanced: { bus: 'smallsat', instruments: ['tir-wide', 'tir-hr'], orbit: 'sso-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
        battery: 'bat-500', adcs: 'adcs-prec', propulsion: 'prop-none', radio: 'rad-x', network: 'commercial', ops: 'ops-standard' },
    },
    imagery: {
      title: 'Real NASA data: East Java from orbit',
      src: gibsWms('MODIS_Aqua_CorrectedReflectance_TrueColor', '-8.9,112.1,-7.3,113.7', 600, 600, '2023-07-20'),
      caption:
        'NASA Aqua/MODIS true-color image, 20 July 2023. The white patch near the center is cloud over the Bromo–Semeru highlands. ' +
        'Clouds like this block visible and thermal cameras, which is why volcano watchers combine frequent revisits with radar.',
      credit: 'NASA GIBS / Worldview, MODIS Aqua Corrected Reflectance',
      link: 'https://worldview.earthdata.nasa.gov/?v=112.1,-8.9,113.7,-7.3&t=2023-07-20-T00%3A00%3A00Z&l=MODIS_Aqua_CorrectedReflectance_TrueColor',
      idn: {
        title: 'Data NASA asli: Jawa Timur dari orbit',
        caption:
          'Citra warna asli NASA Aqua/MODIS, 20 Juli 2023. Bercak putih dekat tengah adalah awan di atas dataran tinggi Bromo–Semeru. ' +
          'Awan seperti ini menghalangi kamera visual dan termal, karena itulah pemantau gunung api memadukan kunjungan ulang yang sering dengan radar.',
      },
    },
    analogs: [
      { name: 'Terra & Aqua (MODIS)', agency: 'NASA', year: '1999 / 2002',
        text: 'Two sun-synchronous satellites whose 2,330 km-wide MODIS swath sees almost the whole Earth every day. Its thermal bands are used to spot volcanic hotspots worldwide.',
        idn: { text: 'Dua satelit sinkron-Matahari dengan sapuan MODIS selebar 2.330 km yang melihat hampir seluruh Bumi setiap hari. Kanal termalnya dipakai untuk mendeteksi titik panas gunung api di seluruh dunia.' },
        match: { instruments: ['tir-wide'], orbits: ['sso-550'] } },
      { name: 'Landsat 9', agency: 'NASA / USGS', year: '2021',
        text: 'Its TIRS-2 thermal sensor sees 100 m detail in a 185 km strip, so each place is revisited every 16 days. A classic resolution-versus-revisit trade-off.',
        idn: { text: 'Sensor termal TIRS-2 melihat detail 100 m dalam jalur 185 km, sehingga setiap tempat dikunjungi ulang setiap 16 hari. Contoh klasik trade-off resolusi versus kunjungan ulang.' },
        match: { instruments: ['tir-hr', 'msi'], orbits: ['sso-550'] } },
      { name: 'NISAR', agency: 'NASA / ISRO', year: '2025',
        text: 'A radar satellite in a dawn–dusk orbit that sees through clouds and measures ground deformation of a few centimeters, including volcanoes swelling before eruptions.',
        idn: { text: 'Satelit radar di orbit fajar–senja yang menembus awan dan mengukur perubahan bentuk tanah beberapa sentimeter, termasuk gunung api yang menggembung sebelum meletus.' },
        match: { instruments: ['sar'], orbits: ['sso-dd-750'] } },
      { name: 'ECOSTRESS', agency: 'NASA (on the ISS)', year: '2018',
        text: 'A thermal radiometer on the Space Station. The ISS orbit is not sun-synchronous, so it observes the same place at different times of day.',
        idn: { text: 'Radiometer termal di Stasiun Luar Angkasa. Orbit ISS tidak sinkron-Matahari, jadi ia mengamati tempat yang sama pada jam yang berbeda-beda.' },
        match: { orbits: ['leo-iss'], instruments: ['tir-hr', 'tir-cube'] } },
    ],
  },
  {
    id: 'archipelago',
    name: 'Archipelago Link',
    kind: 'Communications',
    where: 'Indonesian islands',
    icon: 'islands',
    accent: '#5ee0c2',
    tagline: 'Connect 17,000 islands with a satellite you can afford.',
    brief:
      'Many fishing villages and remote islands in Indonesia have no mobile signal. Weather sensors, fishers and health workers need to ' +
      'send short messages every few hours. A small satellite can collect those messages as it flies over and relay them to a ground ' +
      'station, but the budget is tight.',
    users: 'Remote villages, fishers, environmental sensors and local governments',
    idn: {
      kind: 'Komunikasi',
      where: 'Kepulauan Indonesia',
      tagline: 'Hubungkan 17.000 pulau dengan satelit yang terjangkau.',
      brief:
        'Banyak desa nelayan dan pulau terpencil di Indonesia belum punya sinyal seluler. Sensor cuaca, nelayan, dan tenaga kesehatan ' +
        'perlu mengirim pesan singkat setiap beberapa jam. Satelit kecil bisa mengumpulkan pesan-pesan itu saat melintas dan ' +
        'meneruskannya ke stasiun bumi, tapi anggarannya ketat.',
      users: 'Desa terpencil, nelayan, sensor lingkungan, dan pemerintah daerah',
    },
    region: { latMin: -11, latMax: 6, label: 'Indonesia' },
    budget: 6,
    deadline: 24,
    weights: { iot: 1, ais: 0.8, optical: 0.3, multispectral: 0.3, thermal: 0.2 },
    resGoal: { optical: 10, multispectral: 30, thermal: 300 },
    priorities: [
      {
        id: 'messaging',
        name: 'Village messaging',
        desc: 'Relay messages from remote islands at least 8 times a day.',
        idn: {
          name: 'Pesan antar desa',
          desc: 'Teruskan pesan dari pulau terpencil minimal 8 kali sehari.',
          reqs: ['Membawa relai pesan IoT', 'Melintas di atas Indonesia minimal 8 kali sehari', 'Mengirim minimal 95% pesan', 'Beroperasi minimal 2 tahun'],
        },
        target: 42,
        reqs: [
          { type: 'cap', caps: ['iot'], label: 'Carry an IoT messaging relay' },
          { type: 'passes', min: 8, label: 'Pass over Indonesia at least 8 times a day' },
          { type: 'delivery', min: 0.95, label: 'Deliver at least 95% of messages' },
          { type: 'life', min: 2, label: 'Operate for at least 2 years' },
        ],
      },
      {
        id: 'fisheries',
        name: 'Fisheries watch',
        desc: 'Track fishing boats to fight illegal fishing and find boats in distress.',
        idn: {
          name: 'Pengawasan perikanan',
          desc: 'Lacak kapal ikan untuk memberantas penangkapan ilegal dan menemukan kapal dalam bahaya.',
          reqs: ['Membawa penerima AIS pelacak kapal', 'Melintas di atas Indonesia minimal 6 kali sehari', 'Mengirim minimal 90% data', 'Beroperasi minimal 2 tahun'],
        },
        target: 38,
        weights: { ais: 1, iot: 0.5, optical: 0.4 },
        reqs: [
          { type: 'cap', caps: ['ais'], label: 'Carry an AIS ship-tracking receiver' },
          { type: 'passes', min: 6, label: 'Pass over Indonesia at least 6 times a day' },
          { type: 'delivery', min: 0.9, label: 'Deliver at least 90% of data' },
          { type: 'life', min: 2, label: 'Operate for at least 2 years' },
        ],
      },
    ],
    starter: {
      bus: 'cube6u', instruments: ['iot'], orbit: 'sso-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
      battery: 'bat-40', adcs: 'adcs-mtq', propulsion: 'prop-none', propellant: 0, radio: 'rad-s', network: 'single', ops: 'ops-lean',
    },
    guide: {
      messaging: { bus: 'cube6u', instruments: ['iot', 'ais'], orbit: 'leo-eq-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
        battery: 'bat-120', adcs: 'adcs-mtq', propulsion: 'prop-none', radio: 'rad-s', network: 'single', ops: 'ops-lean' },
      fisheries: { bus: 'cube6u', instruments: ['ais', 'iot'], orbit: 'leo-eq-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
        battery: 'bat-120', adcs: 'adcs-mtq', propulsion: 'prop-none', radio: 'rad-s', network: 'single', ops: 'ops-lean' },
    },
    imagery: {
      title: 'Real NASA data: Indonesia at night',
      src: gibsWms('VIIRS_Black_Marble', '-11,95,6,141', 1024, 378, '2016-01-01'),
      caption:
        'NASA Black Marble night-lights map from the VIIRS instrument. Java glows brightly, while much of Kalimantan, Sulawesi, ' +
        'Maluku and Papua stays dark: places with few lights often have little connectivity.',
      credit: 'NASA Earth Observatory Black Marble (Suomi NPP VIIRS) via NASA GIBS',
      link: 'https://earthobservatory.nasa.gov/features/NightLights',
      idn: {
        title: 'Data NASA asli: Indonesia di malam hari',
        caption:
          'Peta cahaya malam NASA Black Marble dari instrumen VIIRS. Jawa bersinar terang, sementara sebagian besar Kalimantan, Sulawesi, ' +
          'Maluku, dan Papua tetap gelap: tempat dengan sedikit cahaya sering kali juga minim konektivitas.',
      },
    },
    analogs: [
      { name: 'LAPAN-A2 / LAPAN-ORARI', agency: 'LAPAN (Indonesia)', year: '2015',
        text: 'An Indonesian microsatellite launched on ISRO\'s PSLV into a near-equatorial 6° orbit, so it passes over Indonesia on almost every orbit. It carried ship tracking (AIS) and amateur radio messaging.',
        idn: { text: 'Mikrosatelit Indonesia yang diluncurkan dengan PSLV milik ISRO ke orbit dekat ekuator 6°, sehingga melintas di atas Indonesia hampir setiap orbit. Membawa pelacak kapal (AIS) dan layanan pesan radio amatir.' },
        match: { orbits: ['leo-eq-550'], instruments: ['ais', 'iot'] } },
      { name: 'Starling', agency: 'NASA', year: '2023',
        text: 'Four small CubeSats that tested flying as a coordinated swarm: sharing data over crosslinks and planning operations on their own.',
        idn: { text: 'Empat CubeSat kecil yang menguji terbang sebagai kawanan terkoordinasi: berbagi data lewat tautan antarsatelit dan merencanakan operasi secara mandiri.' },
        match: { minCount: 2, buses: ['cube6u', 'cube12u'] } },
      { name: 'SATRIA-1', agency: 'Indonesia', year: '2023',
        text: 'A large geostationary internet satellite serving schools, clinics and village offices. It shows the other end of the trade-off: continuous coverage for a far bigger budget.',
        idn: { text: 'Satelit internet geostasioner besar yang melayani sekolah, puskesmas, dan kantor desa. Menunjukkan sisi lain trade-off: cakupan terus-menerus dengan anggaran jauh lebih besar.' },
        match: { orbits: ['geo'] } },
    ],
  },
  {
    id: 'lunar',
    name: 'Lunar Ice Hunter',
    kind: 'Planetary science',
    where: 'Lunar south pole',
    icon: 'moon',
    accent: '#c9b8ff',
    tagline: 'Find the water that future astronauts will drink.',
    brief:
      'Craters near the Moon\'s poles have floors that never see sunlight and may trap water ice. Ice could give future explorers drinking ' +
      'water, oxygen and even rocket fuel. Your orbiter must reach the Moon, brake into a low polar orbit, and map where the hydrogen is.',
    users: 'Lunar scientists and the planners of future crewed landings',
    idn: {
      kind: 'Sains planet',
      where: 'Kutub selatan Bulan',
      tagline: 'Temukan air yang akan diminum astronaut masa depan.',
      brief:
        'Kawah di dekat kutub Bulan punya dasar yang tak pernah tersinari Matahari dan mungkin menyimpan es air. Es itu bisa menjadi ' +
        'air minum, oksigen, bahkan bahan bakar roket bagi penjelajah masa depan. Orbitermu harus mencapai Bulan, mengerem masuk ke ' +
        'orbit polar rendah, dan memetakan di mana hidrogen berada.',
      users: 'Ilmuwan Bulan dan perencana pendaratan berawak di masa depan',
    },
    budget: 300,
    deadline: 66,
    weights: { neutron: 1, 'ir-spectro': 0.9, altimeter: 0.7, thermal: 0.6, radar: 0.6, optical: 0.5, magnetometer: 0.1, particles: 0.2 },
    priorities: [
      {
        id: 'ice',
        name: 'Find the ice',
        desc: 'Detect hydrogen and water signatures in the polar craters.',
        idn: {
          name: 'Temukan es',
          desc: 'Deteksi jejak hidrogen dan air di kawah kutub.',
          reqs: ['Membawa spektrometer neutron atau inframerah', 'Mengirim minimal 90% data ke Bumi', 'Beroperasi di orbit Bulan minimal 1 tahun'],
        },
        target: 70,
        reqs: [
          { type: 'cap', caps: ['neutron', 'ir-spectro'], mode: 'any', label: 'Carry a neutron or infrared spectrometer' },
          { type: 'delivery', min: 0.9, label: 'Deliver at least 90% of data to Earth' },
          { type: 'life', min: 1, label: 'Operate in lunar orbit for at least 1 year' },
        ],
      },
      {
        id: 'landing',
        name: 'Map landing sites',
        desc: 'Map terrain height and boulders so a crewed lander can touch down safely.',
        idn: {
          name: 'Petakan lokasi pendaratan',
          desc: 'Petakan ketinggian medan dan bebatuan agar wahana berawak bisa mendarat dengan aman.',
          reqs: ['Membawa altimeter laser dan kamera', 'Mengirim minimal 90% data ke Bumi', 'Beroperasi di orbit Bulan minimal 2 tahun'],
        },
        target: 60,
        weights: { altimeter: 1, optical: 1, neutron: 0.5, 'ir-spectro': 0.5, radar: 0.6 },
        reqs: [
          { type: 'cap', caps: ['altimeter', 'optical'], mode: 'all', label: 'Carry a laser altimeter and a camera' },
          { type: 'delivery', min: 0.9, label: 'Deliver at least 90% of data to Earth' },
          { type: 'life', min: 2, label: 'Operate in lunar orbit for at least 2 years' },
        ],
      },
    ],
    starter: {
      bus: 'smallsat', instruments: ['neutron', 'irspec'], orbit: 'lunar-100', count: 1, launcher: 'lv-medium', solar: 'sa-fixed',
      battery: 'bat-500', adcs: 'adcs-prec', propulsion: 'prop-biprop', propellant: 60, radio: 'rad-hga', network: 'dsn', ops: 'ops-lean',
    },
    guide: {
      ice: { bus: 'smallsat', instruments: ['neutron', 'irspec'], orbit: 'lunar-100', count: 1, launcher: 'lv-medium', solar: 'sa-fixed',
        battery: 'bat-500', adcs: 'adcs-prec', propulsion: 'prop-biprop', radio: 'rad-hga', network: 'dsn', ops: 'ops-standard' },
      landing: { bus: 'smallsat', instruments: ['altimeter', 'optical-cube'], orbit: 'lunar-100', count: 1, launcher: 'lv-medium', solar: 'sa-track',
        battery: 'bat-500', adcs: 'adcs-prec', propulsion: 'prop-biprop', radio: 'rad-hga', network: 'dsn', ops: 'ops-standard' },
    },
    imagery: {
      title: 'Real NASA data: the Moon mapped by LRO',
      src: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg',
      caption:
        'Global color map of the Moon built from NASA Lunar Reconnaissance Orbiter camera images. The poles (top and bottom edges) hold ' +
        'permanently shadowed craters where ice may survive for billions of years.',
      credit: 'NASA Scientific Visualization Studio, CGI Moon Kit (LRO LROC data)',
      link: 'https://svs.gsfc.nasa.gov/4720/',
      idn: {
        title: 'Data NASA asli: Bulan yang dipetakan LRO',
        caption:
          'Peta warna global Bulan dari citra kamera NASA Lunar Reconnaissance Orbiter. Kutub (tepi atas dan bawah) menyimpan kawah ' +
          'yang selalu gelap, tempat es mungkin bertahan miliaran tahun.',
      },
    },
    analogs: [
      { name: 'Lunar Prospector', agency: 'NASA', year: '1998',
        text: 'A small, low-cost orbiter in a 100 km polar orbit. Its neutron spectrometer found extra hydrogen at both poles, the first strong hint of polar ice.',
        idn: { text: 'Orbiter kecil berbiaya rendah di orbit polar 100 km. Spektrometer neutronnya menemukan kelebihan hidrogen di kedua kutub, petunjuk kuat pertama adanya es di kutub.' },
        match: { instruments: ['neutron'], buses: ['smallsat'] } },
      { name: 'Lunar Reconnaissance Orbiter', agency: 'NASA', year: '2009',
        text: 'A large orbiter with a laser altimeter, cameras and a neutron detector. Its Ka-band link returns data at up to 100 Mbps, and it is still mapping the Moon.',
        idn: { text: 'Orbiter besar dengan altimeter laser, kamera, dan detektor neutron. Tautan Ka-band-nya mengirim data hingga 100 Mbps, dan masih memetakan Bulan hingga kini.' },
        match: { buses: ['medium'], radios: ['rad-ka'], instruments: ['altimeter', 'optical-hr'] } },
      { name: 'ShadowCam on Danuri (KPLO)', agency: 'NASA / KASA', year: '2022',
        text: 'A NASA camera sensitive enough to image inside permanently shadowed craters by faint reflected light, flying on Korea\'s first lunar orbiter.',
        idn: { text: 'Kamera NASA yang cukup peka untuk memotret bagian dalam kawah yang selalu gelap dengan cahaya pantulan yang redup, terbang di orbiter Bulan pertama Korea.' },
        match: { instruments: ['optical-hr', 'optical-cube'] } },
      { name: 'Lunar Flashlight & LunaH-Map', agency: 'NASA', year: '2022',
        text: 'CubeSats built to hunt lunar ice. Both had propulsion problems and could not reach their planned lunar orbits: a reminder that delta-v and propulsion reliability decide everything.',
        idn: { text: 'CubeSat yang dibuat untuk berburu es Bulan. Keduanya mengalami masalah propulsi dan gagal mencapai orbit Bulan yang direncanakan: pengingat bahwa delta-v dan keandalan propulsi menentukan segalanya.' },
        match: { buses: ['cube6u', 'cube12u'] } },
      { name: 'Lunar Trailblazer', agency: 'NASA', year: '2025',
        text: 'A SmallSat with an infrared spectrometer to map lunar water. Contact was lost shortly after launch, a hard lesson in how risky small deep-space missions are.',
        idn: { text: 'SmallSat dengan spektrometer inframerah untuk memetakan air di Bulan. Kontak hilang tak lama setelah peluncuran, pelajaran berat tentang betapa berisikonya misi kecil ke antariksa jauh.' },
        match: { buses: ['smallsat'], instruments: ['irspec'] } },
    ],
  },
  {
    id: 'solar',
    name: 'Solar Sentinel',
    kind: 'Space weather',
    where: 'Sun–Earth L1',
    icon: 'sun',
    accent: '#ffd166',
    tagline: 'Give Earth an hour of warning before a solar storm hits.',
    brief:
      'Solar storms can knock out power grids, GPS and satellites. A spacecraft at the L1 point, 1.5 million km toward the Sun, ' +
      'feels the solar wind about an hour before Earth does. Your sentinel must reach L1, measure each incoming storm and radio the ' +
      'warning home.',
    users: 'Space weather forecasters, power grid and satellite operators, and astronauts',
    idn: {
      kind: 'Cuaca antariksa',
      where: 'L1 Matahari–Bumi',
      tagline: 'Beri Bumi peringatan satu jam sebelum badai Matahari datang.',
      brief:
        'Badai Matahari bisa melumpuhkan jaringan listrik, GPS, dan satelit. Wahana di titik L1, 1,5 juta km ke arah Matahari, ' +
        'merasakan angin Matahari sekitar satu jam lebih awal dari Bumi. Penjagamu harus mencapai L1, mengukur setiap badai yang ' +
        'datang, dan mengirim peringatan pulang.',
      users: 'Peramal cuaca antariksa, operator jaringan listrik dan satelit, serta astronaut',
    },
    budget: 200,
    deadline: 48,
    weights: { magnetometer: 1, plasma: 1, coronagraph: 0.8, particles: 0.7, optical: 0.2 },
    priorities: [
      {
        id: 'warning',
        name: 'Storm early warning',
        desc: 'Measure the solar wind and its magnetic field continuously for years.',
        idn: {
          name: 'Peringatan dini badai',
          desc: 'Ukur angin Matahari dan medan magnetnya terus-menerus selama bertahun-tahun.',
          reqs: ['Membawa magnetometer dan penganalisis plasma', 'Mengirim minimal 95% data ke Bumi', 'Beroperasi di L1 minimal 5 tahun'],
        },
        target: 50,
        reqs: [
          { type: 'cap', caps: ['magnetometer', 'plasma'], mode: 'all', label: 'Carry a magnetometer and a plasma analyzer' },
          { type: 'delivery', min: 0.95, label: 'Deliver at least 95% of data to Earth' },
          { type: 'life', min: 5, label: 'Operate at L1 for at least 5 years' },
        ],
      },
      {
        id: 'imaging',
        name: 'CME imaging',
        desc: 'Photograph eruptions leaving the Sun to predict which ones are headed our way.',
        idn: {
          name: 'Pencitraan CME',
          desc: 'Potret letusan yang meninggalkan Matahari untuk memprediksi mana yang mengarah ke Bumi.',
          reqs: ['Membawa koronagraf dan penganalisis plasma', 'Mengirim minimal 90% data ke Bumi', 'Beroperasi di L1 minimal 3 tahun'],
        },
        target: 55,
        weights: { coronagraph: 1, plasma: 0.8, magnetometer: 0.7, particles: 0.6 },
        reqs: [
          { type: 'cap', caps: ['coronagraph', 'plasma'], mode: 'all', label: 'Carry a coronagraph and a plasma analyzer' },
          { type: 'delivery', min: 0.9, label: 'Deliver at least 90% of data to Earth' },
          { type: 'life', min: 3, label: 'Operate at L1 for at least 3 years' },
        ],
      },
    ],
    starter: {
      bus: 'smallsat', instruments: ['magnetometer', 'plasma'], orbit: 'l1-halo', count: 1, launcher: 'lv-medium', solar: 'sa-fixed',
      battery: 'bat-120', adcs: 'adcs-rw', propulsion: 'prop-mono', propellant: 20, radio: 'rad-x', network: 'dsn', ops: 'ops-standard',
    },
    guide: {
      warning: { bus: 'smallsat', instruments: ['magnetometer', 'plasma', 'particles'], orbit: 'l1-halo', count: 1, launcher: 'lv-medium', solar: 'sa-fixed',
        battery: 'bat-120', adcs: 'adcs-prec', propulsion: 'prop-mono', radio: 'rad-hga', network: 'dsn', ops: 'ops-standard' },
      imaging: { bus: 'smallsat', instruments: ['coronagraph', 'plasma', 'magnetometer'], orbit: 'l1-halo', count: 1, launcher: 'lv-medium', solar: 'sa-fixed',
        battery: 'bat-120', adcs: 'adcs-prec', propulsion: 'prop-mono', radio: 'rad-ka', network: 'dsn', ops: 'ops-standard' },
    },
    imagery: {
      title: 'Real NASA data: today\'s Sun',
      src: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0193.jpg',
      caption:
        'The Sun right now, seen by NASA\'s Solar Dynamics Observatory in extreme ultraviolet (AIA 193 Å). The image updates every few minutes. ' +
        'Bright active regions launch the flares and eruptions your sentinel must catch.',
      credit: 'NASA / SDO and the AIA science team',
      link: 'https://sdo.gsfc.nasa.gov/data/',
      idn: {
        title: 'Data NASA asli: Matahari hari ini',
        caption:
          'Matahari saat ini, dilihat Solar Dynamics Observatory NASA dalam ultraungu ekstrem (AIA 193 Å). Citra diperbarui setiap beberapa menit. ' +
          'Wilayah aktif yang terang melontarkan suar dan letusan yang harus ditangkap penjagamu.',
      },
    },
    analogs: [
      { name: 'ACE', agency: 'NASA', year: '1997',
        text: 'The Advanced Composition Explorer has measured the solar wind from L1 for decades, giving forecasters their early warning of incoming storms.',
        idn: { text: 'Advanced Composition Explorer telah mengukur angin Matahari dari L1 selama puluhan tahun, memberi peramal peringatan dini akan badai yang datang.' },
        match: { instruments: ['magnetometer', 'plasma', 'particles'] } },
      { name: 'SOHO', agency: 'ESA / NASA', year: '1995',
        text: 'A solar observatory at L1 whose LASCO coronagraph has photographed thousands of eruptions and discovered thousands of comets.',
        idn: { text: 'Observatorium Matahari di L1 yang koronagraf LASCO-nya telah memotret ribuan letusan dan menemukan ribuan komet.' },
        match: { instruments: ['coronagraph'] } },
      { name: 'DSCOVR', agency: 'NOAA / NASA', year: '2015',
        text: 'Took over real-time solar wind monitoring at L1 and also photographs the full sunlit Earth.',
        idn: { text: 'Mengambil alih pemantauan angin Matahari secara real-time di L1 dan juga memotret seluruh sisi Bumi yang tersinari.' },
        match: { buses: ['medium'] } },
      { name: 'Aditya-L1', agency: 'ISRO', year: '2023',
        text: 'India\'s first solar observatory, in a halo orbit around L1, carrying a coronagraph plus solar wind and magnetic field instruments.',
        idn: { text: 'Observatorium Matahari pertama India, di orbit halo sekitar L1, membawa koronagraf serta instrumen angin Matahari dan medan magnet.' },
        match: { instruments: ['coronagraph', 'plasma'] } },
      { name: 'IMAP', agency: 'NASA', year: '2025',
        text: 'Launched to L1 together with two other missions on one rocket. Sharing a ride is a common way to cut launch costs.',
        idn: { text: 'Diluncurkan ke L1 bersama dua misi lain dalam satu roket. Berbagi tumpangan adalah cara umum menekan biaya peluncuran.' },
        match: { launchers: ['lv-rideshare', 'lv-mediumheavy'] } },
    ],
  },
];

export const DIFFICULTIES = [
  { id: 'cadet', name: 'Cadet', budgetMult: 1.4, events: 1, failures: false, hints: true,
    blurb: 'Bigger budget, "Suggested" hints on good options, and only good surprises during flight.',
    idn: { name: 'Kadet', blurb: 'Anggaran lebih besar, petunjuk "Disarankan" pada pilihan yang baik, dan hanya kejutan baik selama penerbangan.' } },
  { id: 'engineer', name: 'Engineer', budgetMult: 1, events: 3, failures: true, hints: false,
    blurb: 'Realistic budget. Expect a few problems in flight.',
    idn: { name: 'Insinyur', blurb: 'Anggaran realistis. Bersiaplah menghadapi beberapa masalah dalam penerbangan.' } },
  { id: 'director', name: 'Flight Director', budgetMult: 0.85, events: 5, failures: true, hints: false, massGrowth: true, launchRisk: true,
    blurb: 'Tight budget, frequent anomalies, mass growth before launch, and real launch risk.',
    idn: { name: 'Flight Director', blurb: 'Anggaran ketat, anomali sering terjadi, pertambahan massa sebelum peluncuran, dan risiko peluncuran nyata.' } },
];

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

export function getPriority(scenario, id) {
  return scenario?.priorities.find((p) => p.id === id) ?? scenario?.priorities[0] ?? null;
}

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
