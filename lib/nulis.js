const { fetchJson } = require('../utils/fetcher')

module.exports = (nulis) => new Promise((resolve, reject) => {
    console.log('Get metadata from =>', nulis)
    fetchJson('https://mhankbarbar.herokuapp.com/nulis?text=' + nulis)
        .then((result) => {
            if (result.status != 200) return resolve(result.status)
            resolve(result)
            }).catch((err) => {
                console.error(err)
                reject(err)
            })
})