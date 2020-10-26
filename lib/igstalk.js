const { fetchJson } = require('../utils/fetcher')

module.exports = (usr) => new Promise((resolve, reject) => {
    console.log('Get metadata from =>', usr)
    fetchJson('https://api.kry9ton.tech/v1/stalk?username=' + usr)
        .then((result) => {
            if (result.status != 200) return resolve(result.status)
            resolve(result)
            }).catch((err) => {
                console.error(err)
                reject(err)
            })
})