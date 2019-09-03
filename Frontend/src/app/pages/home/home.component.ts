import { Component, OnInit, Inject } from '@angular/core';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatSnackBar } from '@angular/material';
import { MatDialog, /*MatDialogConfig, */MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { AppSettings } from '../../app.settings';
import { Settings } from '../../app.settings.model';
import { DataService } from '../../data.service';
import { ScrappingSocket } from '../../app.socket.service';
import { ngxCsv } from 'ngx-csv/ngx-csv';

const INITSTATUS = {
  LOADING: false,
  MATCH_SCRAPPING: false,
  BOXSCORE_SCRAPPING: false,
  DOWNLOAD_CSV: false
};

@Component({
  selector: 'app-home-boxscore-dialog-dialog',
  templateUrl: 'home.boxscore.dialog.html',
  styleUrls: ['./home.component.scss']
})
export class MatchBoxScoreDialog {
  constructor(
    public dialogRef: MatDialogRef<MatchBoxScoreDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-home-bettinginfo-dialog-dialog',
  templateUrl: 'home.bettinginfo.dialog.html'
})
export class MatchBettingInfoDialog {
  constructor(
    public dialogRef: MatDialogRef<MatchBoxScoreDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  filterCategory(strCategory: string) {
    const arrResult = strCategory.toUpperCase().split('_');
    if ( arrResult.length === 1) {
      return arrResult[0];
    }
    arrResult[0] = arrResult[0][0];
    return arrResult.join('-');
  }
}


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})

export class HomeComponent implements OnInit {
  public settings: Settings;
  private startDate: string;
  private endDate: string;
  private scrapeUnit: string;
  private nLoading: any;
  private nWaitingResposeCount: number;
  private arrMatchesWithDate: Array<any>;
  private arrSteps = ['1', '3', '5', '7', '10' ];

  constructor(public appSettings: AppSettings,
              public snackBar: MatSnackBar,
              private dataService: DataService,
              private socket: ScrappingSocket,
              private dialog: MatDialog) {
    this.settings = this.appSettings.settings;
    this.nLoading = Object.assign({}, INITSTATUS);
    this.arrMatchesWithDate = [];
    this.nWaitingResposeCount = 0;
    this.scrapeUnit = '3';
  }

  ngOnInit(): void {
    this.onFinishedDayScrapping = this.onFinishedDayScrapping.bind(this);
    this.onFinishBoxscoreForMatch = this.onFinishBoxscoreForMatch.bind(this);
    // this.onFinishBettingInfoForDate = this.onFinishBettingInfoForDate.bind(this);
    this.socket.on('/retrived-matches-by-date', this.onFinishedDayScrapping);
    this.socket.on('/retrived-boxscore-with-id', this.onFinishBoxscoreForMatch);
    // this.socket.on('/retrived-bettinginfo-with-date', this.onFinishBettingInfoForDate);
  }

  onFinishBoxscoreForMatch(data: any) {
    for ( let i = 0; i < this.arrMatchesWithDate.length; i++) {
      const currentMatch = this.arrMatchesWithDate[i].matches.find(element => {
        return element.id === data.matchId;
      });
      if (!currentMatch) {
        continue;
      }
      currentMatch.boxscore = data.boxscore;
      this.nWaitingResposeCount--;
      if (this.nWaitingResposeCount <= 0) {
        this.nLoading.LOADING = false;
        this.nLoading.BOXSCORE_SCRAPPING = true;
      }
      break;
    }
  }

  onFinishedDayScrapping(data: any) {
    console.log(data);
    let curIndex = this.arrMatchesWithDate.findIndex(element => element.date === data.date);
    if (curIndex >= 0) {
      this.arrMatchesWithDate.splice(curIndex, 1, data);
    } else {
      this.arrMatchesWithDate.push(data);
    }
    this.nWaitingResposeCount--;
    this.arrMatchesWithDate.sort((former, latter) => {
      return former.date > latter.date ? 1 : former.date < latter.date ? -1 : 0;
    });
    if (this.nWaitingResposeCount <= 0) {
      this.nLoading.LOADING = false;
      this.nLoading.MATCH_SCRAPPING = true;
    }
  }

  onStartDateChanged(type: string, event: MatDatepickerInputEvent<Date>) {
    const nYear = event.value.getFullYear();
    const nMonth = event.value.getMonth() + 1;
    const strMonth = nMonth > 9 ? '' + nMonth : '0' + nMonth;
    const nDate = event.value.getDate();
    const strDay = nDate > 9 ? '' + nDate : '0' + nDate;
    this.startDate = nYear + '-' + strMonth + '-' + strDay;
    this.nLoading = Object.assign({}, INITSTATUS);
  }

  onEndDateChanged(type: string, event: MatDatepickerInputEvent<Date>) {
    const nYear = event.value.getFullYear();
    const nMonth = event.value.getMonth() + 1;
    const strMonth = nMonth > 9 ? '' + nMonth : '0' + nMonth;
    const nDate = event.value.getDate();
    const strDay = nDate > 9 ? '' + nDate : '0' + nDate;
    this.endDate = nYear + '-' + strMonth + '-' + strDay;
    this.nLoading = Object.assign({}, INITSTATUS);
  }

  onDetailMatch(matchID) {
    if (this.nLoading.LOADING || !this.nLoading.BOXSCORE_SCRAPPING ) {
      this.snackBar.open('Can See Details after Scraping Boxscore', 'Close', { duration: 2000 });
      return;
    }
    let objSelectedMathInfo = {};
    for ( let i = 0; i < this.arrMatchesWithDate.length; i++) {
      const currentMatch = this.arrMatchesWithDate[i].matches.find(element => {
        return element.id === matchID;
      });
      if (!currentMatch) {
        continue;
      }
      objSelectedMathInfo = Object.assign({}, currentMatch);
      break;
    }
    const dialogRef = this.dialog.open(MatchBoxScoreDialog, {
      data: objSelectedMathInfo
      // panelClass: 'dialog-width-90vw'
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }

  onDetailBettingInfo(matchID) {
    let objSelectedMathInfo = {};
    for ( let i = 0; i < this.arrMatchesWithDate.length; i++) {
      const currentMatch = this.arrMatchesWithDate[i].matches.find(element => {
        return element.id === matchID;
      });
      if (!currentMatch) {
        continue;
      }
      objSelectedMathInfo = Object.assign({}, currentMatch);
      break;
    }
    objSelectedMathInfo['bettingInfo']['oddsharkCategories'] = [ 'total', 'home_spread', 'away_spread', 'home_votes', 'away_votes' ];
    objSelectedMathInfo['bettingInfo']['donbestCategories'] = ['team', 'opponent', 'westgate(S/T)',
      'mirage(S/T)', 'station(S/T)', 'pinnacle(S/T)', 'sia(S/T)'];
    objSelectedMathInfo['bettingInfo']['donbestValues'] = [];
    const objDonBest = objSelectedMathInfo['bettingInfo']['donbest'];
    const homeDonBest = {
      'team': objSelectedMathInfo['homeTeam'],
      'opponent': objSelectedMathInfo['awayTeam'],
      'westgate(S/T)': objDonBest.spread.westgate.home + '(' + objDonBest.spread.westgate.home_price + ') / ' +
                  objDonBest.total.westgate[0] + '(' + objDonBest.total.westgate[2] + ')',
      'mirage(S/T)': objDonBest.spread.mirage.home + '(' + objDonBest.spread.mirage.home_price + ') / ' +
                  objDonBest.total.mirage[0] + '(' + objDonBest.total.mirage[2] + ')',
      'station(S/T)': objDonBest.spread.station.home + '(' + objDonBest.spread.station.home_price + ') / ' +
                  objDonBest.total.station[0] + '(' + objDonBest.total.station[2] + ')',
      'pinnacle(S/T)': objDonBest.spread.pinnacle.home + '(' + objDonBest.spread.pinnacle.home_price + ') / ' +
                  objDonBest.total.pinnacle[0] + '(' + objDonBest.total.pinnacle[2] + ')',
      'sia(S/T)': objDonBest.spread.sia.home + '(' + objDonBest.spread.sia.home_price + ') / ' +
                  objDonBest.total.sia[0] + '(' + objDonBest.total.sia[2] + ')',
    };
    const awayDonBest = {
      'team': objSelectedMathInfo['awayTeam'],
      'opponent': objSelectedMathInfo['homeTeam'],
      'westgate(S/T)': objDonBest.spread.westgate.away + '(' + objDonBest.spread.westgate.away_price + ') / ' +
                  objDonBest.total.westgate[0] + '(' + objDonBest.total.westgate[1] + ')',
      'mirage(S/T)': objDonBest.spread.mirage.away + '(' + objDonBest.spread.mirage.away_price + ') / ' +
                  objDonBest.total.mirage[0] + '(' + objDonBest.total.mirage[1] + ')',
      'station(S/T)': objDonBest.spread.station.away + '(' + objDonBest.spread.station.away_price + ') / ' +
                  objDonBest.total.station[0] + '(' + objDonBest.total.station[1] + ')',
      'pinnacle(S/T)': objDonBest.spread.pinnacle.away + '(' + objDonBest.spread.pinnacle.away_price + ') / ' +
                  objDonBest.total.pinnacle[0] + '(' + objDonBest.total.pinnacle[1] + ')',
      'sia(S/T)': objDonBest.spread.sia.away + '(' + objDonBest.spread.sia.away_price + ') / ' +
                  objDonBest.total.sia[0] + '(' + objDonBest.total.sia[1] + ')',
    };
    objSelectedMathInfo['bettingInfo']['donbestValues'].push(homeDonBest, awayDonBest);
    const dialogRef = this.dialog.open(MatchBettingInfoDialog, {
      data: objSelectedMathInfo
    });
    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }

  onTesting() {
    // console.log(this.arrMatchesWithDate);
  }

  onScrapeMatches() {
    if (!this.startDate || !this.endDate) {
      this.snackBar.open('Dates are not set.', 'Close', { duration: 2000 });
      return;
    } else if (this.startDate > this.endDate) {
      this.snackBar.open('Incorrent Date Range', 'Close', { duration: 2000 });
      return;
    }
    // Logic
    this.nLoading.LOADING = true;
    // this.nLoading.BETTING_SCRAPPING = false;
    this.nLoading.BOXSCORE_SCRAPPING = false;
    this.nLoading.MATCH_SCRAPPING = false;
    this.nWaitingResposeCount = this.getOffsetDays(this.startDate, this.endDate);
    this.arrMatchesWithDate = [];
    this.dataService.scrapeMatchesFromDateRange(this.startDate, this.endDate, this.scrapeUnit).subscribe(res => {
      console.log(res);
    });
  }

  onScrapeMatchesMore() {
    if (!this.startDate || !this.endDate) {
      this.snackBar.open('Dates are not set.', 'Close', { duration: 2000 });
      return;
    } else if (this.startDate > this.endDate) {
      this.snackBar.open('Incorrent Date Range', 'Close', { duration: 2000 });
      return;
    }
    // Logic
    this.nLoading.LOADING = true;
    // this.nLoading.BETTING_SCRAPPING = false;
    this.nLoading.BOXSCORE_SCRAPPING = false;
    this.nLoading.MATCH_SCRAPPING = false;
    this.nWaitingResposeCount = this.getOffsetDays(this.startDate, this.endDate);
    this.dataService.scrapeMatchesFromDateRange(this.startDate, this.endDate, this.scrapeUnit).subscribe(res => {
      console.log(res);
    });
  }

  onScrapeBoxScore() {
    if ( this.nLoading.LOADING || !this.nLoading.MATCH_SCRAPPING ) {
      this.snackBar.open('No need or unavailable to Scrape Details.', 'Close', { duration: 2000 });
      return;
    }
    const arrIDs = [];
    for (let i = 0; i < this.arrMatchesWithDate.length; i++){
      for ( let j = 0; j < this.arrMatchesWithDate[i].matches.length; j++) {
        arrIDs.push(this.arrMatchesWithDate[i].matches[j].id);
      }
    }
    this.nWaitingResposeCount = arrIDs.length;
    this.nLoading.LOADING = true;
    this.dataService.scrapeDetailsFromMatchIDs(arrIDs).subscribe(res => {
      console.log(res);
    });
  }

  onExportToCSV() {
    this.exportBoxScoreInfoToCSV();
    this.exportBettingInfoToCSV();
  }

  exportBoxScoreInfoToCSV() {
    const objBoxScoreOptions = {
      fieldSeparator: ',',
      quoteStrings: '"',
      decimalseparator: '.',
      showLabels: true,
      showTitle: true,
      title: `Box Score from ${this.startDate} to ${this.endDate}`,
      useBom: true,
      headers: ['Game ID', 'Date', 'Team', 'Opponent', 'Player', 'Position', 'MIN', 'FGA', 'FGM',
      '3PA', '3P', 'FTA', 'FTM', 'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', 'PTS']
    };
    const arrBoxScore = [];
    for (let i = 0; i < this.arrMatchesWithDate.length; i++) {
      for (let j = 0; j < this.arrMatchesWithDate[i].matches.length; j++) {
        for ( let k = 0; k < this.arrMatchesWithDate[i].matches[j].boxscore.length; k++) {
          for ( let l = 0; l < this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues.length; l++) {
            for ( let m = 0; m < this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l].length; m++) {
              let playerName = this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['Starters'] ||
                this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['Bench'];
              const playerPosition = playerName.split('(')[1].split(')')[0];
              playerName = playerName.split('(')[0];
              const curInserting = {
                GameID: this.arrMatchesWithDate[i].matches[j].id,
                Date: this.arrMatchesWithDate[i].date,
                Team: this.arrMatchesWithDate[i].matches[j].boxscore[k].position === 'Away' ?
                      this.arrMatchesWithDate[i].matches[j].awayTeam : this.arrMatchesWithDate[i].matches[j].homeTeam,
                Opponent: this.arrMatchesWithDate[i].matches[j].boxscore[k].position === 'Home' ?
                      this.arrMatchesWithDate[i].matches[j].awayTeam : this.arrMatchesWithDate[i].matches[j].homeTeam,
                Player: playerName,
                Position: playerPosition,
                MIN: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['MIN'],
                FGA: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['FG'].split('-')[0],
                FGM: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['FG'].split('-')[1],
                '3PA': this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['3PT'].split('-')[0],
                '3P': this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['3PT'].split('-')[1],
                FTA: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['FT'].split('-')[0],
                FTM: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['FT'].split('-')[1],
                OREB: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['OREB'],
                DREB: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['DREB'],
                REB: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['REB'],
                AST: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['AST'],
                STL: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['STL'],
                BLK: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['BLK'],
                TO: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['TO'],
                PF: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['PF'],
                PTS: this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]['PTS']
                // ...this.arrMatchesWithDate[i].matches[j].boxscore[k].scoreValues[l][m]
              };
              arrBoxScore.push(curInserting);
            }
          }
        }
      }
    }
    new ngxCsv(arrBoxScore, 'BoxScore', objBoxScoreOptions);
  }

  exportBettingInfoToCSV() {
    const objBettingOption = {
      fieldSeparator: ',',
      quoteStrings: '"',
      decimalseparator: '.',
      showLabels: true,
      showTitle: true,
      title: `BettingInfo from ${this.startDate} to ${this.endDate}`,
      useBom: true,
      headers: ['GameID', 'Date', 'Team', 'Opponent', 'Score', 'Westgate_spread', 'Westgate_spread_price',
      'Mirage_spread', 'Mirage_spread_price', 'Station_spread', 'Station_spread_price', 'Pinnacle_spread', 'Pinnacle_spread_price',
      'Sia_spread', 'Sia_spread_price', 'Westgate_total', 'Westgate_total_price', 'Mirage_total', 'Mirage_total_price',
      'Station_total', 'Station_total_price', 'Pinnacle_total', 'Pinnacle_total_price', 'Sia_total', 'Sia_total_price'
      ]
    };
    const arrBettingInfo = [];
    for (let i = 0; i < this.arrMatchesWithDate.length; i++) {
      for (let j = 0; j < this.arrMatchesWithDate[i].matches.length; j++) {
        const objDonbest = this.arrMatchesWithDate[i].matches[j].bettingInfo.donbest;
        if ( !objDonbest.spread ) {
          continue;
        }
        const homeBetting = {
          'GameID': this.arrMatchesWithDate[i].matches[j].id,
          'Date': this.arrMatchesWithDate[i].date,
          'Team': this.arrMatchesWithDate[i].matches[j].homeTeam,
          'Opponent': this.arrMatchesWithDate[i].matches[j].awayTeam,
          'Score': this.arrMatchesWithDate[i].matches[j].homeTeam_finalscore,
          'Westgate_spread': objDonbest.spread.westgate.home,
          'Westgate_spread_price': objDonbest.spread.westgate.home_price,
          'Mirage_spread': objDonbest.spread.mirage.home,
          'Mirage_spread_price': objDonbest.spread.mirage.home_price,
          'Station_spread': objDonbest.spread.station.home,
          'Station_spread_price': objDonbest.spread.station.home_price,
          'Pinnacle_spread': objDonbest.spread.pinnacle.home,
          'Pinnacle_spread_price': objDonbest.spread.pinnacle.home_price,
          'Sia_spread': objDonbest.spread.sia.home,
          'Sia_spread_price': objDonbest.spread.sia.home_price,
          'Westgate_total': objDonbest.total.westgate[0],
          'Westgate_total_price': objDonbest.total.westgate[2],
          'Mirage_total': objDonbest.total.mirage[0],
          'Mirage_total_price': objDonbest.total.mirage[2],
          'Station_total': objDonbest.total.station[0],
          'Station_total_price': objDonbest.total.station[2],
          'Pinnacle_total': objDonbest.total.pinnacle[0],
          'Pinnacle_total_price': objDonbest.total.pinnacle[2],
          'Sia_total': objDonbest.total.sia[0],
          'Sia_total_price': objDonbest.total.sia[2]
        };
        const awayBetting = {
          'GameID': this.arrMatchesWithDate[i].matches[j].id,
          'Date': this.arrMatchesWithDate[i].date,
          'Team': this.arrMatchesWithDate[i].matches[j].awayTeam,
          'Opponent': this.arrMatchesWithDate[i].matches[j].homeTeam,
          'Score': this.arrMatchesWithDate[i].matches[j].awayTeam_finalscore,
          'Westgate_spread': objDonbest.spread.westgate.away,
          'Westgate_spread_price': objDonbest.spread.westgate.away_price,
          'Mirage_spread': objDonbest.spread.mirage.away,
          'Mirage_spread_price': objDonbest.spread.mirage.away_price,
          'Station_spread': objDonbest.spread.station.away,
          'Station_spread_price': objDonbest.spread.station.away_price,
          'Pinnacle_spread': objDonbest.spread.pinnacle.away,
          'Pinnacle_spread_price': objDonbest.spread.pinnacle.away_price,
          'Sia_spread': objDonbest.spread.sia.away,
          'Sia_spread_price': objDonbest.spread.sia.away_price,
          'Westgate_total': objDonbest.total.westgate[0],
          'Westgate_total_price': objDonbest.total.westgate[1],
          'Mirage_total': objDonbest.total.mirage[0],
          'Mirage_total_price': objDonbest.total.mirage[1],
          'Station_total': objDonbest.total.station[0],
          'Station_total_price': objDonbest.total.station[1],
          'Pinnacle_total': objDonbest.total.pinnacle[0],
          'Pinnacle_total_price': objDonbest.total.pinnacle[1],
          'Sia_total': objDonbest.total.sia[0],
          'Sia_total_price': objDonbest.total.sia[1]
        };
        arrBettingInfo.push(homeBetting, awayBetting);
      }
    }
    new ngxCsv(arrBettingInfo, 'BettingInfo', objBettingOption);
  }

  getOffsetDays(former, latter) {
    return (new Date(latter).getTime() - new Date(former).getTime()) / (1000 * 60 * 60 * 24) + 1;
  }

  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {
      duration: 2000,
    });
  }
}


