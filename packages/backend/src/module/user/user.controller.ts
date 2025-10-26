import { Controller, Get, VERSION_NEUTRAL, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';

@Controller({
  path: 'user',
  version: [VERSION_NEUTRAL, '1'],
})
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('login')
  login(@Query('ticket') ticket: string) {
    return this.userService.login(ticket);
  }

  @Get('data')
  @AuthRoles('user')
  findOne(@UserParams() user: UserJwtPayload) {
    return this.userService.findOne(user.id);
  }
}
