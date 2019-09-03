import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(private http: HttpClient) {}

  giveMeJokes() {
    return this.http.get('https://api.chucknorris.io/jokes/random');
  }

  scrapeMatchesFromDateRange(strStartDate: string, strEndDate: string, scrapeUnit: string) {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type':  'application/json'
        // 'Authorization': 'my-auth-token'
      })
    };

    const body = {
      startDate : strStartDate,
      endDate: strEndDate,
      unit: scrapeUnit
    };
    return this.http.post('http://localhost:3030/retrieve-matches-with-daterange', body, httpOptions);
  }

  scrapeDetailsFromMatchIDs(arrIDs: Array<number>) {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type':  'application/json'
        // 'Authorization': 'my-auth-token'
      })
    };

    const body = { arrIDs };
    return this.http.post('http://localhost:3030/retrieve-boxscore-with-ids', body, httpOptions);
  }

  scrapeBettingInfoFromDateRange(strStartDate: string, strEndDate: string) {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type':  'application/json'
        // 'Authorization': 'my-auth-token'
      })
    };

    const body = {
      startDate : strStartDate,
      endDate: strEndDate
    }
    return this.http.post('http://localhost:3030/retrieve-bettinginfo-with-daterange', body, httpOptions);
  }
}
