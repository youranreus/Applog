import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthRoles } from '@reus-able/nestjs';
import type {
  IFlomoAdminConfig,
  IFlomoAdminStatus,
  IFlomoPublicMemoPage,
  IFlomoSyncTriggerResult,
} from '@applog/common';
import { QueryFlomoNotesDto, SetFlomoConfigDto } from './dto';
import { FlomoService } from './flomo.service';

@Controller({ path: 'flomo', version: [VERSION_NEUTRAL, '1'] })
export class FlomoController {
  constructor(private readonly flomoService: FlomoService) {}

  @Get('notes')
  getNotes(@Query() query: QueryFlomoNotesDto): Promise<IFlomoPublicMemoPage> {
    return this.flomoService.getPublicNotes(query.cursor);
  }

  @Get('config')
  @AuthRoles('admin')
  getConfig(): Promise<IFlomoAdminConfig> {
    return this.flomoService.getConfig();
  }

  @Put('config')
  @AuthRoles('admin')
  setConfig(@Body() dto: SetFlomoConfigDto): Promise<IFlomoAdminConfig> {
    return this.flomoService.setConfig(dto);
  }

  @Get('status')
  @AuthRoles('admin')
  getStatus(): Promise<IFlomoAdminStatus> {
    return this.flomoService.getStatus();
  }

  @Post('sync')
  @AuthRoles('admin')
  sync(): IFlomoSyncTriggerResult {
    return this.flomoService.triggerSync();
  }
}
