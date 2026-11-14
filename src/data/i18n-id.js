// Bahasa Indonesia text for catalog items, roles and labels (keyed by id).

export const ID_TEXT = {
  // Roles
  science: { name: 'Sains', title: 'Peneliti Utama (PI)', segment: 'Segmen pengguna',
    blurb: 'Memegang tujuan misi. Memilih instrumen dan memperjuangkan hasil sains.' },
  launch: { name: 'Orbit & Peluncuran', title: 'Petugas Orbit & Peluncuran', segment: 'Segmen peluncuran',
    blurb: 'Memilih ke mana wahana terbang, berapa banyak yang dibuat, dan roket yang mengantarnya.' },
  spacecraft: { name: 'Wahana', title: 'Insinyur Wahana', segment: 'Segmen antariksa',
    blurb: 'Membangun bus: struktur, daya, baterai, pengarahan, dan propulsi. Menjaga margin.' },
  ground: { name: 'Darat & Komunikasi', title: 'Pimpinan Darat & Komunikasi', segment: 'Segmen darat',
    blurb: 'Membawa data pulang: radio, stasiun bumi, dan tim operasi.' },
  mission: { name: 'Misi', title: 'Flight Director', segment: 'Seluruh misi' },

  // Buses
  cube6u: { name: '6U CubeSat', blurb: 'Seukuran kotak sepatu (10 × 20 × 30 cm). Murah dan cepat dibuat, tapi massa, daya, dan ruangnya sangat terbatas.' },
  cube12u: { name: '12U CubeSat', blurb: 'Dua kotak sepatu berdampingan. Ada ruang untuk instrumen kecil ketiga atau modul propulsi.' },
  smallsat: { name: 'SmallSat (kelas ESPA)', blurb: 'Seukuran kulkas mini. Muat instrumen menengah, propulsi sungguhan, dan elektronik yang lebih tangguh.' },
  medium: { name: 'Wahana menengah', blurb: 'Seukuran mobil. Muat instrumen dan antena besar, tapi setiap kilogram menaikkan biaya peluncuran.' },

  // Instruments
  'tir-wide': { name: 'Radiometer Termal Sapuan Lebar', blurb: 'Melihat jalur selebar 1.800 km dengan detail ~1 km. Menemukan gunung api dan kebakaran yang panas hampir setiap hari.' },
  'tir-hr': { name: 'Kamera Termal Resolusi Tinggi', blurb: 'Memetakan aliran lava dengan detail ~70 m, tapi jalurnya sempit sehingga kunjungan ulang butuh berhari-hari.' },
  'tir-cube': { name: 'Kamera Termal CubeSat', blurb: 'Kamera termal yang cukup kecil untuk CubeSat. Teknologi baru: lebih murah, tapi lebih berisiko.' },
  msi: { name: 'Pencitra Multispektral', blurb: 'Melihat warna di luar jangkauan mata manusia: kepulan abu, lahan terbakar, dan kesehatan tanaman.' },
  'optical-hr': { name: 'Kamera Optik Resolusi Tinggi', blurb: 'Bisa melihat mobil dan rumah (~1 m). Butuh wahana yang sangat stabil dan menghasilkan data sangat besar.' },
  'optical-cube': { name: 'Kamera Optik CubeSat', blurb: 'Teleskop kecil untuk CubeSat. Cukup untuk melihat desa dan garis pantai.' },
  sar: { name: 'Radar Apertur Sintetis (SAR)', blurb: 'Memancarkan gelombang mikro sendiri, jadi menembus awan dan gelap malam, serta bisa mengukur penggembungan tanah.' },
  neutron: { name: 'Spektrometer Neutron', blurb: 'Menghitung neutron yang lolos dari permukaan. Neutron cepat yang lebih sedikit menandakan hidrogen, petunjuk adanya es air.' },
  'neutron-mini': { name: 'Spektrometer Neutron Mini', blurb: 'Detektor neutron seukuran CubeSat. Kurang peka dan belum seteruji versi besarnya.' },
  irspec: { name: 'Spektrometer Inframerah', blurb: 'Memecah cahaya pantulan menjadi ratusan warna untuk mengenali mineral, air, dan gas seperti SO2.' },
  altimeter: { name: 'Altimeter Laser', blurb: 'Menembakkan pulsa laser dan mengukur waktu pantulnya untuk memetakan ketinggian medan, bahkan di dalam kawah gelap.' },
  magnetometer: { name: 'Magnetometer Fluxgate', blurb: 'Mengukur medan magnet yang dibawa angin Matahari. Arahnya menentukan seberapa keras badai menghantam Bumi.' },
  plasma: { name: 'Penganalisis Plasma Angin Matahari', blurb: 'Mengukur kecepatan, kerapatan, dan suhu angin Matahari yang melintas.' },
  particles: { name: 'Detektor Partikel Energetik', blurb: 'Menghitung proton berenergi tinggi dari suar Matahari, radiasi yang mengancam astronaut dan satelit.' },
  coronagraph: { name: 'Koronagraf', blurb: 'Menutupi Matahari dengan piringan kecil untuk memotret korona yang redup dan letusan yang meninggalkan Matahari.' },
  iot: { name: 'Radio IoT Simpan-dan-Teruskan', blurb: 'Mengumpulkan pesan singkat dari sensor dan ponsel di darat, lalu meneruskannya saat melintas di atas stasiun.' },
  ais: { name: 'Penerima AIS Pelacak Kapal', blurb: 'Mendengarkan sinyal posisi yang dipancarkan kapal. Membantu mendeteksi penangkapan ikan ilegal dan kapal dalam bahaya.' },

  // Solar arrays
  'sa-body': { name: 'Sel surya di badan wahana', blurb: 'Sel surya yang menempel di sisi wahana. Tanpa bagian bergerak, tapi jarang menghadap Matahari secara tegak.' },
  'sa-fixed': { name: 'Sayap lipat tetap', blurb: 'Panel yang membuka setelah peluncuran dengan sudut tetap. Seimbang antara daya, massa, dan biaya.' },
  'sa-track': { name: 'Sayap pelacak Matahari', blurb: 'Sayap bermotor yang berputar menghadap Matahari. Daya paling besar, dengan massa dan biaya tertinggi.' },
  'sa-xl': { name: 'Sayap pelacak besar', blurb: 'Sayap raksasa untuk muatan yang rakus daya seperti radar.' },

  // Batteries
  'bat-40': { name: 'Baterai 40 Wh' },
  'bat-120': { name: 'Baterai 120 Wh' },
  'bat-500': { name: 'Baterai 500 Wh' },
  'bat-1500': { name: 'Baterai 1,5 kWh' },
  'bat-5000': { name: 'Baterai 5 kWh' },
  'bat-15000': { name: 'Baterai 15 kWh' },

  // Attitude control
  'adcs-mtq': { name: 'Magnetorquer + sensor Matahari', blurb: 'Elektromagnet yang "mendorong" medan magnet Bumi. Sederhana dan murah, tapi kasar, dan tidak berguna jauh dari Bumi.' },
  'adcs-rw': { name: 'Roda reaksi + sensor Matahari', blurb: 'Roda berputar yang memutar wahana dengan presisi. Putaran berlebih dibuang dengan magnetorquer (dekat Bumi) atau pendorong (di tempat lain).' },
  'adcs-prec': { name: 'Presisi: roda reaksi + star tracker', blurb: 'Kamera bintang memberi tahu arah wahana dengan tepat. Diperlukan untuk kamera tajam, koronagraf, dan berkas radio sempit.' },

  // Propulsion
  'prop-none': { name: 'Tanpa propulsi', blurb: 'Lebih ringan dan murah, tapi tidak bisa mengubah orbit, menghindari sampah antariksa, atau deorbit di akhir misi.' },
  'prop-cold': { name: 'Pendorong gas dingin', blurb: 'Menyemburkan gas bertekanan. Sangat aman dan sederhana, tapi dorongannya hanya cukup untuk koreksi kecil.' },
  'prop-mono': { name: 'Pendorong monopropelan', blurb: 'Bahan bakar terurai di atas katalis panas. Andalan untuk menjaga orbit dan manuver menghindar.' },
  'prop-biprop': { name: 'Mesin bipropelan', blurb: 'Bahan bakar dan oksidator dibakar bersama. Cukup kuat dan efisien untuk mengerem masuk ke orbit Bulan.' },
  'prop-electric': { name: 'Pendorong listrik (ion / Hall)', blurb: 'Mempercepat gas bermuatan dengan listrik. Sepuluh kali lebih hemat bahan bakar, tapi dorongannya lembut dan boros daya.' },

  // Radios
  'rad-uhf': { name: 'Radio UHF', blurb: 'Radio ala amatir dengan antena cambuk. Bekerja di mana saja di orbit rendah, tapi datanya hanya sedikit.' },
  'rad-s': { name: 'Transceiver S-band', blurb: 'Radio standar untuk perintah dan telemetri. Andal, berkas lebar, laju data sedang.' },
  'rad-x': { name: 'Pemancar X-band', blurb: 'Frekuensi lebih tinggi untuk data sains yang lebih cepat. Harus diarahkan kira-kira ke stasiun bumi.' },
  'rad-hga': { name: 'Parabola high-gain X-band', blurb: 'Parabola 1 m yang bisa diarahkan memfokuskan sinyal menjadi berkas sempit, sangat penting untuk jarak jauh.' },
  'rad-ka': { name: 'Sistem laju tinggi Ka-band', blurb: 'Frekuensi sangat tinggi dengan parabola sendiri. Laju data sangat besar, tapi hujan lebat bisa memblokirnya.' },

  // Ground networks
  single: { name: 'Satu stasiun: Surabaya', blurb: 'Satu parabola 5 m di kampus universitas di Surabaya (7,3° LS). Murah, tapi hanya melihatmu saat melintas di atasnya.' },
  commercial: { name: 'Jaringan komersial: 12 stasiun', blurb: 'Sewa waktu antena di seluruh dunia, termasuk stasiun kutub yang melihat satelit sinkron-Matahari setiap orbit.' },
  dsn: { name: 'NASA Deep Space Network', blurb: 'Parabola raksasa 34 m dan 70 m di California, Spanyol, dan Australia, berjarak sekitar 120°, sehingga wahana antariksa jauh selalu terlihat salah satunya.' },

  // Operations teams
  'ops-lean': { name: 'Tim ramping', people: '2 orang, jam kantor', blurb: 'Murah, tapi lambat bereaksi kalau ada yang rusak jam 3 pagi.' },
  'ops-standard': { name: 'Tim standar', people: '8 orang, siaga', blurb: 'Cukup insinyur untuk merencanakan operasi harian dan memperbaiki sebagian besar anomali.' },
  'ops-full': { name: 'Tim penerbangan penuh', people: '25 orang, 24/7', blurb: 'Mission control sepanjang waktu. Mahal, tapi hampir semua masalah terpecahkan.' },

  // Launchers
  'lv-rideshare': { name: 'Slot rideshare', examples: 'misi SpaceX Transporter; CubeSat di Artemis I NASA', blurb: 'Berbagi roket dengan muatan lain. Sangat murah, tapi kamu ikut ke mana pun penumpang utama pergi.' },
  'lv-small': { name: 'Roket kecil', examples: 'Rocket Lab Electron (meluncurkan CubeSat CAPSTONE NASA ke Bulan)', blurb: 'Tumpangan khusus untuk satelit kecil: orbitmu, jadwalmu.' },
  'lv-medium': { name: 'Roket menengah', examples: 'ISRO PSLV (meluncurkan LAPAN-A2 milik Indonesia dan Chandrayaan-1 milik India)', blurb: 'Roket menengah yang teruji untuk satelit observasi Bumi dan wahana planet kecil.' },
  'lv-mediumheavy': { name: 'Roket menengah-berat', examples: 'SpaceX Falcon 9; JAXA H3', blurb: 'Membawa wahana besar ke orbit mana pun, termasuk ke Bulan dan L1.' },
  'lv-heavy': { name: 'Roket berat', examples: 'SpaceX Falcon Heavy; ESA Ariane 6; NASA SLS', blurb: 'Kapasitas raksasa untuk misi unggulan. Berlebihan dan sangat mahal untuk kebanyakan misi.' },

  // Orbits
  'leo-iss': { name: 'Orbit rendah ala ISS', blurb: 'Murah dicapai dan dekat Bumi, tapi udara tipis menyeretmu turun dalam sekitar 18 bulan tanpa pendorong.' },
  'sso-550': { name: 'Orbit sinkron-Matahari', blurb: 'Melintasi setiap tempat pada jam lokal yang sama (sekitar 10.30) dengan pencahayaan konsisten. Favorit untuk observasi Bumi.' },
  'sso-dd-750': { name: 'Sinkron-Matahari fajar–senja', blurb: 'Menyusuri garis siang–malam sehingga hampir selalu tersinari Matahari. Bagus untuk radar, buruk untuk kamera, dan bertahan di orbit puluhan tahun.' },
  'leo-eq-550': { name: 'Orbit rendah dekat ekuator', blurb: 'Mengitari dekat ekuator dan melintas di atas Indonesia hampir setiap orbit, tapi tidak pernah melihat lintang di atas sekitar 6°.' },
  geo: { name: 'Orbit geostasioner', blurb: 'Diam di atas satu titik dan melihat Indonesia tanpa henti. Tapi jaraknya 65× lebih jauh dari LEO, dan roket hanya mengantarmu ke orbit transfer.' },
  'lunar-100': { name: 'Orbit polar rendah Bulan', blurb: 'Melintasi kedua kutub Bulan setiap 2 jam. Gravitasi Bulan yang tidak merata ("mascon") membengkokkan orbit, jadi perlu koreksi rutin.' },
  'l1-halo': { name: 'Orbit halo L1 Matahari–Bumi', blurb: 'Titik seimbang antara Bumi dan Matahari. Angin Matahari melewati titik ini sekitar satu jam sebelum sampai ke Bumi. Tidak stabil: harus terus didorong.' },
};

export const ID_CAPS = {
  thermal: 'Inframerah termal',
  multispectral: 'Multispektral',
  optical: 'Pencitraan visual',
  radar: 'Radar (SAR)',
  neutron: 'Spektroskopi neutron',
  'ir-spectro': 'Spektroskopi inframerah',
  altimeter: 'Altimetri laser',
  magnetometer: 'Medan magnet',
  plasma: 'Plasma angin Matahari',
  particles: 'Partikel energetik',
  coronagraph: 'Pencitraan koronagraf',
  iot: 'Relai pesan IoT',
  ais: 'Pelacakan kapal (AIS)',
};

export const ID_LAUNCH_CLASS = {
  leo: 'orbit rendah Bumi',
  sso: 'orbit sinkron-Matahari',
  gto: 'transfer geostasioner',
  deep: 'Bulan / L1',
};
