'use strict'

var XLSX = require('xlsx')
var Firebase = require('firebase')
var fetch = require('node-fetch')

var HEADER_ROW_INDEX = 2
var COLUMNS = [
    {
        address: 'E',
        header: 'Mark (Registration)',
        key: true,
        normalize: function(value) {
            if (value) {
                value = value.replace(/-/g, '')
            }
            return value
        }
    },
    {
        address: 'I',
        header: 'ICAO (Typecertificated Model)',
        firebaseKey: 'type'
    },
    {
        address: 'N',
        header: 'Mtom (Typecertificated Model)',
        firebaseKey: 'mtow'
    }
]

var firebaseUrl = requireEnvVariable('FIREBASE_URL')
var authUrl = requireEnvVariable('AUTH_URL')
var credentials = {
    username: requireEnvVariable('USERNAME'),
    password: requireEnvVariable('PASSWORD')
}

importAircrafts()

function importAircrafts() {
    var sheet = loadSheet()
    checkColumns(sheet)

    var data = getData(sheet)

    var importPromise = importData(data)

    // Firebase keeps process alive - exit manually, once import is done
    importPromise.then(function() {
        console.log('Import done')
        process.exit()
    }).catch(function(e) {
        console.log('Import failed')
        console.log(e)
        process.exit(1)
    })
}

function loadSheet() {
    var workbook = XLSX.readFile('testdata/aircrafts.xls')
    var worksheet = workbook.Sheets[workbook.SheetNames[0]]
    return XLSX.utils.sheet_to_json(worksheet, {header: 'A'})
}

function checkColumns(sheet) {
    var headerRow = sheet[HEADER_ROW_INDEX]
    for (var i = 0; i < COLUMNS.length; i++) {
        var column = COLUMNS[i]
        var cellValue = headerRow[column.address]
        if (cellValue !== column.header) {
            throw new Error('Expected to find column header "' + column.header + '", but found "' + cellValue + '"')
        }
    }
}

function getData(sheet) {
    var data = {}

    for (var r = HEADER_ROW_INDEX + 1; r < sheet.length; r++) {
        var row = sheet[r]

        var rowKey
        var rowData = {}

        for (var c = 0; c < COLUMNS.length; c++) {
            var column = COLUMNS[c]

            var value = row[column.address]

            if (column.normalize) {
                value = column.normalize(value)
            }

            if (column.key === true) {
                rowKey = value
            } else {
                rowData[column.firebaseKey] = value
            }
        }

        if (rowKey) {
            data[rowKey] = rowData
        }
    }

    return data
}

function importData(data) {
    return new Promise(function(resolve, reject) {
        getFirebaseRef().then(function(ref) {
            var promises = []

            updateExisting(ref, data, promises).then(function(existing) {
                addNew(ref, data, existing, promises)

                Promise.all(promises).then(function() {
                    resolve()
                })
            })
        }).catch(function(e) {
            reject(e)
        })
    })
}

function getFirebaseRef() {
    return new Promise(function(resolve, reject) {
        var ref = new Firebase(firebaseUrl + '/aircrafts')

        loadToken(authUrl, credentials).then(function(token) {
            ref.authWithCustomToken(token, function(error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(ref)
                }
            })
        }).catch(function(e) {
            reject(e)
        })
    })
}

function updateExisting(firebaseRef, data, promises) {
    return new Promise(function(resolve) {
        firebaseRef.once('value', function(snapshot) {
            var existing = {}

            snapshot.forEach(function(firebaseRow) {
                var key = firebaseRow.key()

                var item = data[key]

                var childRef = firebaseRef.child(key)

                if (!item) {
                    promises.push(new Promise(function(resolve, reject) {
                        childRef.remove(getFirebaseCallback(resolve, reject))
                    }))
                } else {
                    promises.push(new Promise(function(resolve, reject) {
                        childRef.set(item, getFirebaseCallback(resolve, reject))
                    }))
                }

                existing[key] = true
            })

            resolve(existing)
        })
    })
}

function addNew(firebaseRef, data, existing, promises) {
    for (var key in data) {
        if (existing[key] !== true && data.hasOwnProperty(key)) {
            var item = data[key]
            promises.push(new Promise(function(resolve, reject) {
                firebaseRef.child(key).set(item, getFirebaseCallback(resolve, reject))
            }))
        }
    }
}

function loadToken(url, credentials) {
    return new Promise(function(resolve, reject) {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: credentials ? JSON.stringify(credentials) : null
        }).then(function(response) {
            response.json().then(function(json) {
                resolve(json.token)
            })
        }).catch(function(e) {
            reject(e)
        })
    })
}

function getFirebaseCallback(resolve, reject) {
    return function(error) {
        if (error) {
            reject(error)
        } else {
            resolve()
        }
    }
}

function requireEnvVariable(name) {
    var value = process.env[name]
    if (!value) {
        throw new Error('Required environment variable "' + name + '" is not defined')
    }
    return value
}
