require('dotenv').config()
const { decryptMedia, Client } = require('@open-wa/wa-automate')
const moment = require('moment-timezone')
moment.tz.setDefault('Asia/Jakarta').locale('id')
const { downloader, cekResi, urlShortener, meme, translate, getLocationData, edukasi, igstalk, nulis } = require('../../lib')
const { msgFilter, color, processTime, isUrl } = require('../../utils')
const mentionList = require('../../utils/mention')
const { uploadImages } = require('../../utils/fetcher')
const sleep = ms => new Promise(res => setTimeout(res, ms))
const { RemoveBgResult, removeBackgroundFromImageBase64 } = require('remove.bg')
const pg = require('pg')

const database = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

const { menuId, menuEn } = require('./text') // Indonesian & English menu

module.exports = msgHandler = async (client = new Client(), message) => {
    try {
        const { type, id, from, t, sender, isGroupMsg, chat, caption, isMedia, mimetype, quotedMsg, quotedMsgObj, mentionedJidList } = message
        let { body } = message
        const { name, formattedTitle } = chat
        let { pushname, verifiedName, formattedName } = sender
        pushname = pushname || verifiedName || formattedName // verifiedName is the name of someone who uses a business account
        const botNumber = await client.getHostNumber() + '@c.us'
        const groupId = isGroupMsg ? chat.groupMetadata.id : ''
        const groupAdmins = isGroupMsg ? await client.getGroupAdmins(groupId) : ''
        const groupMembers = isGroupMsg ? await client.getGroupMembersId(groupId) : ''
        const isGroupAdmins = groupAdmins.includes(sender.id) || false
        const isBotGroupAdmins = groupAdmins.includes(botNumber) || false

        // White list
        var pmWhiteList = process.env.PM_WHITE_LIST
        const isPmWhitelist = pmWhiteList.includes(sender.id)

        var gPremiList = process.env.G_PREMI_LIST
        const isgPremiList = gPremiList.includes(groupId)

        // Owner
        var ownId = process.env.OWNER_PHONE
        const isOwner = ownId.includes(sender.id)

        // Bot Group
        var botGroup = process.env.BOT_GROUP
        const isBotGroup = botGroup.includes(groupId)

        var blackList = process.env.BLACK_LIST
        const isBlackList = blackList.includes(sender.id)

        // Bot Prefix
        const prefix = '!'
        body = (type === 'chat' && body.startsWith(prefix)) ? body : ((type === 'image' && caption) && caption.startsWith(prefix)) ? caption : ''
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase()
        const arg = body.trim().substring(body.indexOf(' ') + 1)
        const args = body.trim().split(/ +/).slice(1)
        const string = args.slice().join(' ')
        const isCmd = body.startsWith(prefix)
        const uaOverride = process.env.UserAgent
        const url = args.length !== 0 ? args[0] : ''
        const isQuotedImage = quotedMsg && quotedMsg.type === 'image'

        // Error message
        const bot = {
            wait: '_Scraping Metadata..._',
            error: {
                notGroup: 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]',
                format: 'Maaf, format pesan salah silahkan periksa menu. [Wrong Format]',
                notAdmin: 'Gagal, perintah ini hanya dapat digunakan oleh admin grup! [Admin Group Only]',
                botNotAdmin: 'Gagal, silahkan tambahkan bot sebagai admin grup! [Bot not Admin]',
                onlyOwner: 'Perintah ini hanya untuk Owner bot [Only Owner Bot]',
                onlyPremi: 'Perintah ini hanya untuk member Premium saja untuk info silakan join group https://telegra.ph/Langganan-Krypton-Bot-10-21 [Only Member Premium]',
                onlyPm: 'Maaf, perintah ini hanya di gunakan di private message saja [PM Only]',
                blackList: 'Maaf, anda masuk dalam global ban (gban) bot ini, anda tidak bisa memakai fitur bot ini, mungkin ada sebelumnya melakukan spam di sini atau di group lain\nAnda bisa join ke group support kami untuk mencabut global bannednya https://chat.whatsapp.com/DAWsRFyVOyyEGZRZfLdzVP',
                ungbanGroup: 'Maaf, untuk fitur ini hanya di group support untuk menghindari penyalah gunaan fitur ini\nTapi para admin bisa Global Ban dengan request di group support kami https://chat.whatsapp.com/DAWsRFyVOyyEGZRZfLdzVP\nDengan cara join dan ketik seperti di bawah:\n#GBAN\nNo:<nomer yang akan di ban>\n@<tag admin>',
                gbanGroup: 'Maaf, untuk fitur ini hanya di group support untuk menghindari penyalah gunaan fitur ini\nTapi para admin bisa Global Ban dengan request di group support kami https://chat.whatsapp.com/DAWsRFyVOyyEGZRZfLdzVP\nDengan cara join dan ketik seperti di bawah:\n#UNGBAN\nNo:<nomer yang akan di ban>\n@<tag admin>'
            }
        }

        // [BETA] Avoid Spam Message
        if (isCmd && msgFilter.isFiltered(from) && !isGroupMsg) { return console.log(color('[SPAM]', 'red'), color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), 'yellow'), color(`${command} [${args.length}]`), 'from', color(pushname)) }
        if (isCmd && msgFilter.isFiltered(from) && isGroupMsg) { return console.log(color('[SPAM]', 'red'), color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), 'yellow'), color(`${command} [${args.length}]`), 'from', color(pushname), 'in', color(name || formattedTitle)) }
        //
        if (!isCmd && !isGroupMsg) { return console.log('[RECV]', color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), 'yellow'), 'Message from', color(pushname)) }
        if (!isCmd && isGroupMsg) { return console.log('[RECV]', color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), 'yellow'), 'Message from', color(pushname), 'in', color(name || formattedTitle)) }
        if (isCmd && !isGroupMsg) { console.log(color('[EXEC]'), color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), 'yellow'), color(`${command} [${args.length}]`), 'from', color(pushname)) }
        if (isCmd && isGroupMsg) { console.log(color('[EXEC]'), color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), 'yellow'), color(`${command} [${args.length}]`), 'from', color(pushname), 'in', color(name || formattedTitle)) }

        // [BETA] Avoid Spam Message
        msgFilter.addFilter(from)

        switch (command) {
        // Menu and TnC
        case 'start' :
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            await client.simulateTyping(from, true)
            await client.sendText(from, 'Hai nama saya KryPtoN Bot, saya di tulis dari *Javascript*,\nsaya di ciptakan oleh Dhimas (KryPtoN) https://kry9ton.tech\nsilakan ketik !help untuk mengetahui fitur ku.')
        break
        case 'speed':
        case 'ping':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            await client.simulateTyping(from, true)
            await client.sendText(from, `Pong!!!!\nSpeed: ${processTime(t, moment())} _Second_`)
            break
        case 'tnc':
            await client.simulateTyping(from, true)
            await client.sendText(from, menuId.textTnC())
            break
        case 'menu':
        case 'help':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            await client.simulateTyping(from, true)
            await client.sendText(from, menuId.textMenu(pushname))
                .then(() => ((isGroupMsg) && (isGroupAdmins)) ? client.sendText(from, 'Menu Admin Grup: *!menuadmin*') : null)
            break
        case 'update':
        case 'channel':
            await client.simulateTyping(from, true)
            await client.reply(from, 'Cek update/news bot di group WhatsApp kami\nhttps://chat.whatsapp.com/DAWsRFyVOyyEGZRZfLdzVP', id)
            break
        case 'menuadmin':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if (!isGroupMsg) return client.reply(from, bot.error.notGroup, id)
            if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
            await client.simulateTyping(from, true)
            await client.sendText(from, menuId.textAdmin())
            break
        case 'premium':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
            await client.simulateTyping(from, true)
            await client.sendText(from, menuId.textPremi(pushname))
            break
        case 'donate':
        case 'donasi':
            await client.simulateTyping(from, true)
            await client.sendText(from, menuId.textDonasi())
            break
        // Sticker Creator
        case 'sticker':
        case 'stiker':
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                  if ((isMedia || isQuotedImage) && args.length === 0) {
                      if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                      const encryptMedia = isQuotedImage ? quotedMsg : message
                      const _mimetype = isQuotedImage ? quotedMsg.mimetype : mimetype
                      const mediaData = await decryptMedia(encryptMedia, uaOverride)
                      const imageBase64 = `data:${_mimetype};base64,${mediaData.toString('base64')}`
                      client.sendImageAsSticker(from, imageBase64).then(() => {
                          client.reply(from, 'Here\'s your sticker')
                          console.log(`Sticker Processed for ${processTime(t, moment())} Second`)
                      })
                  } else if ((isMedia || isQuotedImage) && args[0] === 'nobg') {
                      if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                      if (isGroupMsg) return client.reply(from, bot.error.onlyPm, id)
                      try {
                          const encryptMedia = isQuotedImage ? quotedMsg : message
                          const _mimetype = isQuotedImage ? quotedMsg.mimetype : mimetype
                          const mediaData = await decryptMedia(encryptMedia, uaOverride)
                          const imageBase64 = `data:${_mimetype};base64,${mediaData.toString('base64')}`
                          const base64img = imageBase64
                          const outFile = './out/img/noBg.png'
                          const API = process.env.NOBG_API
                          client.reply(from, 'Tunggu dalam proses menghilangkan background', id)
                          const result = await removeBackgroundFromImageBase64({
                              base64img,
                              apiKey: API,
                              size: 'auto',
                              type: 'auto',
                              outFile
                              })
                              await client.sendImageAsSticker(from, `data:${_mimetype};base64,${result.base64img}`)
                          } catch(err) {
                              console.log(err)
                      }                
                  } else if (args.length === 1) {
                      if (!isUrl(url)) { await client.reply(from, 'Maaf, link yang kamu kirim tidak valid. [Invalid Link]', id) }
                      client.sendStickerfromUrl(from, url).then((r) => (!r && r !== undefined)
                          ? client.sendText(from, 'Maaf, link yang kamu kirim tidak memuat gambar. [No Image]')
                          : client.reply(from, 'Here\'s your sticker')).then(() => console.log(`Sticker Processed for ${processTime(t, moment())} Second`))
                  } else {
                      await client.reply(from, 'Tidak ada gambar! Untuk membuka daftar perintah kirim !menu [Wrong Format]', id)
                  }
              } else {
                  if ((isMedia || isQuotedImage) && args.length === 0) {
                      if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                      const encryptMedia = isQuotedImage ? quotedMsg : message
                      const _mimetype = isQuotedImage ? quotedMsg.mimetype : mimetype
                      const mediaData = await decryptMedia(encryptMedia, uaOverride)
                      const imageBase64 = `data:${_mimetype};base64,${mediaData.toString('base64')}`
                      client.sendImageAsSticker(from, imageBase64).then(() => {
                          client.reply(from, 'Here\'s your sticker')
                          console.log(`Sticker Processed for ${processTime(t, moment())} Second`)
                      })
                  } else if ((isMedia || isQuotedImage) && args[0] === 'nobg') {
                      if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                      if (isGroupMsg) return client.reply(from, bot.error.onlyPm, id)
                      try {
                          const encryptMedia = isQuotedImage ? quotedMsg : message
                          const _mimetype = isQuotedImage ? quotedMsg.mimetype : mimetype
                          const mediaData = await decryptMedia(encryptMedia, uaOverride)
                          const imageBase64 = `data:${_mimetype};base64,${mediaData.toString('base64')}`
                          const base64img = imageBase64
                          const outFile = './out/img/noBg.png'
                          const API = process.env.NOBG_API
                          client.reply(from, 'Tunggu dalam proses menghilangkan background', id)
                          const result = await removeBackgroundFromImageBase64({
                              base64img,
                              apiKey: API,
                              size: 'auto',
                              type: 'auto',
                              outFile
                              })
                              await client.sendImageAsSticker(from, `data:${_mimetype};base64,${result.base64img}`)
                          } catch(err) {
                              console.log(err)
                      }                
                  } else if (args.length === 1) {
                      if (!isUrl(url)) { await client.reply(from, 'Maaf, link yang kamu kirim tidak valid. [Invalid Link]', id) }
                      client.sendStickerfromUrl(from, url).then((r) => (!r && r !== undefined)
                          ? client.sendText(from, 'Maaf, link yang kamu kirim tidak memuat gambar. [No Image]')
                          : client.reply(from, 'Here\'s your sticker')).then(() => console.log(`Sticker Processed for ${processTime(t, moment())} Second`))
                  } else {
                      await client.reply(from, 'Tidak ada gambar! Untuk membuka daftar perintah kirim !menu [Wrong Format]', id)
                  }
              }
            }
            break
        case 'stikergif':
        case 'stickergif':
        case 'gifstiker':
        case 'gifsticker':
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                  if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  const isGiphy = url.match(new RegExp(/https?:\/\/(www\.)?giphy.com/, 'gi'))
                  const isMediaGiphy = url.match(new RegExp(/https?:\/\/media.giphy.com\/media/, 'gi'))
                  if (isGiphy) {
                      const getGiphyCode = url.match(new RegExp(/(\/|\-)(?:.(?!(\/|\-)))+$/, 'gi'))
                      if (!getGiphyCode) { return client.reply(from, 'Gagal mengambil kode giphy', id) }
                      const giphyCode = getGiphyCode[0].replace(/[-\/]/gi, '')
                      const smallGifUrl = 'https://media.giphy.com/media/' + giphyCode + '/giphy-downsized.gif'
                      client.sendGiphyAsSticker(from, smallGifUrl).then(() => {
                          client.reply(from, 'Here\'s your sticker')
                          console.log(`Sticker Processed for ${processTime(t, moment())} Second`)
                      }).catch((err) => console.log(err))
                  } else if (isMediaGiphy) {
                      const gifUrl = url.match(new RegExp(/(giphy|source).(gif|mp4)/, 'gi'))
                      if (!gifUrl) { return client.reply(from, 'Gagal mengambil kode giphy', id) }
                      const smallGifUrl = url.replace(gifUrl[0], 'giphy-downsized.gif')
                      client.sendGiphyAsSticker(from, smallGifUrl).then(() => {
                          client.reply(from, 'Here\'s your sticker')
                          console.log(`Sticker Processed for ${processTime(t, moment())} Second`)
                      }).catch((err) => console.log(err))
                  } else {
                      await client.reply(from, 'maaf, untuk saat ini sticker gif hanya bisa menggunakan link dari giphy.  [Giphy Only]', id)
                  }
              } else{
                  if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  const isGiphy = url.match(new RegExp(/https?:\/\/(www\.)?giphy.com/, 'gi'))
                  const isMediaGiphy = url.match(new RegExp(/https?:\/\/media.giphy.com\/media/, 'gi'))
                  if (isGiphy) {
                      const getGiphyCode = url.match(new RegExp(/(\/|\-)(?:.(?!(\/|\-)))+$/, 'gi'))
                      if (!getGiphyCode) { return client.reply(from, 'Gagal mengambil kode giphy', id) }
                      const giphyCode = getGiphyCode[0].replace(/[-\/]/gi, '')
                      const smallGifUrl = 'https://media.giphy.com/media/' + giphyCode + '/giphy-downsized.gif'
                      client.sendGiphyAsSticker(from, smallGifUrl).then(() => {
                          client.reply(from, 'Here\'s your sticker')
                          console.log(`Sticker Processed for ${processTime(t, moment())} Second`)
                      }).catch((err) => console.log(err))
                  } else if (isMediaGiphy) {
                      const gifUrl = url.match(new RegExp(/(giphy|source).(gif|mp4)/, 'gi'))
                      if (!gifUrl) { return client.reply(from, 'Gagal mengambil kode giphy', id) }
                      const smallGifUrl = url.replace(gifUrl[0], 'giphy-downsized.gif')
                      client.sendGiphyAsSticker(from, smallGifUrl).then(() => {
                          client.reply(from, 'Here\'s your sticker')
                          console.log(`Sticker Processed for ${processTime(t, moment())} Second`)
                      }).catch((err) => console.log(err))
                  } else {
                      await client.reply(from, 'maaf, untuk saat ini sticker gif hanya bisa menggunakan link dari giphy.  [Giphy Only]', id)
                  }
              }
            }
            break
        // Video Downloader
        case 'tiktok':
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                  if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('tiktok.com')) return client.reply(from, 'Maaf, link yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, `_Scraping Metadata..._ \n\n${menuId.textDonasi()}`, id)
                  downloader.tiktok(url).then(async (videoMeta) => {
                      const filename = videoMeta.authorMeta.name + '.mp4'
                      const caps = `*Metadata:*\nUsername: ${videoMeta.authorMeta.name} \nMusic: ${videoMeta.musicMeta.musicName} \nView: ${videoMeta.playCount.toLocaleString()} \nLike: ${videoMeta.diggCount.toLocaleString()} \nComment: ${videoMeta.commentCount.toLocaleString()} \nShare: ${videoMeta.shareCount.toLocaleString()} \nCaption: ${videoMeta.text.trim() ? videoMeta.text : '-'}`
                      await client.sendFileFromUrl(from, videoMeta.url, filename, videoMeta.NoWaterMark ? caps : `⚠ Video tanpa watermark tidak tersedia. \n\n${caps}`, '', { headers: { 'User-Agent': 'okhttp/4.5.0', referer: 'https://www.tiktok.com/' } }, true)
                          .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                          .catch((err) => console.error(err))
                  }).catch(() => client.reply(from, 'Gagal mengambil metadata, link yang kamu kirim tidak valid. [Invalid Link]', id))
  
              } else {
                  if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('tiktok.com')) return client.reply(from, 'Maaf, link yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, `_Scraping Metadata..._ \n\n${menuId.textDonasi()}`, id)
                  downloader.tiktok(url).then(async (videoMeta) => {
                      const filename = videoMeta.authorMeta.name + '.mp4'
                      const caps = `*Metadata:*\nUsername: ${videoMeta.authorMeta.name} \nMusic: ${videoMeta.musicMeta.musicName} \nView: ${videoMeta.playCount.toLocaleString()} \nLike: ${videoMeta.diggCount.toLocaleString()} \nComment: ${videoMeta.commentCount.toLocaleString()} \nShare: ${videoMeta.shareCount.toLocaleString()} \nCaption: ${videoMeta.text.trim() ? videoMeta.text : '-'}`
                      await client.sendFileFromUrl(from, videoMeta.url, filename, videoMeta.NoWaterMark ? caps : `⚠ Video tanpa watermark tidak tersedia. \n\n${caps}`, '', { headers: { 'User-Agent': 'okhttp/4.5.0', referer: 'https://www.tiktok.com/' } }, true)
                          .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                          .catch((err) => console.error(err))
                  }).catch(() => client.reply(from, 'Gagal mengambil metadata, link yang kamu kirim tidak valid. [Invalid Link]', id))
              }
            }
            break
        case 'ig':
        case 'instagram':
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                  if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('instagram.com')) return client.reply(from, 'Maaf, link yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, bot.wait, id)
                  downloader.insta(url)
                    .then(async (data) => {
                      const uri = data.url.replace(/\?.*$/g, '')
                      if (data.media_type == 'photo') {
                          client.sendFileFromUrl(from, uri, 'photo.jpg', '', null, null, true)
                              .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                              .catch((err) => console.error(err))
                      } else if (data.media_type == 'video') {
                          client.sendFileFromUrl(from, uri, 'video.mp4', '', null, null, true)
                              .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                              .catch((err) => console.error(err))
                      } else {
                          console.log('Not Support slider post')
                          client.reply(from, 'Maaf masih belum support untul slider post')
                      }
                  })
                      .catch((err) => {
                          console.log(err)
                          client.reply(from, 'Error, user private atau link salah [Private or Invalid Link]', id)
                      })
              } else {
                  if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('instagram.com')) return client.reply(from, 'Maaf, link yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, bot.wait, id)
                  downloader.insta(url).then(async (data) => {
                      const uri = data.url.replace(/\?.*$/g, '')
                      if (data.media_type == 'photo') {
                          client.sendFileFromUrl(from, uri, 'photo.jpg', '', null, null, true)
                              .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                              .catch((err) => console.error(err))
                      } else if (data.media_type == 'video') {
                          client.sendFileFromUrl(from, uri, 'video.mp4', '', null, null, true)
                              .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                              .catch((err) => console.error(err))
                      }
                  })
                      .catch((err) => {
                          console.log(err)
                          client.reply(from, 'Error, user private atau link salah [Private or Invalid Link]', id)
                      })
              }
            }
            break
        case 'twt':
        case 'twitter':
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                  if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) & !url.includes('twitter.com') || url.includes('t.co')) return client.reply(from, 'Maaf, url yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, `_Scraping Metadata..._ \n\n${menuId.textDonasi()}`, id)
                  downloader.tweet(url).then(async (data) => {
                      if (data.type === 'video') {
                          const content = data.variants.filter(x => x.content_type !== 'application/x-mpegURL').sort((a, b) => b.bitrate - a.bitrate)
                          const result = await urlShortener(content[0].url)
                          console.log('Shortlink: ' + result)
                          await client.sendFileFromUrl(from, content[0].url, 'video.mp4', `Link Download: ${result} \n\nProcessed for ${processTime(t, moment())} _Second_`, null, null, true)
                              .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                              .catch((err) => console.error(err))
                      } else if (data.type === 'photo') {
                          for (let i = 0; i < data.variants.length; i++) {
                              await client.sendFileFromUrl(from, data.variants[i], data.variants[i].split('/media/')[1], '', null, null, true)
                                  .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                                  .catch((err) => console.error(err))
                          }
                      }
                  }).catch(() => client.sendText(from, 'Maaf, link tidak valid atau tidak ada media di link yang kamu kirim. [Invalid Link]'))
              } else {
                  if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) & !url.includes('twitter.com') || url.includes('t.co')) return client.reply(from, 'Maaf, url yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, `_Scraping Metadata..._ \n\n${menuId.textDonasi()}`, id)
                  downloader.tweet(url).then(async (data) => {
                      if (data.type === 'video') {
                          const content = data.variants.filter(x => x.content_type !== 'application/x-mpegURL').sort((a, b) => b.bitrate - a.bitrate)
                          const result = await urlShortener(content[0].url)
                          console.log('Shortlink: ' + result)
                          await client.sendFileFromUrl(from, content[0].url, 'video.mp4', `Link Download: ${result} \n\nProcessed for ${processTime(t, moment())} _Second_`, null, null, true)
                              .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                              .catch((err) => console.error(err))
                      } else if (data.type === 'photo') {
                          for (let i = 0; i < data.variants.length; i++) {
                              await client.sendFileFromUrl(from, data.variants[i], data.variants[i].split('/media/')[1], '', null, null, true)
                                  .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                                  .catch((err) => console.error(err))
                          }
                      }
                  }).catch(() => client.sendText(from, 'Maaf, link tidak valid atau tidak ada media di link yang kamu kirim. [Invalid Link]'))
              }
            }
            break
        case 'fb':
        case 'facebook':
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                  if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('facebook.com')) return client.reply(from, 'Maaf, url yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, bot.wait, id)
                  downloader.facebook(url).then(async (videoMeta) => {
                      const title = videoMeta.response.title
                      const thumbnail = videoMeta.response.thumbnail
                      const links = videoMeta.response.links
                      const shorts = []
                      for (let i = 0; i < links.length; i++) {
                          const shortener = await urlShortener(links[i].url)
                          console.log('Shortlink: ' + shortener)
                          links[i].short = shortener
                          shorts.push(links[i])
                      }
                      const link = shorts.map((x) => `${x.resolution} Quality: ${x.short}`)
                      const caption = `Text: ${title} \n\nLink Download: \n${link.join('\n')} \n\nProcessed for ${processTime(t, moment())} _Second_`
                      await client.sendFileFromUrl(from, thumbnail, 'videos.jpg', caption, null, null, true)
                          .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                          .catch((err) => console.error(err))
                  }).catch((err) => client.reply(from, `Error, url tidak valid atau tidak memuat video. [Invalid Link or No Video] \n\n${err}`, id))
              } else {
                  if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('facebook.com')) return client.reply(from, 'Maaf, url yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, bot.wait, id)
                  downloader.facebook(url).then(async (videoMeta) => {
                      const title = videoMeta.response.title
                      const thumbnail = videoMeta.response.thumbnail
                      const links = videoMeta.response.links
                      const shorts = []
                      for (let i = 0; i < links.length; i++) {
                          const shortener = await urlShortener(links[i].url)
                          console.log('Shortlink: ' + shortener)
                          links[i].short = shortener
                          shorts.push(links[i])
                      }
                      const link = shorts.map((x) => `${x.resolution} Quality: ${x.short}`)
                      const caption = `Text: ${title} \n\nLink Download: \n${link.join('\n')} \n\nProcessed for ${processTime(t, moment())} _Second_`
                      await client.sendFileFromUrl(from, thumbnail, 'videos.jpg', caption, null, null, true)
                          .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                          .catch((err) => console.error(err))
                  })
                      .catch((err) => client.reply(from, `Error, url tidak valid atau tidak memuat video. [Invalid Link or No Video] \n\n${err}`, id))
              }
            }
            break
        case 'ytmp3':
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                  if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('youtube.com')) return client.reply(from, 'Maaf, url yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, bot.wait, id)
                  downloader.ytmp3(url).then(async (ytMeta) => {
                      const title = ytMeta.title
                      const thumbnail = ytMeta.thumb
                      const links = ytMeta.result
                      const filesize = ytMeta.filesize
                      const status = ytMeta.status
                      if ( status !== 200) client.reply(from, 'Maaf, link anda tidak valid.', id)
                      if (Number(filesize.split(' MB')[0]) >= 10.00) return reject('Maaf durasi video sudah melebihi batas maksimal !')
                      client.sendFileFromUrl(from, thumbnail, 'thumbnail.jpg', `Judul: ${title}\nUkuran File: ${filesize}\n\nSilakan di tunggu lagi proses boss....`, null, true)
                      await client.sendFileFromUrl(from, links, `${title}.mp3`, null, null, true)
                      .catch(() => client.reply(from, 'Terjadi kesalahan mungkin link yang anda kirim tidak valid!', id))
  
                  })
              } else {
                  if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('youtube.com')) return client.reply(from, 'Maaf, url yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, bot.wait, id)
                  downloader.ytmp3(url).then(async (ytMeta) => {
                      const title = ytMeta.title
                      const thumbnail = ytMeta.thumb
                      const links = ytMeta.result
                      const filesize = ytMeta.filesize
                      const status = ytMeta.status
                      if ( status !== 200) client.reply(from, 'Maaf, link anda tidak valid.', id)
                      if (Number(filesize.split(' MB')[0]) >= 10.00) return reject('Maaf durasi video sudah melebihi batas maksimal !')
                      client.sendFileFromUrl(from, thumbnail, 'thumbnail.jpg', `Judul: ${title}\nUkuran File: ${filesize}\n\nSilakan di tunggu lagi proses boss....`, null, true)
                      await client.sendFileFromUrl(from, links, `${title}.mp3`, null, null, true)
                      .catch(() => client.reply(from, 'Terjadi kesalahan mungkin link yang anda kirim tidak valid!', id))
  
                  })
              }
            }
            break
        case 'ytmp4' :
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                  if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('youtube.com')) return client.reply(from, 'Maaf, url yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, bot.wait, id)
                  downloader.ytmp4(url).then(async (ytMetav) => {
                      const title = ytMetav.title
                      const thumbnail = ytMetav.thumb
                      const links = ytMetav.result
                      const filesize = ytMetav.filesize
                      const res = ytMetav.resolution
                      const status = ytMetav.status
                      if ( status !== 200) client.reply(from, 'Maaf, link anda tidak valid.', id)
                      if (Number(filesize.split(' MB')[0]) >= 25.00) return reject('Maaf durasi video sudah melebihi batas maksimal !')
                      client.sendFileFromUrl(from, thumbnail, 'thumbnail.jpg', `Judul: ${title}\nUkuran File: ${filesize}\nResolusi: ${res}\n\nSilakan di tunggu lagi proses boss....`, null, true)
                      await client.sendFileFromUrl(from, links, `${title}.mp4`, null, null, true)
                      .catch(() => client.reply(from, 'Terjadi kesalahan mungkin link yang anda kirim tidak valid!', id))
                  })
              } else {
                  if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                  if (args.length !== 1) return client.reply(from, bot.error.format, id)
                  if (!isUrl(url) && !url.includes('youtube.com')) return client.reply(from, 'Maaf, url yang kamu kirim tidak valid. [Invalid Link]', id)
                  await client.reply(from, bot.wait, id)
                  downloader.ytmp4(url).then(async (ytMetav) => {
                      const title = ytMetav.title
                      const thumbnail = ytMetav.thumb
                      const links = ytMetav.result
                      const filesize = ytMetav.filesize
                      const res = ytMetav.resolution
                      const status = ytMetav.status
                      if ( status !== 200) client.reply(from, 'Maaf, link anda tidak valid.', id)
                      if (Number(filesize.split(' MB')[0]) >= 25.00) return reject('Maaf durasi video sudah melebihi batas maksimal !')
                      client.sendFileFromUrl(from, thumbnail, 'thumbnail.jpg', `Judul: ${title}\nUkuran File: ${filesize}\nResolusi: ${res}\n\nSilakan di tunggu lagi proses boss....`, null, true)
                      await client.sendFileFromUrl(from, links, `${title}.mp4`, null, null, true)
                      .catch(() => client.reply(from, 'Terjadi kesalahan mungkin link yang anda kirim tidak valid!', id))
                  })
              }
            }
          break
        // Education Command
        case 'brainly':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if (args.length === 0) return client.reply(from, 'Harap masukan pertanyaan yang di cari!', id)
            await client.reply(from, bot.wait, id)
            edukasi.brainly(string)
                .then((result) => client.reply(from, result, id))
                .catch(() => client.reply(from, 'Error, Pertanyaan mu tidak ada di database kami.', id))
            break
        case 'wiki':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if (args.length === 0) return client.reply(from, 'Harap masukan pertanyaan yang di cari!', id)
            await client.reply(from, bot.wait, id)
            edukasi.wiki(string)
                .then((result) => client.reply(from, result, id))
                .catch(() => client.reply(from, 'Error, Pertanyaan mu tidak ada di database kami.', id))
            break
        case 'tulis':
            if (isBlackList) {
              client.reply(from, bot.error.blackList, id)
            } else {
              if (isGroupMsg) {
                if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                if (args.length === 0) return client.reply(from, 'Kirim perintah *!tulis [teks]*', id)
                client.reply(from, bot.wait, id)
                nulis(string).then(async (hasil) => {
                  if (hasil.status != 200) return client.reply(from, 'Maaf mungkin format anda salah/atau tulisan anda tidak support', id)
                  const hasilGambar = hasil.result
                  client.sendImage(from, hasilGambar, 'hasil.jpg', 'Ini hasilnya awas ketahuan gurunya', null, true)
                      .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                      .catch((err) => console.error(err))
                })
              } else {
                if (!isPmWhitelist) return client.reply(from, bot.error.onlyPremi, id)
                if (args.length === 0) return client.reply(from, 'Kirim perintah *!tulis [teks]*', id)
                client.reply(from, bot.wait, id)
                nulis(string).then(async (hasil) => {
                  if (hasil.status != 200) return client.reply(from, 'Maaf mungkin format anda salah/atau tulisan anda tidak support', id)
                  const hasilGambar = hasil.result
                  client.sendImage(from, hasilGambar, 'hasil.jpg', 'Ini hasilnya awas ketahuan gurunya', null, true)
                      .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                      .catch((err) => console.error(err))
                })
              }
            }
            break
        // Other Command
        case 'meme':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if ((isMedia || isQuotedImage) && args.length >= 2) {
                const top = arg.split('|')[0]
                const bottom = arg.split('|')[1]
                const encryptMedia = isQuotedImage ? quotedMsg : message
                const mediaData = await decryptMedia(encryptMedia, uaOverride)
                const getUrl = await uploadImages(mediaData, false)
                const ImageBase64 = await meme.custom(getUrl, top, bottom)
                client.sendFile(from, ImageBase64, 'image.png', '', null, true)
                    .then((serialized) => console.log(`Sukses Mengirim File dengan id: ${serialized} diproses selama ${processTime(t, moment())}`))
                    .catch((err) => console.error(err))
            } else {
                await client.reply(from, 'Tidak ada gambar! Untuk membuka cara penggnaan kirim !menu [Wrong Format]', id)
            }
            break
        case 'resi':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if (args.length !== 2) return client.reply(from, bot.error.format, id)
            const kurirs = ['jne', 'pos', 'tiki', 'wahana', 'jnt', 'rpx', 'sap', 'sicepat', 'pcp', 'jet', 'dse', 'first', 'ninja', 'lion', 'idl', 'rex']
            if (!kurirs.includes(args[0])) return client.sendText(from, `Maaf, jenis ekspedisi pengiriman tidak didukung layanan ini hanya mendukung ekspedisi pengiriman ${kurirs.join(', ')} Tolong periksa kembali.`)
            console.log('Memeriksa No Resi', args[1], 'dengan ekspedisi', args[0])
            cekResi(args[0], args[1]).then((result) => client.sendText(from, result))
            break
        case 'translate':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if (args.length != 1) return client.reply(from, bot.error.format, id)
            if (!quotedMsg) return client.reply(from, bot.error.format, id)
            const quoteText = quotedMsg.type == 'chat' ? quotedMsg.body : quotedMsg.type == 'image' ? quotedMsg.caption : ''
            translate(quoteText, args[0])
                .then((result) => client.sendText(from, result))
                .catch(() => client.sendText(from, 'Error, Kode bahasa salah.'))
            break
        case 'ceklokasi':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if (quotedMsg.type !== 'location') return client.reply(from, bot.error.format, id)
            console.log(`Request Status Zona Penyebaran Covid-19 (${quotedMsg.lat}, ${quotedMsg.lng}).`)
            const zoneStatus = await getLocationData(quotedMsg.lat, quotedMsg.lng)
            if (zoneStatus.kode !== 200) client.sendText(from, 'Maaf, Terjadi error ketika memeriksa lokasi yang anda kirim.')
            let data = ''
            for (let i = 0; i < zoneStatus.data.length; i++) {
                const { zone, region } = zoneStatus.data[i]
                const _zone = zone == 'green' ? 'Hijau* (Aman) \n' : zone == 'yellow' ? 'Kuning* (Waspada) \n' : 'Merah* (Bahaya) \n'
                data += `${i + 1}. Kel. *${region}* Berstatus *Zona ${_zone}`
            }
            const text = `*CEK LOKASI PENYEBARAN COVID-19*\nHasil pemeriksaan dari lokasi yang anda kirim adalah *${zoneStatus.status}* ${zoneStatus.optional}\n\nInformasi lokasi terdampak disekitar anda:\n${data}`
            client.sendText(from, text)
            break
        case 'igstalk':
            if (isBlackList) return client.reply(from, bot.error.blackList, id)
            if (args.length !== 1) return client.reply(from, bot.error.format, id)
            await client.reply(from, bot.wait, id)
            igstalk(args[0]).then(async (igMeta) => {
              if ( igMeta.status !== 200) return client.reply(from, 'Maaf, username yang anda kirim tidak valid.', id)
              const foto = igMeta.Profile_pic
              const nama = igMeta.Name
              const username = igMeta.Username
              const bio = igMeta.Biodata
              const follower = igMeta.Jumlah_Followers
              const following = igMeta.Jumlah_Following
              const post = igMeta.Jumlah_Post
              await client.sendFileFromUrl(from, foto, 'thumbnail.jpg', `Nama: ${nama}\nUsername: ${username}\nBio: ${bio}\nJumlah folower: ${follower}\nJumlah following: ${following}\nJumlah post: ${post}`, null, true)
              .catch(() => client.reply(from, 'Terjadi kesalahan mungkin username yang anda kirim tidak valid!', id))
            })
            break
        // Group Commands (group admin only)
        case 'kick':
            if (isBotGroup) {
                if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
                if (!isBotGroupAdmins) return client.reply(from, bot.error.botNotAdmin, id)
                if (mentionedJidList.length === 0) return client.reply(from, bot.error.format, id)
                if (mentionedJidList[0] === botNumber) return await client.reply(from, bot.error.format, id)
                await client.sendTextWithMentions(from, `Request diterima, mengeluarkan:\n${mentionedJidList.map(x => `@${x.replace('@c.us', '')}`).join('\n')}`)
                for (let i = 0; i < mentionedJidList.length; i++) {
                    if (groupAdmins.includes(mentionedJidList[i])) return await client.sendText(from, 'Gagal, kamu tidak bisa mengeluarkan admin grup.')
                    await client.sendImageAsSticker(from, process.env.KICK_STICKER)
                    await client.removeParticipant(groupId, mentionedJidList[i])
                }
            } else {
                if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
                if (!isBotGroupAdmins) return client.reply(from, bot.error.botNotAdmin, id)
                if (mentionedJidList.length === 0) return client.reply(from, bot.error.format, id)
                if (mentionedJidList[0] === botNumber) return await client.reply(from, bot.error.format, id)
                await client.sendTextWithMentions(from, `Request diterima, mengeluarkan:\n${mentionedJidList.map(x => `@${x.replace('@c.us', '')}`).join('\n')}`)
                for (let i = 0; i < mentionedJidList.length; i++) {
                    if (groupAdmins.includes(mentionedJidList[i])) return await client.sendText(from, 'Gagal, kamu tidak bisa mengeluarkan admin grup.')
                    await client.sendImageAsSticker(from, process.env.KICK_STICKER)
                    await client.removeParticipant(groupId, mentionedJidList[i])
                }
            }
            break
        case 'promote':
            if (isBotGroup) {
                if (!isGroupMsg) return await client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return await client.reply(from, bot.error.notAdmin, id)
                if (!isBotGroupAdmins) return await client.reply(from, bot.error.botNotAdmin, id)
                if (mentionedJidList.length != 1) return client.reply(from, 'Maaf, format pesan salah silahkan periksa menu. [Wrong Format, Only 1 user]', id)
                if (groupAdmins.includes(mentionedJidList[0])) return await client.reply(from, 'Maaf, user tersebut sudah menjadi admin. [Bot is Admin]', id)
                if (mentionedJidList[0] === botNumber) return await client.reply(from, bot.error.format, id)
                await client.promoteParticipant(groupId, mentionedJidList[0])
                await client.sendTextWithMentions(from, `Request diterima, menambahkan @${mentionedJidList[0].replace('@c.us', '')} sebagai admin.`)
            } else {
                if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                if (!isGroupMsg) return await client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return await client.reply(from, bot.error.notAdmin, id)
                if (!isBotGroupAdmins) return await client.reply(from, bot.error.botNotAdmin, id)
                if (mentionedJidList.length != 1) return client.reply(from, 'Maaf, format pesan salah silahkan periksa menu. [Wrong Format, Only 1 user]', id)
                if (groupAdmins.includes(mentionedJidList[0])) return await client.reply(from, 'Maaf, user tersebut sudah menjadi admin. [Bot is Admin]', id)
                if (mentionedJidList[0] === botNumber) return await client.reply(from, bot.error.format, id)
                await client.promoteParticipant(groupId, mentionedJidList[0])
                await client.sendTextWithMentions(from, `Request diterima, menambahkan @${mentionedJidList[0].replace('@c.us', '')} sebagai admin.`)
            }
            break
        case 'demote':
            if (isBotGroup) {
                if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
                if (!isBotGroupAdmins) return client.reply(from, bot.error.botNotAdmin, id)
                if (mentionedJidList.length !== 1) return client.reply(from, 'Maaf, format pesan salah silahkan periksa menu. [Wrong Format, Only 1 user]', id)
                if (!groupAdmins.includes(mentionedJidList[0])) return await client.reply(from, 'Maaf, user tersebut tidak menjadi admin. [user not Admin]', id)
                if (mentionedJidList[0] === botNumber) return await client.reply(from, bot.error.format, id)
                await client.demoteParticipant(groupId, mentionedJidList[0])
                await client.sendTextWithMentions(from, `Request diterima, menghapus jabatan @${mentionedJidList[0].replace('@c.us', '')}.`)
            } else {
                if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
                if (!isBotGroupAdmins) return client.reply(from, bot.error.botNotAdmin, id)
                if (mentionedJidList.length !== 1) return client.reply(from, 'Maaf, format pesan salah silahkan periksa menu. [Wrong Format, Only 1 user]', id)
                if (!groupAdmins.includes(mentionedJidList[0])) return await client.reply(from, 'Maaf, user tersebut tidak menjadi admin. [user not Admin]', id)
                if (mentionedJidList[0] === botNumber) return await client.reply(from, bot.error.format, id)
                await client.demoteParticipant(groupId, mentionedJidList[0])
                await client.sendTextWithMentions(from, `Request diterima, menghapus jabatan @${mentionedJidList[0].replace('@c.us', '')}.`)
            }
            break
        case 'bye':
            if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
            if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
            client.sendText(from, 'Good bye... ( ⇀‸↼‶ )').then(() => client.leaveGroup(groupId))
            break
        case 'del':
            if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
            if (!quotedMsg) return client.reply(from, bot.error.format, id)
            if (!quotedMsgObj.fromMe) return client.reply(from, bot.error.format, id)
            client.deleteMessage(quotedMsgObj.chatId, quotedMsgObj.id, false)
            break
        case 'tagall':
        case 'everyone':
            if (isBotGroup) {
                if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
                const members = await client.getGroupMembers(groupId)
                let textMention = 'Mention All\n'
                for (let i = 0; i < members.length; i++) {
                    textMention += ` @${members[i].id.replace(/@c.us/g, '')}\n`
                }
                await sleep(2000)
                await client.sendTextWithMentions(from, textMention)
            } else {
                if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
                const members = await client.getGroupMembers(groupId)
                let textMention = 'Mention All\n'
                for (let i = 0; i < members.length; i++) {
                    textMention += ` @${members[i].id.replace(/@c.us/g, '')}\n`
                }
                await sleep(2000)
                await client.sendTextWithMentions(from, textMention)
            }
            break
        case 'add':
            if (isBotGroup) {
                if (!isGroupMsg) return await client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return await client.reply(from, bot.error.notAdmin, id)
                if (!isBotGroupAdmins) return await client.reply(from, bot.error.botNotAdmin, id)
                if (args.length !== 1) return client.reply(from, 'Untuk menggunakan fitur ini, kirim perintah *!add* 628xxxxx', id)
                const orang = args[0]
                await client.addParticipant(from, `${orang}@c.us`)
                            .catch(() => client.reply(from, 'Tidak dapat menambahkan, mungkin nomer salah', id))
            } else {
                if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
                if (!isGroupMsg) return await client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
                if (!isGroupAdmins) return await client.reply(from, bot.error.notAdmin, id)
                if (!isBotGroupAdmins) return await client.reply(from, bot.error.botNotAdmin, id)
                if (args.length !== 1) return client.reply(from, 'Untuk menggunakan fitur ini, kirim perintah *!add* 628xxxxx', id)
                const orang = args[0]
                await client.addParticipant(from, `${orang}@c.us`)
                            .catch(() => client.reply(from, 'Tidak dapat menambahkan, mungkin nomer salah', id))
            }
            break
        case 'gid':
            if (!isGroupMsg) return await client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
            if (!isGroupAdmins) return await client.reply(from, bot.error.notAdmin, id)
            if (args.length == 1) return client.reply(from, 'Untuk menggunakan fitur ini, kirim perintah *!gid* saja', id)
            client.sendText(from, `ID group ini adalah = ${groupId}`)
            break
        case 'uid':
            if (args.length == 1) return client.reply(from, 'Untuk menggunakan fitur ini, kirim perintah *!uid* saja', id)
            const uId = sender.id
            client.sendText(from, `ID kamu ini adalah = ${uId}`)
            break
        case 'gban':
            if (isBotGroup) {
              if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
              if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
              if (!isBotGroupAdmins) return client.reply(from, bot.error.botNotAdmin, id)
              if (args.length !== 1) return client.reply(from, 'Untuk menggunakan fitur ini, kirim perintah *!add* 628xxxxx', id)
              const id = args[0]
              const orang = `${id}@c.us`
              if (groupAdmins.includes(orang)) return await client.sendText(from, 'Gagal, kamu tidak bisa mengeluarkan admin grup.')
              database.connect()
              database.query(`INSERT INTO blacklist (id) VALUES ('${orang}')`)
                .then((res) => {
                  client.removeParticipant(groupId, orang)
                  client.sendTextWithMentions(from, `@${id} telah di *gban*`)
                  console.log(res)
                }).catch((err) => {
                  console.log(err)
                  client.sendText(from, 'Telah terjadi error coba liat log')
              })
              database.end()
            } else {
              if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
              if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
              if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
              if (!isBotGroupAdmins) return client.reply(from, bot.error.botNotAdmin, id)
              client.reply(from, bot.error.gbanGroup, id)
            }
            break
        case 'ugban':
            if (isBotGroup) {
              if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
              if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
              if (!isBotGroupAdmins) return client.reply(from, bot.error.botNotAdmin, id)
              const id = args[0]
              const orang = `${id}@c.us`
              database.connect()
              database.query(`DELETE FROM blacklist WHERE id = '${orang}'`)
                .then((res) => {
                  client.sendTextWithMentions(from, `Berhasil mencabut *gban* @${id}`)
                  console.log(res)
                }).catch((err) => {
                  client.sendText(from, 'Telah terjadi error coba liat log')
                  console.log(err)
              })
              database.end()
            } else {
              if (!isgPremiList) return client.reply(from, bot.error.onlyPremi, id)
              if (!isGroupMsg) return client.reply(from, 'Maaf, perintah ini hanya dapat dipakai didalam grup! [Group Only]', id)
              if (!isGroupAdmins) return client.reply(from, bot.error.notAdmin, id)
              if (!isBotGroupAdmins) return client.reply(from, bot.error.botNotAdmin, id)
              client.reply(from, bot.error.ungbanGroup, id)
            }
        break
        //Owner cmd
        case 'botstat':
            if (!isOwner) return client.reply(from, bot.error.onlyOwner, id)
            const loadedMsg = await client.getAmountOfLoadedMessages()
            const chatIds = await client.getAllChatIds()
            const groups = await client.getAllGroups()
            client.sendText(from, `Status :\n- *${loadedMsg}* Loaded Messages\n- *${groups.length}* Group Chats\n- *${chatIds.length - groups.length}* Personal Chats\n- *${chatIds.length}* Total Chats`)
            break
        case 'clearall':
            if (!isOwner) return client.reply(from, bot.error.onlyOwner, id)
            const chatAll = await client.getAllChats()
            for (let removeChat of chatAll) {
                await client.deleteChat(removeChat.id)
            }
            client.sendText(from, 'Berhasil menghapus semua chat')
            break
        case 'siaran':
        case 'cast':
            if (!isOwner) return client.reply(from, bot.error.onlyOwner, id)
            const all = await client.getAllChats()
            const castText = string
            for (let cast of all) {
                await client.sendText(cast.id, castText)
            }
            client.sendText(from, 'Berhasil membuat siaran ke semua akun')
            break
        case 'leaveall':
            if (!isOwner) return client.reply(from, bot.error.onlyOwner, id)
            const allChats = await client.getAllChatIds()
            const allGroups = await client.getAllGroups()
            for (let gclist of allGroups) {
                await client.sendText(gclist.contact.id, `Maaf bot sedang pembersihan, total chat aktif : ${allChats.length}\nUntuk info silakan ke group support kami https://chat.whatsapp.com/DAWsRFyVOyyEGZRZfLdzVP`)
                await client.leaveGroup(gclist.contact.id)
            }
            client.sendText(from, 'Berhasil keluar semua group')
            break
        case 'premiumlink':
            client.sendTextWithMentions(from, menuId.textLinkPremium())
            break
        default:
            console.log(color('[ERROR]', 'red'), color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), 'yellow'), 'Unregistered Command from', color(pushname))
            break
        }
    } catch (err) {
        console.log(color('[ERROR]', 'red'), err)
    }
}
