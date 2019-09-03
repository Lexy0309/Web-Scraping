import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

@Injectable()
export class ScrappingSocket extends Socket{
    constructor() {
        super({ url: 'http://localhost:3030', options: {} });
    }
}