import { env } from "../env";

const GITHUB_URL = "https://github.com/reacto11mecha/wuno-bot";
const AUTHOR = "Ezra Khairan Permana";

/**
 * Main github repository for this project
 */
/**
 * Greeting template for all help message
 */
export const greeting = `Halo, saya adalah bot untuk bermain uno.
Prefix: \`\`\`${env.PREFIX}\`\`\``;

/**
 * Footer template for all help message
 */
export const footer = `Sumber Kode: ${GITHUB_URL}

Dibuat oleh ${AUTHOR} di bawah lisensi MIT.`;

/**
 * General information about this bot
 */
export const botInfo = `${greeting}

Untuk perintah lengkap ketik:
\`\`\`${env.PREFIX}help\`\`\`

${footer}`;

/**
 * Function for generate dynamic of all available commands name and serve other information
 * @param commands All valid commands available
 * @returns Help message string template
 */
export const helpTemplate = (commands: string[]) => `${greeting}

*Daftar Perintah*
============
${commands
  .sort((a, b) => a.localeCompare(b))
  .map(
    (command, idx) =>
      `- ${`\`\`\`${command}\`\`\``}${idx !== commands.length - 1 ? "\n" : ""}`,
  )
  .join("")}

*Disclaimer*
=========
Bot ini menyimpan data *nomor telepon* serta *username* kamu untuk keperluan mekanisme permainan.

Sebelum kamu bermain kamu telah *mengetahui* serta *menyetujui* bahwa kamu *mengizinkan* datamu untuk disimpan.

Jika ingin *menghapus* data, silahkan *hubungi operator bot* yang bertanggung jawab.

*Ikhtisar*
======
Bot ini adalah bot yang digunakan untuk bermain uno di whatsapp. Cara kerjanya dengan mengirimkan perintah lewat DM pribadi ke bot ini, tapi masih bisa digunakan di grup semisal untuk membuat permainan.

Untuk membuat permainan caranya dengan menjalankan 

\`\`\`${env.PREFIX}creategame\`\`\` (atau \`\`\`${env.PREFIX}cg\`\`\`) 

dan akan membuat kode yang bisa diteruskan ke orang lain.

Orang yang diberikan meneruskan kembali kode itu ke bot dan akan masuk ke sesi permainan sesuai dengan kode yang sudah diberikan sebelumnya.

Setelah dirasa sudah cukup orang, permainan bisa dimulai menggunakan 

\`\`\`${env.PREFIX}startgame\`\`\` (atau \`\`\`${env.PREFIX}sg\`\`\`)

kartu akan diberikan dan permainan dimulai.


Untuk bermain, gunakan 

\`\`\`${env.PREFIX}play <kartu kamu>\`\`\`
(atau \`\`\`${env.PREFIX}p <kartu kamu>\`\`\`) 

untuk menaruh kartu yang sesuai dengan apa yang ada di deck. 

Jika valid, kartu akan ditaruh dan giliran bermain akan beralih ke pemain selanjutnya.


Jika kamu tidak memiliki kartu ambilah kartu baru dengan menggunakan 

\`\`\`${env.PREFIX}draw\`\`\` (atau \`\`\`${env.PREFIX}d\`\`\`) 

maka kartu baru akan diambil dan giliran bermain akan beralih ke pemain selanjutnya.

Untuk berkomunikasi dengan pemain lain di game, gunakan 

\`\`\`${env.PREFIX}say <pesan mu>\`\`\`


Untuk melihat lebih jelas apa maksud dari perintah, gunakan

\`\`\`${env.PREFIX}help <nama lengkap perintah>\`\`\`


${footer}`;

/**
 * Function for generate specific command can do
 * @param command Command name
 * @param explanation Explanation about what the command will do
 * @param alias List of all command alias available
 * @param messageExample Example of the command if triggered
 * @param param Parameter explanation (optional)
 * @returns  Template string for replying specific command
 */
const replyBuilder = (
  command: string,
  explanation: string,
  alias: string[],
  messageExample: string,
  param?: string,
) => `${greeting}

  ${command.charAt(0).toUpperCase() + command.slice(1)}
  ${Array.from({ length: command.length }).fill("=").join("")}
  ${explanation}
  
  Contoh penggunaan:
  \`\`\`${env.PREFIX}${command}${param ? ` ${param}` : ""}\`\`\`

  Alias: ${alias.map((a) => `\`\`\`${a}\`\`\``).join(", ")}

  Contoh balasan:
  ${messageExample}

${footer}`;

/**
 * All replies string collection for help message
 */
export const replies = {
  ban: replyBuilder(
    "ban",
    "Perintah ini digunakan untuk menge-ban pemain berdasarkan nama atau nomor WhatsApp. Nama boleh ditulis sebagian, misalnya `basuki` atau `uki` untuk pemain bernama `Muhammad basuki`.",
    ["b"],
    '"Berhasil ban pemain Muhammad basuki. Sekarang dia tidak ada dalam permainan."',
    "<nama sebagian atau nomor WhatsApp yang ingin di-ban>",
  ),

  unban: replyBuilder(
    "unban",
    "Perintah ini digunakan oleh pembuat game untuk menghapus ban pemain berdasarkan nama atau nomor WhatsApp. Nama boleh ditulis sebagian.",
    ["ub"],
    '"Berhasil unban Muhammad basuki. Dia sekarang bisa join kembali ke permainan ini."',
    "<nama sebagian atau nomor WhatsApp yang ingin di-unban>",
  ),
  cards: replyBuilder(
    "cards",
    "Perintah ini digunakan untuk mengecek kartu yang ada pada saat kamu bermain.",
    ["c"],
    '"Kartu kamu: greenskip, yellow4, red6, blue1"',
  ),

  creategame: replyBuilder(
    "creategame",
    `Perintah ini digunakan untuk membuat permainan baru. 

  Setelah kode berhasil dibuat, bot akan mengirimkan kode yang bisa diteruskan ke pemain lain agar bisa bergabung ke dalam permainan.`,
    ["cg", "create"],
    `"Game berhasil dibuat.
    
  Ajak teman kamu untuk bermain..."`,
  ),

  draw: replyBuilder(
    "draw",
    `Perintah ini digunakan untuk mengambil kartu baru pada saat giliranmu.
  
  Terkadang kamu tidak memiliki kartu yang pas pada saat bermain, perintah ini bertujuan untuk mengambil kartu baru.`,
    ["d", "pickup", "newcard"],
    '"Berhasil mengambil kartu baru, *red6*. Selanjutnya adalah giliran A untuk bermain"',
  ),

  endgame: replyBuilder(
    "endgame",
    `Perintah ini digunakan untuk menghentikan permainan yang belum/sedang berjalan.
    
  Perintah ini hanya bisa digunakan oleh orang yang membuat permainan.`,
    ["eg", "end"],
    '"A telah menghentikan permainan. Terimakasih sudah bermain!"',
  ),

  infogame: replyBuilder(
    "infogame",
    `Perintah ini digunakan untuk mengetahui informasi dari sebuah permainan.
    
  Jika kamu sudah memasuki sebuah permainan, tidak perlu memasukan id game, tetapi kalau belum diperlukan id game tersebut.`,
    ["i", "ig", "info"],
    '"Game ID: XXXXXX..."',
    "<id game>",
  ),

  joingame: replyBuilder(
    "joingame",
    `Perintah ini digunakan untuk masuk ke sebuah permainan.
    
  Diperlukan id dari game yang sudah dibuat, biasanya tidak perlu mengetikkan lagi karena sudah diberikan oleh pembuat gamenya langsung.`,
    ["j", "jg", "join"],
    '"Berhasil join ke game "XXXX", tunggu pembuat ruang game ini memulai permainannya!"',
    "<id game>",
  ),

  kick: replyBuilder(
    "kick",
    "Perintah ini digunakan untuk kick pemain berdasarkan nama atau nomor WhatsApp. Nama boleh ditulis sebagian, misalnya `basuki` atau `uki` untuk pemain bernama `Muhammad basuki`.",
    ["k"],
    '"Berhasil mengeluarkan pemain Muhammad basuki dari permainan."',
    "<nama sebagian atau nomor WhatsApp yang ingin di-kick>",
  ),

  leaderboard: replyBuilder(
    "leaderboard",
    `Perintah ini digunakan untuk mengetahui siapa saja terampil dalam bermain.
    
  Akan terdapat list nama pemain, berapa permainan yang dimainkan, dan rata-rata permainan.`,
    ["board", "lb"],
    "Papan peringkat pemain saat ini",
  ),

  leavegame: replyBuilder(
    "leavegame",
    `Perintah ini digunakan untuk keluar dari sebuah permainan.
    
  Perintah ini bisa digunakan pada saat permainan atau saat menunggu.`,
    ["l", "lg", "quit", "leave", "leavegame"],
    '"Anda berhasil keluar dari game. Terimakasih telah bermain!"',
  ),

  play: replyBuilder(
    "play",
    `Perintah ini digunakan untuk mengeluarkan kartu dalam sebuah permainan.
    
    Jika kartu cocok akan ditaruh ke deck dan pemain selanjutnya akan mendapatkan giliran.
    
    Kamu juga bisa menaruh beberapa kartu angka yang sama dalam satu giliran, misalnya \`U# play red5 red5 red5\`. Semua kartu harus sama persis dan kartu aksi atau kartu wild tetap dimainkan satu per satu.
    
    Untuk lebih cepat, kamu juga bisa langsung mengetik U# g6, U# y6, U# rs, atau U# w4 tanpa menulis U#p.`,
    ["p"],
    '"Berhasil mengeluarkan kartu *red9*, selanjutnya adalah giliran B untuk bermain"',
    "<kartu>",
  ),

  say: replyBuilder(
    "say",
    `Perintah ini digunakan untuk mengirim sesuatu dalam sebuah permainan.
    
  Untuk foto atau GIF, tulis perintah ini sebagai caption media: \`${env.PREFIX}say\` atau \`${env.PREFIX}say <keterangan>\`. Untuk stiker, kirim stikernya lalu balas dengan memberikan perintah \`${env.PREFIX}say\`; bot akan meneruskan stiker dan caption terpisah. Teknik balas/quote juga berlaku untuk foto, GIF, dan stiker. Selain itu, bisa mengirim teks biasa.`,
    ["s"],
    '"USERNAME: pesan disini"',
    "<pesan (wajib jika hanya mengirimkan text)>",
  ),

  sayto: replyBuilder(
    "sayto",
    "Perintah ini digunakan untuk mengirim teks, GIF, gambar, atau stiker hanya ke satu pemain. Target boleh berupa sebagian nama atau nomor WhatsApp; nama yang terdiri dari beberapa kata juga bisa digunakan. Jika nama cocok dengan beberapa pemain, bot akan meminta nama yang lebih spesifik.",
    ["st"],
    '"USERNAME: pesan disini"',
    "<nama/nomor> <pesan>",
  ),

  listban: replyBuilder(
    "listban",
    "Perintah ini digunakan oleh pembuat game untuk melihat pemain yang sudah di-ban, lengkap dengan nama dan nomor WhatsApp.",
    ["lban"],
    '"Muhammad basuki (628123456789)"',
  ),

  startgame: replyBuilder(
    "startgame",
    `Perintah ini digunakan untuk memulai permainan yang belum berjalan.
    
  Perintah ini hanya bisa digunakan oleh orang yang membuat permainan.`,
    ["sg", "start"],
    '"Game berhasil dimulai! Sekarang giliran C untuk bermain"',
  ),

  uno: replyBuilder(
    "uno",
    `Gunakan saat kartu kamu tersisa satu.

    Tidak ada peringatan otomatis. Jika pemain terbaru yang tinggal satu kartu lupa mengatakan UNO, pemain lain dapat mengetik \`U# uno\` untuk memberinya satu kartu penalti.

    Jika kamu tinggal satu kartu, ketik \`U# uno\` untuk melindungi diri. Ketika pemain lain sudah menyusul tinggal satu kartu, kesempatan pemain sebelumnya berakhir.`,
    [],
    '"UNO tercatat. Kamu aman dari penalti satu kartu."',
  ),
};
