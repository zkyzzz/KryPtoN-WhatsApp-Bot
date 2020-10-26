const { fetchJson } = require('../utils/fetcher')

module.exports = (nulis) => new Promise((resolve, reject) => {
    console.log('Get metadata from =>', nulis)
    const tulis = nulis.replace(/ /g, "%20");
    fetchJson('https://api.kry9ton.tech/v1/nulis?text=' + tulis)
        .then((result) => {
            if (result.status != 200) return resolve(result.status)
            resolve(result)
            }).catch((err) => {
                console.error(err)
                reject(err)
            })
})