import { Module } from '@nestjs/common';
import { CodingService } from './coding.service';
import { CodingController } from './coding.controller';

@Module({
  controllers: [CodingController],
  providers: [CodingService],
  exports: [CodingService],
})
export class CodingModule {}
