const cheerio = require('cheerio');
var phantom = require('phantom');
const rp = require('request-promise');

const arrCloningFields = [
    'away_votes', 'home_votes', 'over_votes', 'under_votes', 'total', 'under_price', 'over_price',
    'home_money_line', 'away_money_line', 'home_spread', 'away_spread', 'home_spread_price', 'away_spread_price'
]

class MyDate {
    constructor(strDate) {
        this.CALENDAR = [31, 28, 31, 30, 31, 31, 31, 31, 30, 31, 30, 31];
        this.year = parseInt(strDate.split('-')[0]);
        this.month = parseInt(strDate.split('-')[1]);
        this.day = parseInt(strDate.split('-')[2]);
    }
    increaseOneDay() {
        var nCurrentDate = this.day;
        if ( nCurrentDate >= this.getCurrentDayLimit() ){
            this.initializeDay();
            if (this.month === 12) {
                this.initializeMonth();
                this.increaseYear();
            } else {
                this.increaseMonth();
            }
        } else {
            this.increaseDay();
        }
    }
    getCurrentDayLimit() {
        var nLimit = this.CALENDAR[this.month - 1];
        if (this.month === 2 && this.year % 4 === 0 ) nLimit = 29;
        return nLimit;
    }
    initializeDay() { this.day = 1; }
    initializeMonth() { this.month = 1; }
    increaseDay() { this.day++; }
    increaseMonth() { this.month++; }
    increaseYear() { this.year++; }
    isEqual(comparing){
        if (this.year === comparing.year && this.month == comparing.month && this.day == comparing.day) return true;
        return false;
    }
    toString() {
        const strMonth = this.month < 10 ? '0' + this.month : this.month + '';
        const strDay = this.day < 10 ? '0' + this.day : this.day + '';
        return this.year + '-' + strMonth + '-' + strDay;
    }
}

var getMatchesFromDateRange = async function(strStartDate, strEndDate, unit, sockets) {
    let arrDates = getEachDatesFromDateRange(strStartDate, strEndDate);
    for (let i = 0; i < arrDates.length; i++){
        if ( i % unit === unit - 1) {
            await getMatchInfoWithPhantom(arrDates[i], sockets).then(objMatchInfo => {
                getBettingInfoFromDateWithoutPhantom(arrDates[i], objMatchInfo).then(result => {
                    sockets.emit('/retrived-matches-by-date', result);
                })
            }).catch(err => {
                console.log(err);
            })
        } else {
            getMatchInfoWithPhantom(arrDates[i], sockets).then(objMatchInfo => {
                getBettingInfoFromDateWithoutPhantom(arrDates[i], objMatchInfo).then(result => {
                    sockets.emit('/retrived-matches-by-date', result);
                })
            }).catch(err => {
                console.log(err);
            })
        }
    }
}

var getEachDatesFromDateRange = function(strStartDate, strEndDate) {
    var arrResult = [];
    const objEndDate = new MyDate(strEndDate);
    var objCurrentDate = new MyDate(strStartDate);
    while (!objCurrentDate.isEqual(objEndDate)) {
        let strDate = objCurrentDate.toString();
        arrResult.push(strDate);
        objCurrentDate.increaseOneDay();
    }
    arrResult.push(objEndDate.toString());
    return arrResult;
}

var getMatchInfoWithPhantom = async function(strDate, sockets) {
    const instance = await phantom.create();
    const page = await instance.createPage();

    await page.on('onResourceRequested', function(requestData) {
        // console.info('Requesting', requestData.url);
    });

    const status = await page.open(`http://www.espn.com/mens-college-basketball/scoreboard/_/date/${strDate.split('-').join('')}`);
    const content = await page.property('content');
    const $ = cheerio.load(content)
    let currentMatchInfo = { date: strDate, matches: [] };
    $('div#events').find('article.scoreboard').each(function (index, element) {
        let eachGameInfo = {};
        eachGameInfo.id = $(element).attr('id');
        eachGameInfo.href = $(element).find('a.mobileScoreboardLink').attr('href');
        eachGameInfo.homeTeam = $(element).find('table tr.home span.sb-team-short').text();
        eachGameInfo.homeTeam_abbrev = $(element).find('table tr.home span.sb-team-abbrev').text();
        eachGameInfo.homeTeam_enblem = $(element).find('table tr.home div.img-container img').attr('src');
        eachGameInfo.homeTeam_finalscore = $(element).find('table tr.home td.total span').text();
        eachGameInfo.homeTeam_scores = [];
        $(element).find('table tr.home td.score').each((index, element) => {
            eachGameInfo.homeTeam_scores.push($(element).text())
        });

        eachGameInfo.awayTeam = $(element).find('table tr.away span.sb-team-short').text();
        eachGameInfo.awayTeam_abbrev = $(element).find('table tr.away span.sb-team-abbrev').text();
        eachGameInfo.awayTeam_enblem = $(element).find('table tr.away div.img-container img').attr('src');
        eachGameInfo.awayTeam_finalscore = $(element).find('table tr.away td.total span').text();
        eachGameInfo.awayTeam_scores = [];
        $(element).find('table tr.away td.score').each((index, element) => {
            eachGameInfo.awayTeam_scores.push($(element).text())
        });
        eachGameInfo.bettingInfo = {
            oddshark: {},
            donbest: {
                spread: {
                    opener: { away: '', home: '', away_price: '', home_price: '' },
                    westgate: { away: '', home: '', away_price: '', home_price: '' },
                    mirage: { away: '', home: '', away_price: '', home_price: '' },
                    station: { away: '', home: '', away_price: '', home_price: '' },
                    pinnacle: { away: '', home: '', away_price: '', home_price: '' },
                    sia: { away: '', home: '', away_price: '', home_price: '' }
                },
                total: {
                    opener: ['', '', ''], westgate: ['', '', ''], mirage: ['', '', ''],
                    station: ['', '', ''], pinnacle: ['', '', ''], sia: ['', '', '']
                }
            }
        };
        for ( let j = 0; j < arrCloningFields.length; j++) {
            eachGameInfo.bettingInfo.oddshark[arrCloningFields[j]] = 0;
        }
        currentMatchInfo.matches.push(eachGameInfo);
    });
    await instance.exit();

    return new Promise((resolve, reject) => {
        resolve(currentMatchInfo);
    });
}

var getBoxscoreFromIDs = async function(arrIDs, sockets) {
    for (var i = 0; i < arrIDs.length; i++){
        if ( i % 10 === 9) {
            await getBoxScoreWithoutPhantom(arrIDs[i]).then(objBoxScoreInfo => {
                sockets.emit('/retrived-boxscore-with-id', objBoxScoreInfo);
            }).catch(err => {
                console.log(err);
            })
        } else {
            getBoxScoreWithoutPhantom(arrIDs[i]).then(objBoxScoreInfo => {
                sockets.emit('/retrived-boxscore-with-id', objBoxScoreInfo);
            }).catch(err => {
                console.log(err);
            })
        }
    }
}

var getBoxScoreWithoutPhantom = async function(matchId) {
    const URL = `http://www.espn.com/mens-college-basketball/boxscore?gameId=${matchId}`;
    const options = {
        uri: URL,
        transform: function (body) {
            return cheerio.load(body);
        }
    };
    var currentBoxScoreInfo = { matchId, boxscore: [] }
    await rp(options)
    .then($ => {
        $('div#gamepackage-box-score div#gamepackage-boxscore-module').find('div.row-wrapper > div.col').each(function (index, element) {
            const bAwayTeam = $(element).attr('class').includes('gamepackage-away-wrap');
            var eachTeamInfo = { position: bAwayTeam ? 'Away' : 'Home' };
            eachTeamInfo.name = $(element).find('div.table-caption div.team-name').text();
            eachTeamInfo.scoreCategories = [];
            $(element).find('table.mod-data thead tr').each(function (index, eleCategory) {
                let lastCategory = [];
                $(eleCategory).find('th').each((index, ele) => {
                    lastCategory.push($(ele).text());
                });
                eachTeamInfo.scoreCategories.push(lastCategory);
            });
            scoreValues = [];
            highlights = [];
            $(element).find('table.mod-data tbody').each(function (index, eleCategory) {
                let lastScores = [];
                $(eleCategory).find('tr').each((index, eleTr) => {
                    if ($(eleTr).attr('class') && $(eleTr).attr('class').includes('highlight')) {
                        let lastHightlight = [];
                        $(eleTr).find('td').each(function(index, eleTd){
                            lastHightlight.push($(eleTd).text());
                        });
                        highlights.push(lastHightlight);
                    } else {
                        let eachPersonInfo = [];
                        $(eleTr).find('td').each((index, eleTd) => {
                            if ($(eleTd).attr('class').includes('name')){
                                var personInfo = {
                                    href: $(eleTd).find('a').attr('href'),
                                    name: $(eleTd).find('a > span:first-child').text(),
                                    name_abbrev: $(eleTd).find('a > span.abbr').text(),
                                    position: $(eleTd).find('span.position').text()
                                };
                                var strPersonInfo = personInfo.name + ' (' + personInfo.position + ')';
                                eachPersonInfo.push(strPersonInfo);
                                
                            } else {
                                eachPersonInfo.push($(eleTd).text());
                            }
                        });
                        lastScores.push(eachPersonInfo);
                    }
                });
                scoreValues.push(lastScores);
            });
            eachTeamInfo.scoreValues = [];
            for ( let i = 0; i < scoreValues.length; i++) {
                let oneBoxscore = [];
                for (let ii = 0; ii < scoreValues[i].length; ii++) {
                    let personInfo = {};
                    for (let j = 0; j < eachTeamInfo.scoreCategories[i].length; j++) {
                        personInfo[eachTeamInfo.scoreCategories[i][j]] = scoreValues[i][ii][j];
                    }
                    oneBoxscore.push(personInfo);
                }
                eachTeamInfo.scoreValues.push(oneBoxscore);
            }
            eachTeamInfo.highlights = [];
            for ( let i = 0; i < highlights.length; i++) {
                let oneHighLight = {};
                for (let j = 0; j < eachTeamInfo.scoreCategories[1].length; j++) {
                    oneHighLight[eachTeamInfo.scoreCategories[1][j]] = highlights[i][j];
                }
                eachTeamInfo.highlights.push(oneHighLight);
            }
            currentBoxScoreInfo.boxscore.push(eachTeamInfo);        
        });
    })
    .catch( err => {
        console.log(err)
    });
    return new Promise((resolve, reject) => {
        resolve(currentBoxScoreInfo);
    });
}

var getBettingInfoFromDateWithoutPhantom = async function(strDate, objMatchInfo) {
    let resultMatchInfo = Object.assign({}, objMatchInfo);
    
    // oddshark Scrapping here
    resultMatchInfo = await getBettingInfoFromOddsharkWithoutPhantom(strDate, resultMatchInfo);
    
    // donbest Scrapping here
    resultMatchInfo = await getBettingInfoFromDonBestWithoutPhantom(strDate, resultMatchInfo);

    return new Promise((resolve, reject) => {
        resolve(resultMatchInfo);
    })
}

var getBettingInfoFromOddsharkWithoutPhantom = async function(strDate, currentMatchInfo) {
    const options = {
        uri: `https://io.oddsshark.com/scores/ncaab/${strDate}`,
        headers: {
            'referer': 'https://www.oddsshark.com'
        },
        json: true
    };
    await rp(options)
    .then(response => {
        for (let i = 0; i < response.length; i++) {
            let curMatch = currentMatchInfo.matches.find(element => {
                if ( element.awayTeam === response[i]['away_display_name'] && element.homeTeam === response[i]['home_display_name'] ) return true;
                else if ( element.awayTeam_finalscore === response[i]['away_score'] && element.homeTeam_finalscore === response[i]['home_score'] ) return true;
                return false;
            })
            if (!curMatch) continue;

            for ( let j = 0; j < arrCloningFields.length; j++) {
                curMatch.bettingInfo.oddshark[arrCloningFields[j]] = response[i][arrCloningFields[j]] || 0;
            }
        }
    })
    .catch( err => { 
        console.log('Network Errorss...', err)
    });
    return new Promise((resolve, reject) => {
        resolve(currentMatchInfo)
    })
}

var getBettingInfoFromDonBestWithoutPhantom = async function(strDate, currentMatchInfo) {
    // http://www.donbest.com/ncaab/odds/spreads/20190220.html
    let options = {
        uri: `http://www.donbest.com/ncaab/odds/spreads/${strDate.split('-').join('')}.html`,
        transform: function (body) {
            return cheerio.load(body);
        }
    };
    await rp(options)
    .then($ => {
        $('div#oddsHolder tr[class*=statistics_table_]').each(function(ind, element){
            let curMatch = currentMatchInfo.matches.find(eachMatch => {
                if ( eachMatch.awayTeam === $(element).find('td nobr:first-child').text() &&
                     eachMatch.homeTeam === $(element).find('td nobr:last-child').text() ) return true;
                else if ( eachMatch.awayTeam_finalscore === $(element).find('div[id*=_Div_Score_4_]:first-child').text() &&
                        eachMatch.homeTeam_finalscore === $(element).find('div[id*=_Div_Score_4_]:last-child').text() &&
                        (eachMatch.awayTeam === $(element).find('td nobr:first-child').text() || eachMatch.homeTeam === $(element).find('td nobr:last-child').text())) return true;
                return false;
            });
            if (!curMatch) return;
            let arrOpener = $(element).find('td.oddsOpener > div').html().split('<br>');
            let arrWestgate = [], arrMirage = [], arrStation = [], arrPinnacle = [], arrSIA = [];
            $(element).find('td.bookColumn[rel=page1]').each(function(index, elem) {
                $(elem).find('div').each(function(iii, ele){
                    if (index === 0) arrWestgate.push($(ele).text());
                    else if (index === 1) arrMirage.push($(ele).text());
                    else if (index === 2) arrStation.push($(ele).text());
                    else if (index === 3) arrPinnacle.push($(ele).text());
                    else if (index === 4) arrSIA.push($(ele).text());
                })
            });
            curMatch.bettingInfo.donbest.spread = {
                opener: {
                    away: arrOpener[0].split('\n')[0],
                    home: arrOpener[1].split('\n')[0],
                    away_price: arrOpener[0].split(';')[1] || '',
                    home_price: arrOpener[1].split(';')[1] || '' },
                westgate: {
                    away: arrWestgate[0].split('\n')[0],
                    home: arrWestgate[1].split('\n')[0],
                    away_price: !arrWestgate[0].split('\n')[1] ? '-' : arrWestgate[0].split('\n')[1].trim(),
                    home_price: !arrWestgate[1].split('\n')[1] ? '-' : arrWestgate[1].split('\n')[1].trim() },
                mirage: {
                    away: arrMirage[0].split('\n')[0],
                    home: arrMirage[1].split('\n')[0],
                    away_price: !arrMirage[0].split('\n')[1] ? '-' : arrMirage[0].split('\n')[1].trim(),
                    home_price: !arrMirage[1].split('\n')[1] ? '-' : arrMirage[1].split('\n')[1].trim() },
                station: {
                    away: arrStation[0].split('\n')[0],
                    home: arrStation[1].split('\n')[0],
                    away_price: !arrStation[0].split('\n')[1] ? '-' : arrStation[0].split('\n')[1].trim(),
                    home_price: !arrStation[1].split('\n')[1] ? '-' : arrStation[1].split('\n')[1].trim() },
                pinnacle: {
                    away: arrPinnacle[0].split('\n')[0], home: arrPinnacle[1].split('\n')[0],
                    away_price: !arrPinnacle[0].split('\n')[1] ? '-' : arrPinnacle[0].split('\n')[1].trim(),
                    home_price: !arrPinnacle[1].split('\n')[1] ? '-' : arrPinnacle[1].split('\n')[1].trim() },
                sia: {
                    away: arrSIA[0].split('\n')[0],
                    home: arrSIA[1].split('\n')[0],
                    away_price: !arrSIA[0].split('\n')[1] ? '-' : arrSIA[0].split('\n')[1].trim(),
                    home_price: !arrSIA[1].split('\n')[1] ? '-' : arrSIA[1].split('\n')[1].trim() },
            }
        })
    })
    .catch( err => { 
        console.log('Network Error222...', err)
    });
    // -------------------
    // http://www.donbest.com/ncaab/odds/totals/20190220.html
    options = {
        uri: `http://www.donbest.com/ncaab/odds/totals/${strDate.split('-').join('')}.html`,
        transform: function (body) {
            return cheerio.load(body);
        }
    };
    await rp(options)
    .then($ => {
        $('div#oddsHolder tr[class*=statistics_table_]').each(function(index, element){
            let curMatch = currentMatchInfo.matches.find(eachMatch => {
                if ( eachMatch.awayTeam === $(element).find('td nobr:first-child').text() &&
                    eachMatch.homeTeam === $(element).find('td nobr:last-child').text() ) return true;
                else if ( eachMatch.awayTeam_finalscore === $(element).find('div[id*=_Div_Score_4_]:first-child').text() &&
                    eachMatch.homeTeam_finalscore === $(element).find('div[id*=_Div_Score_4_]:last-child').text() &&
                    (eachMatch.awayTeam === $(element).find('td nobr:first-child').text() || eachMatch.homeTeam === $(element).find('td nobr:last-child').text())) return true;
                return false;
            })
            if (!curMatch) return;
            
            let arrOpening = $(element).find('td.oddsOpener > div').clone().find('div').remove().end().html().split('<br>');
            arrOpening.unshift($(element).find('td.oddsOpener div[class*=oddsAlignMiddle]').text());

            let arrWestgate = [], arrMirage = [], arrStation = [], arrPinnacle = [], arrSIA = [];
            $(element).find('td.bookColumn[rel=page1]').each(function(index, elem) {
                var value1 = 0, value2 = 0, value3 = 3;
                value1 = $(elem).find('div[class*=oddsAlignMiddle]').text();
                value2 = $(elem).find('>div:first-child').clone().children().remove().end().text().trim();
                value3 = $(elem).find('>div:last-child').clone().children().remove().end().text().trim();

                if (index === 0) {
                    arrWestgate.push(value1);
                    arrWestgate.push(value2);
                    arrWestgate.push(value3);
                }
                else if (index === 1) {
                    arrMirage.push(value1);
                    arrMirage.push(value2);
                    arrMirage.push(value3);
                }
                else if (index === 2) {
                    arrStation.push(value1);
                    arrStation.push(value2);
                    arrStation.push(value3);
                }
                else if (index === 3) {
                    arrPinnacle.push(value1);
                    arrPinnacle.push(value2);
                    arrPinnacle.push(value3);
                }
                else if (index === 4) {
                    arrSIA.push(value1);
                    arrSIA.push(value2);
                    arrSIA.push(value3);
                }
            })
            curMatch.bettingInfo.donbest.total = {
                opener: arrOpening,
                westgate: arrWestgate,
                mirage: arrMirage,
                station: arrStation,
                pinnacle: arrPinnacle,
                sia: arrSIA
            }
        })
    })
    .catch( err => { 
        console.log('Network Error for total...', err)
    });
    return new Promise((resolve, reject) => {
        resolve(currentMatchInfo)
    })
}

module.exports.getMatchesFromDateRange = getMatchesFromDateRange;
module.exports.getBoxscoreFromIDs = getBoxscoreFromIDs;
