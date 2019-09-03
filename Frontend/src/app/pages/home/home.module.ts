import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { HomeComponent, MatchBoxScoreDialog, MatchBettingInfoDialog } from './home.component';

export const routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    SharedModule
  ],
  declarations: [
    HomeComponent,
    MatchBoxScoreDialog,
    MatchBettingInfoDialog
  ],
  entryComponents: [
    MatchBoxScoreDialog,
    MatchBettingInfoDialog
  ]
})
export class HomeModule { }