import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Readable } from 'node:stream';
import { IsOptional, IsUUID } from 'class-validator';
import { SignalService } from './signal.service';
import { Public } from './auth';
import { CreateProjectDto, UpdateProjectDto, CreateFeedbackDto, UpdateFeedbackDto, SubmitFeedbackDto, FeedbackFilterDto, ListFeedbackDto } from './dto';

class SummaryQuery { @IsOptional() @IsUUID('4') projectId?: string; }
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller()
export class SignalController {
  constructor(private readonly signal: SignalService) {}
  @Get('projects') projects() { return this.signal.listProjects(); }
  @Post('projects') createProject(@Body() dto: CreateProjectDto) { return this.signal.createProject(dto); }
  @Get('projects/:id') project(@Param('id', uuid) id: string) { return this.signal.getProject(id); }
  @Patch('projects/:id') updateProject(@Param('id', uuid) id: string, @Body() dto: UpdateProjectDto) { return this.signal.updateProject(id, dto); }
  @Post('projects/:id/rotate-key') @HttpCode(200)
  rotateKey(@Param('id', uuid) id: string) { return this.signal.rotateKey(id); }
  @Get('feedback') feedback(@Query() query: ListFeedbackDto) { return this.signal.listFeedback(query); }
  @Get('feedback/export.csv') export(@Query() query: FeedbackFilterDto) {
    return new StreamableFile(Readable.from(this.signal.exportCsv(query)), {
      type: 'text/csv; charset=utf-8', disposition: 'attachment; filename="signal-feedback.csv"',
    });
  }
  @Post('feedback') createFeedback(@Body() dto: CreateFeedbackDto) { return this.signal.createFeedback(dto); }
  @Get('feedback/:id') report(@Param('id', uuid) id: string) { return this.signal.getFeedback(id); }
  @Patch('feedback/:id') updateFeedback(@Param('id', uuid) id: string, @Body() dto: UpdateFeedbackDto) { return this.signal.updateFeedback(id, dto); }
  @Delete('feedback/:id') @HttpCode(204)
  deleteFeedback(@Param('id', uuid) id: string) { return this.signal.deleteFeedback(id); }
  @Get('summary') summary(@Query() query: SummaryQuery) { return this.signal.summary(query.projectId); }
  @Public() @Post('ingest/:projectId') @Throttle({ default: { limit: 10, ttl: 60000 } })
  submit(@Param('projectId', uuid) id: string, @Headers('x-project-key') key: string | undefined, @Body() dto: SubmitFeedbackDto) {
    return this.signal.submitFeedback(id, key || '', dto);
  }
}
