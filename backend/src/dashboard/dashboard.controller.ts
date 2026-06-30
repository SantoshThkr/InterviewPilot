import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  getStats(@CurrentUser() user: User) {
    return this.dashboardService.getStats(user);
  }
}
