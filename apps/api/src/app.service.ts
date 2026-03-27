import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'CA Practice OS API',
      timestamp: new Date().toISOString(),
    };
  }
}
