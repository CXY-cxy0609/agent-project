import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status: 'ok',
      service: 'tutor-server',
      timestamp: new Date().toISOString(),
    };
  }
}
